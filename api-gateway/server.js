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
const REST_API_URL = process.env.REST_API_URL || 'http://localhost:3001';
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || 'http://localhost:4000';

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
  max: 100, // limit each IP to 100 requests per windowMs
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
    '^/api/auth': '/auth', // /api/auth/login -> http://rest-api:3001/auth/login
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Auth Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  }
});
app.use('/api/auth', authProxy);

// Proxy untuk Public Key (Publik, dibutuhkan oleh gateway lain jika ada)
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
// app.use(authMiddleware); // Terapkan ke semua rute di bawah

// Proxy untuk REST API (Terproteksi)
const restApiProxy = createProxyMiddleware({
  target: REST_API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/api/users', // /api/users -> http://rest-api:3001/api/users
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward info user yang sudah diautentikasi ke service backend
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.id);
      proxyReq.setHeader('x-user-email', req.user.email);
      proxyReq.setHeader('x-user-role', req.user.role);
    }
    console.log(`[REST Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('REST API Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'REST API service unavailable',
      message: err.message 
    });
  }
});
// Terapkan middleware auth HANYA untuk rute ini
app.use('/api/users', authMiddleware, restApiProxy);

// Proxy untuk GraphQL API (Terproteksi)
const graphqlApiProxy = createProxyMiddleware({
  target: GRAPHQL_API_URL,
  changeOrigin: true,
  ws: true, // Penting untuk subscriptions
  onProxyReq: (proxyReq, req, res) => {
    // Forward info user
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.id);
      proxyReq.setHeader('x-user-email', req.user.email);
      proxyReq.setHeader('x-user-role', req.user.role);
    }
    console.log(`[GraphQL Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('GraphQL API Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'GraphQL API service unavailable',
      message: err.message 
    });
  }
});
// Terapkan middleware auth HANYA untuk rute ini
app.use('/graphql', authMiddleware, graphqlApiProxy);

// Catch-all route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found on gateway'
  });
});

// ... (sisanya sama: Error handling, app.listen,