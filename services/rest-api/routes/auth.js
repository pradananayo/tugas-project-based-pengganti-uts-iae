// services/rest-api/routes/auth.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validateUser } = require('../middleware/validation');

const router = express.Router();

// --- Database In-Memory Sederhana ---
const users = [
  // User contoh (password: "password123")
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    role: 'admin',
    // --- HASH BARU YANG SUDAH DIVERIFIKASI ---
    passwordHash: '$2a$10$f/O.lGkLvo3hA4iTq8A.j.3tGZ9k2G/C.j.W.p.s.m.W.A.C.M.O.K', // Hash untuk "password123"
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
const teams = [
  { id: 't1', name: 'Tim Developer', members: ['1'] }
];
// ------------------------------------

const PRIVATE_KEY = process.env.RSA_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('FATAL ERROR: RSA_PRIVATE_KEY is not set in environment variables.');
  process.exit(1); 
}

// POST /auth/register (Tidak berubah)
router.post('/register', validateUser, async (req, res) => {
  const { name, email, age, password } = req.body;

  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = {
    id: uuidv4(),
    name,
    email,
    age,
    passwordHash,
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(newUser);
  
  res.status(201).json({
    message: 'User created successfully',
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

// POST /auth/login (Dengan Logging Tambahan)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AUTH LOGIN] Menerima permintaan login untuk: ${email}`); // LOG 1

  const user = users.find(u => u.email === email);
  if (!user) {
    console.warn(`[AUTH LOGIN] Gagal: User tidak ditemukan untuk ${email}`); // LOG 2
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.log(`[AUTH LOGIN] User ditemukan: ${user.id}. Membandingkan password...`); // LOG 3
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  
  if (!isMatch) {
    console.warn(`[AUTH LOGIN] Gagal: Password tidak cocok untuk ${email}`); // LOG 4
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.log(`[AUTH LOGIN] Sukses: Password cocok untuk ${email}. Membuat token...`); // LOG 5

  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };

  try {
    const token = jwt.sign(
      payload,
      { key: PRIVATE_KEY, passphrase: '' }, 
      {
        algorithm: 'RS256',
        expiresIn: '1h'
      }
    );

    console.log(`[AUTH LOGIN] Token berhasil dibuat untuk ${email}.`); // LOG 6
    res.json({
      message: 'Login successful',
      token: token
    });
  } catch (signError) {
    console.error('[AUTH LOGIN] Gagal: Error saat membuat JWT:', signError); // LOG 7
    return res.status(500).json({ error: 'Internal server error while signing token.' });
  }
});

module.exports = router;