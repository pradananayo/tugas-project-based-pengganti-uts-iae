const express = require('express');
const router = express.Router();

const users = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' }
];

const teams = [
  { id: 't1', name: 'Developer Team', members: ['1', '2'] }, 
  { id: 't2', name: 'Marketing Team', members: ['2'] } 
];




router.get('/', (req, res) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId) {
    return res.status(401).json({ error: 'User ID not provided by gateway' });
  }

  if (userRole === 'admin') {
    console.log(`[Teams] Admin ${userId} mengambil semua tim.`);
    return res.json(teams);
  }

  const myTeams = teams.filter(team => team.members.includes(userId));
  console.log(`[Teams] User ${userId} mengambil tim mereka.`);
  res.json(myTeams);
});


router.get('/:id', (req, res) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const { id } = req.params;

  const team = teams.find(t => t.id === id);

  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  if (userRole === 'admin' || team.members.includes(userId)) {
    console.log(`[Teams] User ${userId} mengambil detail tim ${id}.`);
    const teamDetails = {
      ...team,
      memberDetails: team.members.map(memberId => {
        return users.find(u => u.id === memberId) || { id: memberId, name: 'Unknown User' };
      })
    };
    return res.json(teamDetails);
  }

  console.warn(`[Teams] User ${userId} DITOLAK saat mencoba akses tim ${id}.`);
  res.status(403).json({ error: 'Forbidden. You are not a member of this team.' });
});

module.exports = router;