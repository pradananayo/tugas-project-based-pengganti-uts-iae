// api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { authMiddleware, fetchPublicKey } = require('./authMiddleware'); // Impor middleware

const app = express();
const PORT = process.env.PORT || 3000;
const REST_API_URL = process.env.REST_API_URL || 'http://rest-api:3001';
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || 'http://graphql-api:4000';

// Ambil Public Key saat startup
fetchPublicKey();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://localhost:3000', // Gateway itself
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint (Rute Publik)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      'rest-api': REST_API_URL,
      'graphql-api': GRAPHQL_API_URL
    }
  });
});

// Proxy untuk Rute Autentikasi (Publik)
const authProxy = createProxyMiddleware({
  target: REST_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/auth', // <-- INI PERBAIKANNYA
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Auth Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  }
});
app.use('/api/auth', authProxy); // <-- Rute ini dipisah agar tidak kena authMiddleware

// Proxy untuk Public Key (Publik)
const publicKeyProxy = createProxyMiddleware({
  target: REST_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/public-key': '/public-key',
  },
});
app.use('/api/public-key', publicKeyProxy);

// --- Middleware Keamanan Diterapkan Di Sini ---
// Semua rute di bawah ini sekarang memerlukan token JWT yang valid

// Proxy untuk REST API (Terproteksi)
const restApiProxy = createProxyMiddleware({
  target: REST_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/api/users', // <-- INI PERBAIKANNYA
  },
  onProxyReq: (proxyReq, req, res) => {
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.id);
      proxyReq.setHeader('x-user-email', req.user.email);
      proxyReq.setHeader('x-user-role', req.user.role);
    }
    console.log(`[REST Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('REST API Proxy Error:', err.message);
    res.status(500).json({ error: 'REST API service unavailable' });
  }
});
app.use('/api/users', authMiddleware, restApiProxy); // <-- Diterapkan di sini

// Proxy untuk GraphQL API (Terproteksi)
const graphqlApiProxy = createProxyMiddleware({
  target: GRAPHQL_API_URL,
  changeOrigin: true,
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.id);
      proxyReq.setHeader('x-user-email', req.user.email);
      proxyReq.setHeader('x-user-role', req.user.role);
    }
    console.log(`[GraphQL Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('GraphQL API Proxy Error:', err.message);
    res.status(500).json({ error: 'GraphQL API service unavailable' });
  }
});
app.use('/graphql', authMiddleware, graphqlApiProxy); // <-- Diterapkan di sini

// Catch-all route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found on gateway'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Proxying /api/auth/* to: ${REST_API_URL}/auth`);
  console.log(`🔄 Proxying /api/users/* to: ${REST_API_URL}/api/users (Protected)`);
  console.log(`🔄 Proxying /graphql to: ${GRAPHQL_API_URL} (Protected)`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;