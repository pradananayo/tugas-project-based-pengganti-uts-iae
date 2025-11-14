// services/rest-api/server.js
require('dotenv').config(); // Load .env file
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth'); // Kita akan buat file ini
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'REST API Service',
    timestamp: new Date().toISOString()
  });
});

// --- Rute Baru ---
// Rute untuk Autentikasi (login/register)
app.use('/auth', authRoutes);

// Rute untuk data User (nanti akan diproteksi oleh gateway)
app.use('/api/users', userRoutes);

// Rute untuk menyediakan Public Key
app.get('/public-key', (req, res) => {
  const publicKey = process.env.RSA_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).send('Public key not configured.');
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(publicKey);
});


// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 REST API Service running on port ${PORT}`);
  console.log(`🔑 Public Key endpoint: http://localhost:${PORT}/public-key`);
  console.log(`🔒 Auth endpoints: http://localhost:${PORT}/auth/...`);
  console.log(`👤 User endpoints: http://localhost:${PORT}/api/users/...`);
});

module.exports = app;