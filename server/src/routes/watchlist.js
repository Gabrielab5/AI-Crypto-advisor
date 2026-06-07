const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getCachedCoinPrices } = require('./dashboard');

// Build a price/image lookup from the already-cached CoinGecko data
// Handles both raw CoinGecko shape (current_price) and mockCoins shape (price)
function buildPriceMap() {
  const coins = getCachedCoinPrices();
  const map = {};
  for (const c of coins) {
    map[c.id] = {
      price:      c.current_price      ?? c.price      ?? null,
      change_24h: c.price_change_percentage_24h ?? c.change_24h ?? null,
      image:      c.image              ?? null,
    };
  }
  return map;
}

// GET /api/watchlist — user's watched coins enriched from server-side price cache
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.id]
    );
    if (!rows.length) return res.json([]);

    const priceMap = buildPriceMap();

    const result = rows.map(w => {
      const p = priceMap[w.coin_id];
      return {
        ...w,
        price:      p?.price      ?? null,
        change_24h: p?.change_24h ?? null,
        image:      p?.image      ?? null,
      };
    });
    res.json(result);
  } catch (err) {
    console.error('[watchlist GET]', err);
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
