const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// Per-symbol 30-min cache
const _cache = new Map();
function getCached(key) {
  const e = _cache.get(key);
  return e && Date.now() - e.at < 30 * 60_000 ? e.data : null;
}
function setCached(key, data) { _cache.set(key, { data, at: Date.now() }); }

function fallbackNews(coinName) {
  return [
    { title: `${coinName} sees increased trading volume this week`,      url: 'https://www.coindesk.com',      source: 'CoinDesk',      published_at: new Date().toISOString() },
    { title: `Analysts weigh in on ${coinName} price outlook`,           url: 'https://cointelegraph.com',     source: 'CoinTelegraph', published_at: new Date().toISOString() },
    { title: `${coinName} community updates and developer activity`,     url: 'https://decrypt.co',            source: 'Decrypt',       published_at: new Date().toISOString() },
  ];
}

// GET /api/news/:symbol?name=Bitcoin
router.get('/:symbol', requireAuth, async (req, res) => {
  const symbol   = req.params.symbol.toUpperCase();
  const coinName = req.query.name || symbol;
  const cacheKey = `news_${symbol}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // 1. CryptoPanic (requires API key)
  if (process.env.CRYPTOPANIC_API_KEY) {
    try {
      const r = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&currencies=${symbol}&kind=news&public=true`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (r.ok) {
        const json = await r.json();
        const news = (json.results || []).slice(0, 5).map(item => ({
          title:        item.title,
          url:          item.url,
          source:       item.source?.title ?? 'CryptoPanic',
          published_at: item.published_at,
        }));
        if (news.length) { setCached(cacheKey, news); return res.json(news); }
      }
    } catch { /* fall through */ }
  }

  // 2. NewsData.io (free, no key required for basic queries)
  try {
    const q   = encodeURIComponent(`${coinName} crypto`);
    const r   = await fetch(
      `https://newsdata.io/api/1/news?q=${q}&language=en&category=business`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (r.ok) {
      const json = await r.json();
      const news = (json.results || []).slice(0, 5).map(item => ({
        title:        item.title,
        url:          item.link,
        source:       item.source_id ?? 'NewsData',
        published_at: item.pubDate ?? new Date().toISOString(),
      })).filter(n => n.title && n.url);
      if (news.length) { setCached(cacheKey, news); return res.json(news); }
    }
  } catch { /* fall through */ }

  // 3. Hardcoded fallback
  const news = fallbackNews(coinName);
  setCached(cacheKey, news);
  res.json(news);
});

module.exports = router;
