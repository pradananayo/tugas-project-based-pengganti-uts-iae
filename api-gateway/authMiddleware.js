// api-gateway/authMiddleware.js
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Di dalam Docker, kita panggil nama service-nya
const USER_SERVICE_URL = process.env.REST_API_URL || 'http://rest-api:3001';

let cachedPublicKey = null;

/**
 * Mengambil dan menyimpan public key dari User Service.
 */
const fetchPublicKey = async () => {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/public-key`); 
    cachedPublicKey = response.data;
    console.log('[API Gateway] Successfully fetched public key.');
  } catch (err) {
    console.error('[API Gateway] Failed to fetch public key:', err.message);
    // Coba lagi setelah 5 detik
    setTimeout(fetchPublicKey, 5000);
  }
};

/**
 * Middleware untuk memverifikasi token JWT.
 */
const authMiddleware = async (req, res, next) => {
  if (!cachedPublicKey) {
    console.error('[API Gateway] Public key is not available. Retrying fetch...');
    await fetchPublicKey(); // Coba ambil lagi jika belum ada
    if (!cachedPublicKey) {
      return res.status(503).json({ error: 'Service unavailable. Auth public key not loaded.' });
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifikasi token menggunakan Public Key
    const decoded = jwt.verify(token, cachedPublicKey, { algorithms: ['RS256'] });
    
    // Simpan payload token di request agar bisa di-forward
    req.user = decoded; 
    
    next();
  } catch (err) {
    console.error('[API Gateway] JWT Verification Error:', err.message);
    return res.status(401).json({ error: 'Unauthorized. Invalid token.' });
  }
};

module.exports = {
  authMiddleware,
  fetchPublicKey
};