// services/rest-api/routes/users.js
const express = require('express');
const router = express.Router();

// NOTE: Ini seharusnya terhubung ke database yang sama dengan /auth
// Untuk demo ini, kita biarkan simpel.
const getHardcodedUsers = () => [
  { id: '1', name: 'John Doe', email: 'john@example.com', age: 30, role: 'admin' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25, role: 'user' }
];


// GET /api/users - Get all users
// Endpoint ini sekarang DIPROTEKSI oleh gateway
router.get('/', (req, res) => {
  // Gateway akan meneruskan info user yang login
  console.log('User accessing /api/users:', req.headers['x-user-id']);
  
  // Hanya admin yang bisa melihat semua user
  if (req.headers['x-user-role'] !== 'admin') {
     // Non-admin hanya bisa melihat diri sendiri (contoh)
     const self = getHardcodedUsers().find(u => u.id === req.headers['x-user-id']);
     return res.json(self ? [self] : []);
  }

  res.json(getHardcodedUsers());
});

// GET /api/users/:id - Get user by ID
// Endpoint ini sekarang DIPROTEKSI oleh gateway
router.get('/:id', (req, res) => {
  const user = getHardcodedUsers().find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  res.json(user);
});

// Endpoint CRUD lain (POST, PUT, DELETE) bisa ditambahkan di sini
// ...dan mereka juga akan otomatis terproteksi oleh gateway

module.exports = router;