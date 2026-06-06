const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

const _cache = new Map();
const _stale = new Map();

function getCached(key, ttlMs) {
  const e = _cache.get(key);
  return e && Date.now() - e.at < ttlMs ? e.data : null;
}
function setCached(key, data) {
  _cache.set(key, { data, at: Date.now() });
  _stale.set(key, data);
}
function getStale(key) { return _stale.get(key) ?? null; }

function generateSyntheticChart(basePrice, days) {
  const count = days === '30' ? 60 : 42;
  const intervalMs = (parseInt(days, 10) * 24 * 60 * 60 * 1000) / count;
  const now = Date.now();
  let price = basePrice;
  return Array.from({ length: count + 1 }, (_, i) => {
    price *= (1 + (Math.random() - 0.5) * 0.025);
    price = Math.max(basePrice * 0.88, Math.min(basePrice * 1.12, price));
    return { ts: Math.round(now - (count - i) * intervalMs), price: Math.round(price * 100) / 100 };
  });
}

// Fetch from CoinGecko with up to 2 retries (1s, 2s) on 429
async function cgFetch(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status !== 429) return r;
      console.warn(`[CoinGecko] 429 on attempt ${attempt + 1}/3`);
    } catch (err) {
      if (attempt === 2) throw err;
      console.warn(`[CoinGecko] fetch error on attempt ${attempt + 1}/3:`, err.message);
    }
  }
  const err = new Error('CoinGecko rate limited after 3 attempts');
  err.status = 429;
  throw err;
}

// GET /api/coins/market?page=2&per_page=10
// Must be registered BEFORE /:id to avoid param capture
router.get('/market', requireAuth, async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page    ?? '2', 10));
  const perPage = Math.min(20, Math.max(1, parseInt(req.query.per_page ?? '10', 10)));
  const cacheKey = `market_p${page}_${perPage}`;
  const cached   = getCached(cacheKey, 60_000);
  if (cached) return res.json(cached);

  try {
    const r = await cgFetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&page=${page}&per_page=${perPage}&sparkline=false&price_change_percentage=24h`
    );
    if (!r.ok) {
      const stale = getStale(cacheKey);
      if (stale) return res.json(stale);
      return res.status(r.status).json({ error: `CoinGecko HTTP ${r.status}` });
    }
    const raw  = await r.json();
    const data = raw.map(c => ({
      id:         c.id,
      name:       c.name,
      symbol:     c.symbol.toUpperCase(),
      image:      c.image,
      price:      c.current_price,
      change_24h: c.price_change_percentage_24h ?? 0,
      market_cap: c.market_cap,
    }));
    setCached(cacheKey, data);
    res.json(data);
  } catch (err) {
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.status(503).json({ error: err.message, stale: true });
  }
});

// GET /api/coins/:id — full coin detail (2-min cache)
router.get('/:id', requireAuth, async (req, res) => {
  const { id }   = req.params;
  const cacheKey = `coin_detail_${id}`;
  const cached   = getCached(cacheKey, 2 * 60_000);
  if (cached) return res.json(cached);

  try {
    const r = await cgFetch(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
    );
    if (!r.ok) {
      const stale = getStale(cacheKey);
      if (stale) return res.json(stale);
      return res.status(r.status).json({ error: `CoinGecko HTTP ${r.status}` });
    }
    const json = await r.json();
    const md   = json.market_data;
    const data = {
      id:                 json.id,
      name:               json.name,
      symbol:             json.symbol.toUpperCase(),
      image:              json.image?.large,
      price:              md.current_price?.usd             ?? 0,
      change_24h:         md.price_change_percentage_24h    ?? 0,
      change_7d:          md.price_change_percentage_7d     ?? 0,
      change_30d:         md.price_change_percentage_30d    ?? 0,
      market_cap:         md.market_cap?.usd                ?? 0,
      volume_24h:         md.total_volume?.usd              ?? 0,
      circulating_supply: md.circulating_supply             ?? 0,
      ath:                md.ath?.usd                       ?? 0,
      ath_date:           md.ath_date?.usd                  ?? null,
    };
    setCached(cacheKey, data);
    res.json(data);
  } catch (err) {
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.status(503).json({ error: err.message, stale: true });
  }
});

// GET /api/coins/:id/chart?days=7 — price history (5-min cache)
router.get('/:id/chart', requireAuth, async (req, res) => {
  const { id }   = req.params;
  const days     = ['7', '30'].includes(req.query.days) ? req.query.days : '7';
  const cacheKey = `coin_chart_${id}_${days}`;
  const cached   = getCached(cacheKey, 5 * 60_000);
  if (cached) return res.json(cached);

  try {
    const r = await cgFetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
    );
    if (!r.ok) {
      const stale = getStale(cacheKey);
      if (stale) return res.json(stale);
      const coinDetail = getStale(`coin_detail_${id}`);
      return res.set('X-Synthetic-Data', 'true').json(generateSyntheticChart(coinDetail?.price ?? 1000, days));
    }
    const json   = await r.json();
    const raw    = json.prices || [];
    const step   = Math.max(1, Math.floor(raw.length / 60));
    const prices = raw
      .filter((_, i) => i % step === 0)
      .map(([ts, price]) => ({ ts, price }));

    setCached(cacheKey, prices);
    res.json(prices);
  } catch (err) {
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    const coinDetail = getStale(`coin_detail_${id}`);
    return res.set('X-Synthetic-Data', 'true').json(generateSyntheticChart(coinDetail?.price ?? 1000, days));
  }
});

module.exports = router;
