const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/alerts — list user's active (non-triggered) alerts
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM price_alerts WHERE user_id = $1 AND triggered = FALSE ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alerts — create a new price alert
router.post('/', requireAuth, async (req, res) => {
  const { coin_id, coin_symbol, coin_name, condition, target_price } = req.body;
  if (!coin_id || !coin_symbol || !['above','below'].includes(condition) || !target_price) {
    return res.status(400).json({ error: 'coin_id, coin_symbol, condition (above|below), and target_price are required' });
  }
  try {
    // Cap at 10 active alerts per user
    const { rows: existing } = await pool.query(
      'SELECT COUNT(*) FROM price_alerts WHERE user_id = $1 AND triggered = FALSE',
      [req.user.id]
    );
    if (parseInt(existing[0].count) >= 10) {
      return res.status(422).json({ error: 'Maximum 10 active alerts. Delete some to add more.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO price_alerts (user_id, coin_id, coin_symbol, coin_name, condition, target_price)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, coin_id, coin_symbol, coin_name ?? coin_symbol, condition, target_price]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/alerts/:id — delete (dismiss) an alert
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM price_alerts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Alert not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
