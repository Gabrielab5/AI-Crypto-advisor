const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/votes/summary — liked/disliked coins per user
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT item_id, vote FROM votes WHERE user_id = $1 AND section = 'coin_prices' AND item_id != 'main'",
      [req.user.id]
    );
    const liked    = rows.filter(r => r.vote ===  1).map(r => r.item_id);
    const disliked = rows.filter(r => r.vote === -1).map(r => r.item_id);
    res.json({ liked, disliked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/votes — accepts vote: 'up'|'down'|1|-1
router.post('/', requireAuth, async (req, res) => {
  const { section, item_id, vote } = req.body;

  let voteNum;
  if      (vote === 'up'   || vote ===  1) voteNum =  1;
  else if (vote === 'down' || vote === -1) voteNum = -1;
  else return res.status(400).json({ error: 'vote must be "up", "down", 1, or -1' });

  if (!section || !item_id) {
    return res.status(400).json({ error: 'section and item_id are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO votes (user_id, section, item_id, vote)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, section, item_id) DO UPDATE SET vote = EXCLUDED.vote
       RETURNING *`,
      [req.user.id, section, item_id, voteNum]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/votes — remove a specific vote (toggle-off)
router.delete('/', requireAuth, async (req, res) => {
  const { section, item_id } = req.body;
  if (!section || !item_id) {
    return res.status(400).json({ error: 'section and item_id are required' });
  }
  try {
    await pool.query(
      'DELETE FROM votes WHERE user_id = $1 AND section = $2 AND item_id = $3',
      [req.user.id, section, item_id]
    );
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/votes?section=...
router.get('/', requireAuth, async (req, res) => {
  const { section } = req.query;
  try {
    const query  = section
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
