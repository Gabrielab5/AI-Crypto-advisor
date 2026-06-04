const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.created_at,
              p.interested_assets, p.investor_type, p.content_types
       FROM users u
       LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/preferences
router.patch('/preferences', requireAuth, async (req, res) => {
  const { interested_assets, investor_type, content_types } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO user_preferences (user_id, interested_assets, investor_type, content_types)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET interested_assets = EXCLUDED.interested_assets,
             investor_type     = EXCLUDED.investor_type,
             content_types     = EXCLUDED.content_types
       RETURNING *`,
      [req.user.id, interested_assets, investor_type, content_types]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
