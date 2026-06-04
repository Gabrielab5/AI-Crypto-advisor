const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/preferences
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );
    res.json(
      rows[0] ?? { user_id: req.user.id, interested_assets: [], investor_type: null, content_types: [] }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/preferences
router.post('/', requireAuth, async (req, res) => {
  const { interested_assets, investor_type, content_types } = req.body;
  if (
    !Array.isArray(interested_assets) || interested_assets.length === 0 ||
    !investor_type ||
    !Array.isArray(content_types) || content_types.length === 0
  ) {
    return res.status(400).json({
      error: 'interested_assets (array), investor_type, and content_types (array) are all required',
    });
  }
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
