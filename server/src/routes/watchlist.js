const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/watchlist — user's watched coins with live prices
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.id]
    );
    if (!rows.length) return res.json([]);

    const ids = rows.map(r => r.coin_id).join(',');
    let priceMap = {};
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
      );
      if (r.ok) {
        const data = await r.json();
        priceMap = Object.fromEntries(data.map(p => [p.id, p]));
      }
    } catch { /* serve without prices */ }

    const result = rows.map(w => {
      const p = priceMap[w.coin_id];
      return {
        ...w,
        price:      p?.current_price                    ?? null,
        change_24h: p?.price_change_percentage_24h      ?? null,
        image:      p?.image                            ?? null,
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/watchlist — add a coin
router.post('/', requireAuth, async (req, res) => {
  const { coin_id, coin_symbol, coin_name } = req.body;
  if (!coin_id || !coin_symbol) {
    return res.status(400).json({ error: 'coin_id and coin_symbol are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO watchlist (user_id, coin_id, coin_symbol, coin_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, coin_id) DO NOTHING
       RETURNING *`,
      [req.user.id, coin_id, coin_symbol.toUpperCase(), coin_name ?? null]
    );
    if (!rows.length) return res.status(409).json({ error: 'Already in watchlist' });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/watchlist/:coin_id — remove a coin
router.delete('/:coin_id', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND coin_id = $2',
      [req.user.id, req.params.coin_id]
    );
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
