// services/rest-api/routes/users.js
const express = require('express');
const router = express.Router();

const getHardcodedUsers = () => [
  { id: '1', name: 'John Doe', email: 'john@example.com', age: 30, role: 'admin' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25, role: 'user' }
];


router.get('/', (req, res) => {
  console.log('User accessing /api/users:', req.headers['x-user-id']);
  
  if (req.headers['x-user-role'] !== 'admin') {
     const self = getHardcodedUsers().find(u => u.id === req.headers['x-user-id']);
     return res.json(self ? [self] : []);
  }

  res.json(getHardcodedUsers());
});

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


module.exports = router;