const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// POST /api/votes
router.post('/', requireAuth, async (req, res) => {
  const { section, item_id, vote } = req.body;
  if (!section || !item_id || ![1, -1].includes(vote)) {
    return res.status(400).json({ error: 'section, item_id, and vote (1 or -1) are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO votes (user_id, section, item_id, vote)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, section, item_id) DO UPDATE SET vote = EXCLUDED.vote
       RETURNING *`,
      [req.user.id, section, item_id, vote]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/votes?section=news
router.get('/', requireAuth, async (req, res) => {
  const { section } = req.query;
  try {
    const query = section
      ? 'SELECT * FROM votes WHERE user_id = $1 AND section = $2'
      : 'SELECT * FROM votes WHERE user_id = $1';
    const params = section ? [req.user.id, section] : [req.user.id];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
