const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { mockCoins, mockChartData } = require('../data/mockData');

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

// Synthetic chart generator — used when CoinGecko is unavailable
function generateSyntheticChart(basePrice, days) {
  return mockChartData(basePrice, parseInt(days, 10));
}

// Fetch from CoinGecko with up to 2 retries on 429
async function cgFetch(url) {
  const cgHeaders = { Accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) cgHeaders['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    try {
      const r = await fetch(url, {
        headers: cgHeaders,
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

// ─── Hardcoded page-2 fallback (SOL, DOT, AVAX, MATIC, UNI, ATOM, LTC, XLM, ALGO, FIL) ─
const PAGE2_MOCK = [
  { id:'solana',      name:'Solana',   symbol:'SOL',   image:'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',        price:145,   change_24h: 2.3, market_cap:68000000000 },
  { id:'polkadot',    name:'Polkadot', symbol:'DOT',   image:'https://coin-images.coingecko.com/coins/images/12171/large/polkadot.png',      price:6.2,   change_24h:-1.4, market_cap:9100000000 },
  { id:'avalanche-2', name:'Avalanche',symbol:'AVAX',  image:'https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png', price:26, change_24h: 1.8, market_cap:11000000000 },
  { id:'matic-network',name:'Polygon', symbol:'MATIC', image:'https://coin-images.coingecko.com/coins/images/4713/large/matic-token-icon.png', price:0.52, change_24h: 0.7, market_cap:5200000000 },
  { id:'uniswap',     name:'Uniswap',  symbol:'UNI',   image:'https://coin-images.coingecko.com/coins/images/12504/large/uni.jpg',            price:6.8,   change_24h: 1.5, market_cap:4100000000 },
  { id:'cosmos',      name:'Cosmos',   symbol:'ATOM',  image:'https://coin-images.coingecko.com/coins/images/1481/large/cosmos_hub.png',      price:8.1,   change_24h:-0.6, market_cap:3200000000 },
  { id:'litecoin',    name:'Litecoin', symbol:'LTC',   image:'https://coin-images.coingecko.com/coins/images/2/large/litecoin.png',           price:78,    change_24h: 0.3, market_cap:5800000000 },
  { id:'stellar',     name:'Stellar',  symbol:'XLM',   image:'https://coin-images.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png', price:0.098, change_24h:-0.7, market_cap:2900000000 },
  { id:'algorand',    name:'Algorand', symbol:'ALGO',  image:'https://coin-images.coingecko.com/coins/images/4380/large/download.png',        price:0.13,  change_24h: 1.2, market_cap:1100000000 },
  { id:'filecoin',    name:'Filecoin', symbol:'FIL',   image:'https://coin-images.coingecko.com/coins/images/12817/large/filecoin.png',       price:3.8,   change_24h:-1.2, market_cap:2100000000 },
];

// ─── Startup chart pre-warm ────────────────────────────────────────────────
// Seed chart cache instantly with synthetic data from known prices.
// Real data overwrites this lazily when users open coin modals.
function warmChartCache() {
  for (const coin of mockCoins) {
    for (const days of ['7', '30']) {
      const key = `coin_chart_${coin.id}_${days}`;
      if (!getCached(key, 5 * 60_000)) {
        setCached(key, generateSyntheticChart(coin.price, days));
      }
    }
  }
}

// GET /api/coins/market?page=2&per_page=10
// Must be registered BEFORE /:id to avoid param capture
router.get('/market', requireAuth, async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page    ?? '2', 10));
  const perPage = Math.min(20, Math.max(1, parseInt(req.query.per_page ?? '10', 10)));
  const cacheKey = `market_p${page}_${perPage}`;
  const cached   = getCached(cacheKey, 60_000);
  if (cached) return res.json(cached);

  // Page 2 uses the hardcoded fallback when CoinGecko is unavailable
  const fallback = page === 2 ? PAGE2_MOCK : mockCoins.slice(10, 20);

  try {
    const r = await cgFetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&page=${page}&per_page=${perPage}&sparkline=false&price_change_percentage=24h`
    );
    if (!r.ok) {
      const stale = getStale(cacheKey);
      if (stale) return res.json(stale);
      return res.json(fallback);
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
    console.error('[coins/market]', err.message);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.json(fallback);
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
      const mock = mockCoins.find(c => c.id === id);
      if (mock) return res.json({ ...mock, change_7d: 0, change_30d: 0, volume_24h: 0, circulating_supply: 0, ath: mock.price * 2, ath_date: null });
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
    console.error('[coins/:id]', err.message);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    const mock = mockCoins.find(c => c.id === id);
    if (mock) return res.json({ ...mock, change_7d: 0, change_30d: 0, volume_24h: 0, circulating_supply: 0, ath: mock.price * 2, ath_date: null });
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
      const coinDetail = getStale(`coin_detail_${id}`) ?? mockCoins.find(c => c.id === id);
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
    console.error('[coins/:id/chart]', err.message);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    const coinDetail = getStale(`coin_detail_${id}`) ?? mockCoins.find(c => c.id === id);
    return res.set('X-Synthetic-Data', 'true').json(generateSyntheticChart(coinDetail?.price ?? 1000, days));
  }
});

module.exports = router;
module.exports.warmChartCache = warmChartCache;
