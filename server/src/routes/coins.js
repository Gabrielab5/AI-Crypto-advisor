const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// Simple coin-level cache (separate TTLs from dashboard cache)
const _cache = new Map();
function getCached(key, ttlMs) {
  const e = _cache.get(key);
  return e && Date.now() - e.at < ttlMs ? e.data : null;
}
function setCached(key, data) { _cache.set(key, { data, at: Date.now() }); }

// GET /api/coins/:id — full coin detail (ATH, supply, 7d/30d changes)
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const cacheKey = `coin_detail_${id}`;
  const cached   = getCached(cacheKey, 5 * 60 * 1000); // 5 min
  if (cached) return res.json(cached);

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return res.status(r.status).json({ error: `CoinGecko HTTP ${r.status}` });

    const json = await r.json();
    const md   = json.market_data;

    const data = {
      id:               json.id,
      name:             json.name,
      symbol:           json.symbol.toUpperCase(),
      image:            json.image?.large,
      price:            md.current_price?.usd ?? 0,
      change_24h:       md.price_change_percentage_24h ?? 0,
      change_7d:        md.price_change_percentage_7d  ?? 0,
      change_30d:       md.price_change_percentage_30d ?? 0,
      market_cap:       md.market_cap?.usd ?? 0,
      volume_24h:       md.total_volume?.usd ?? 0,
      circulating_supply: md.circulating_supply ?? 0,
      ath:              md.ath?.usd ?? 0,
      ath_date:         md.ath_date?.usd ?? null,
    };
    setCached(cacheKey, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coins/:id/chart?days=7 — price history for chart
router.get('/:id/chart', requireAuth, async (req, res) => {
  const { id }   = req.params;
  const days     = ['7', '30'].includes(req.query.days) ? req.query.days : '7';
  const cacheKey = `coin_chart_${id}_${days}`;
  const cached   = getCached(cacheKey, 5 * 60 * 1000); // 5 min
  if (cached) return res.json(cached);

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return res.status(r.status).json({ error: `CoinGecko HTTP ${r.status}` });

    const json  = await r.json();
    // Downsample to ≤60 points to keep payload lean
    const raw   = json.prices || [];
    const step  = Math.max(1, Math.floor(raw.length / 60));
    const prices = raw
      .filter((_, i) => i % step === 0)
      .map(([ts, price]) => ({ ts, price }));

    setCached(cacheKey, prices);
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
