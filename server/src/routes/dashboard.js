const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const memes  = require('../../data/memes.json');
const { mockCoins, mockNews, mockInsight, mockInsightTemplates } = require('../data/mockData');

// ─── Tiered in-memory cache ────────────────────────────────────────────────
const TTL = { coingecko: 60_000, cryptopanic: 86_400_000, ai_insight: 86_400_000 };
const _live  = new Map();
const _stale = new Map();

function getCached(key) {
  const ttl = TTL[key] ?? TTL[key.startsWith('ai_insight_') ? 'ai_insight' : 'coingecko'];
  const e = _live.get(key);
  return e && Date.now() - e.at < ttl ? e.data : null;
}
function setCached(key, data) { _live.set(key, { data, at: Date.now() }); _stale.set(key, data); }
function getStale(key) { return _stale.get(key) ?? null; }
function bustCache(key)     { _live.delete(key); }
function bustCacheFull(key) { _live.delete(key); _stale.delete(key); }

// Insight cache key is tied to user + preferences so changing prefs = fresh insight
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function insightCacheKey(userId, prefs) {
  const raw = `${(prefs.interested_assets || []).slice().sort().join(',')}|${prefs.investor_type || 'hodler'}`;
  return `ai_insight_${userId}_${simpleHash(raw)}`;
}
function bustInsightCacheForUser(userId) {
  const prefix = `ai_insight_${userId}`;
  for (const key of [..._live.keys()]) {
    if (key.startsWith(prefix)) { _live.delete(key); _stale.delete(key); }
  }
}

// ─── Asset → CoinGecko id ─────────────────────────────────────────────────
const COIN_ID = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin',
  XRP:'ripple', DOGE:'dogecoin', ADA:'cardano', AVAX:'avalanche-2',
  MATIC:'matic-network', LINK:'chainlink', DOT:'polkadot', LTC:'litecoin',
  ATOM:'cosmos', UNI:'uniswap', ARB:'arbitrum',
};

// ─── Coin prices ──────────────────────────────────────────────────────────
async function fetchCoinPrices(prefs, dislikedIds = []) {
  const cached = getCached('coingecko');
  let all = cached;
  if (!all) {
    const cgHeaders = { Accept: 'application/json' };
    if (process.env.COINGECKO_API_KEY) cgHeaders['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets' +
      '?vs_currency=usd&order=market_cap_desc&per_page=30&sparkline=false&price_change_percentage=24h',
      { headers: cgHeaders, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      const stale = getStale('coingecko');
      if (stale) return { data: filterCoins(stale, prefs, dislikedIds), stale: true };
      console.error(`[dashboard] CoinGecko HTTP ${res.status} — using mock data`);
      return { data: filterCoins(mockCoins, prefs, dislikedIds), stale: true };
    }
    all = await res.json();
    setCached('coingecko', all);
  }
  return { data: filterCoins(all, prefs, dislikedIds), stale: false };
}

function filterCoins(all, prefs, dislikedIds = []) {
  const ids       = (prefs.interested_assets||[]).map(a => COIN_ID[a]).filter(Boolean);
  const preferred = ids.length ? all.filter(c => ids.includes(c.id) && !dislikedIds.includes(c.id)) : [];
  const result    = [...preferred];

  for (const coin of all) {
    if (result.length >= 8) break;
    if (!result.find(c => c.id === coin.id) && !dislikedIds.includes(coin.id)) result.push(coin);
  }
  // Fallback: if exclusions left fewer than 4 coins, fill without exclusion filter
  if (result.length < 4) {
    for (const coin of all) {
      if (result.length >= 8) break;
      if (!result.find(c => c.id === coin.id)) result.push(coin);
    }
  }
  return result.slice(0, 8).map(c => ({
    id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), image: c.image,
    price: c.current_price ?? c.price, change_24h: c.price_change_percentage_24h ?? c.change_24h ?? 0, market_cap: c.market_cap,
  }));
}

// ─── News ─────────────────────────────────────────────────────────────────
const FALLBACK_NEWS = [
  { id:'fn1', title:'Bitcoin consolidates above key support as institutional demand holds steady',
    url:'https://www.coindesk.com',      source:'CoinDesk',      published_at: new Date().toISOString() },
  { id:'fn2', title:'Ethereum Layer 2 transaction volumes reach new all-time highs',
    url:'https://cointelegraph.com',     source:'CoinTelegraph',  published_at: new Date().toISOString() },
  { id:'fn3', title:'On-chain data shows record number of long-term Bitcoin holders accumulating',
    url:'https://decrypt.co',            source:'Decrypt',        published_at: new Date().toISOString() },
  { id:'fn4', title:'Solana DeFi TVL surpasses $5B milestone for the first time',
    url:'https://www.theblock.co',       source:'The Block',      published_at: new Date().toISOString() },
  { id:'fn5', title:'Regulatory clarity drives renewed interest from asset managers globally',
    url:'https://blockworks.co',         source:'Blockworks',     published_at: new Date().toISOString() },
  { id:'fn6', title:'Bitcoin ETF net inflows hit record weekly high as institutional adoption accelerates',
    url:'https://www.coindesk.com',      source:'CoinDesk',       published_at: new Date().toISOString() },
  { id:'fn7', title:'DeFi protocol revenues outpace traditional fintech for third consecutive quarter',
    url:'https://thedefiant.io',         source:'The Defiant',    published_at: new Date().toISOString() },
  { id:'fn8', title:'Crypto market correlations with equities decline as asset class matures',
    url:'https://blockworks.co',         source:'Blockworks',     published_at: new Date().toISOString() },
];

async function fetchMarketNews(prefs) {
  const cached = getCached('cryptopanic');
  if (cached) return { data: cached, stale: false };
  if (!process.env.CRYPTOPANIC_API_KEY) return { data: FALLBACK_NEWS, stale: false };
  try {
    const assets = (prefs.interested_assets||[]).filter(a=>['BTC','ETH','SOL','BNB','XRP'].includes(a)).join(',');
    const res = await fetch(
      `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&public=true&per_page=8${assets?`&currencies=${assets}`:''}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) { const s=getStale('cryptopanic'); return s?{data:s,stale:true}:{data:FALLBACK_NEWS,stale:false}; }
    const json = await res.json();
    const news = (json.results||[]).slice(0,8).map(item => ({
      id: String(item.id), title: item.title, url: item.url,
      source: item.source?.title ?? 'CryptoPanic', published_at: item.published_at,
    }));
    setCached('cryptopanic', news);
    return { data: news, stale: false };
  } catch {
    const s = getStale('cryptopanic');
    return s ? { data:s, stale:true } : { data:FALLBACK_NEWS, stale:false };
  }
}

// ─── AI Insight — OpenRouter → HuggingFace → Gemini → static ────────────
const LOG = process.env.NODE_ENV !== 'test';

const STATIC_INSIGHT = {
  text: 'The crypto market rewards patience and consistent research over reactive trading. Layer 2 solutions and DeFi protocols are reshaping how value moves on-chain. Focus on fundamentals, manage your risk, and avoid letting short-term volatility override your long-term strategy.',
  model: 'static',
  generated_at: new Date().toISOString(),
};

// Race a provider call against a 10s deadline; returns null on timeout or error
function withTimeout(ms, fn) {
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`AI provider timeout after ${ms}ms`)), ms)),
  ]).catch(err => { console.error('[AI timeout/error]:', err.message); return null; });
}

// ─── OpenRouter: discover live free models at runtime ─────────────────────
let _orFreeModels = null;
let _orFreeModelsFetchedAt = 0;

async function getOpenRouterFreeModels() {
  // Re-discover at most once per hour
  if (_orFreeModels && Date.now() - _orFreeModelsFetchedAt < 3_600_000) return _orFreeModels;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return _orFreeModels; // return last known list on error
    const { data } = await res.json();
    const free = (data || [])
      .filter(m => m.id && m.id.endsWith(':free'))
      .map(m => m.id);
    if (free.length) {
      _orFreeModels = free;
      _orFreeModelsFetchedAt = Date.now();
      if (LOG) console.log(`[OpenRouter] discovered ${free.length} free models`);
    }
    return _orFreeModels;
  } catch (err) {
    console.error('[OpenRouter] model discovery failed:', err.message);
    return _orFreeModels;
  }
}

// Static fallback list — updated if discovery fails
const OR_FALLBACK_MODELS = [
  'google/gemma-3-1b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
];

async function callOpenRouter(prompt) {
  if (!process.env.OPENROUTER_API_KEY) return null;
  const discovered = await getOpenRouterFreeModels();
  // Use discovered list but cap at 5 attempts; fall back to static list if empty
  const models = (discovered && discovered.length ? discovered.slice(0, 5) : OR_FALLBACK_MODELS);

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer':  process.env.CLIENT_URL || 'http://localhost:5173',
          'X-Title':       'AI Crypto Advisor',
        },
        body: JSON.stringify({ model, messages:[{role:'user',content:prompt}], max_tokens:200, temperature:0.75 }),
        signal: AbortSignal.timeout(9000),
      });
      const json = await res.json();
      if (!res.ok) {
        if (LOG) console.log(`[OpenRouter] ${model} HTTP ${res.status} — skipping`);
        continue;
      }
      if (json.error) {
        if (LOG) console.log(`[OpenRouter] ${model} error — skipping`);
        continue;
      }
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) { if (LOG) console.log(`[OpenRouter] ${model} empty — skipping`); continue; }
      if (LOG) console.log(`[OpenRouter] ✓ using model: ${model}`);
      return { text, model: json.model ?? model };
    } catch (err) {
      if (LOG) console.log(`[OpenRouter] ${model} threw: ${err.message}`);
    }
  }
  return null;
}

async function callHuggingFace(prompt) {
  const key = (process.env.HUGGINGFACE_API_KEY || '').trim();
  if (!key) { if (LOG) console.log('[HuggingFace] No API key — skipping'); return null; }
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method:  'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${key}` },
        body:    JSON.stringify({ inputs:`<s>[INST] ${prompt} [/INST]`, parameters:{ max_new_tokens:200, return_full_text:false, temperature:0.75 } }),
        signal:  AbortSignal.timeout(9000),
      }
    );
    const json = await res.json();
    if (!res.ok) { console.error('[HuggingFace] HTTP', res.status, JSON.stringify(json).slice(0,200)); return null; }
    const text = Array.isArray(json) ? json[0]?.generated_text?.trim() : json?.generated_text?.trim();
    if (!text) { console.error('[HuggingFace] empty response'); return null; }
    return { text, model: 'huggingface/mistral-7b-instruct-v0.3' };
  } catch (err) {
    console.error('[HuggingFace] fetch error:', err.message);
    return null;
  }
}

// Gemini: lite model has 30 RPM free (vs 10 RPM for standard flash)
const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
];

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) return null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contents:         [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.75 },
          }),
          signal: AbortSignal.timeout(14_000),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        console.error(`[Gemini] ${model} HTTP ${res.status}:`, JSON.stringify(json).slice(0,200));
        continue;
      }
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) { console.error(`[Gemini] ${model} empty response`); continue; }
      if (LOG) console.log(`[Gemini] ✓ using model: ${model}`);
      return { text, model: `gemini/${model}` };
    } catch (err) { console.error(`[Gemini] ${model} threw:`, err.message); }
  }
  return null;
}

// Pick the best-matching mock insight template for these preferences
function selectMockInsight(prefs) {
  const type = (prefs.investor_type || 'hodler').toLowerCase();
  const match = mockInsightTemplates.find(t => t.investor_type.toLowerCase() === type);
  return {
    text:         match ? match.insight : mockInsight.text,
    model:        'static',
    generated_at: new Date().toISOString(),
  };
}

// Detect if the AI response leaked the prompt back into the answer
const PROMPT_LEAK_PATTERNS = [
  'write a 3-sentence',
  'do not use bullet',
  'do not include',
  'write only the insight',
  'be specific, actionable',
  'investor interested in',
];
function hasPromptLeakage(text) {
  const lower = text.toLowerCase();
  return PROMPT_LEAK_PATTERNS.some(p => lower.includes(p));
}

async function fetchAIInsight(prefs, userId, dislikedCoinIds = []) {
  const cacheKey = insightCacheKey(userId, prefs);
  const cached   = getCached(cacheKey);
  if (cached) {
    if (LOG) {
      const entry  = _live.get(cacheKey);
      const ageMin = entry ? Math.round((Date.now() - entry.at) / 60000) : 0;
      console.log(`[AI] Serving cached insight (${ageMin}m old)`);
    }
    return { data: cached, stale: false };
  }

  const assets       = (prefs.interested_assets||[]).join(', ') || 'Bitcoin and Ethereum';
  const investorType = prefs.investor_type || 'hodler';

  const prompt = `Write a 3-sentence crypto market insight for a ${investorType} investor interested in ${assets}. Be specific, actionable, and current. Do not include the prompt instructions in your response. Do not use bullet points. Write only the insight itself.`;

  // Priority: Gemini → OpenRouter → HuggingFace → mock template
  let result = null;
  if (process.env.GEMINI_API_KEY) {
    const t = Date.now();
    if (LOG) console.log('[AI] Trying Gemini...');
    result = await withTimeout(15_000, () => callGemini(prompt));
    if (LOG) console.log(`[AI] Gemini → ${result ? 'SUCCESS' : 'FAILED'} (${Date.now() - t}ms)`);
  }
  if (!result && process.env.OPENROUTER_API_KEY) {
    const t = Date.now();
    if (LOG) console.log('[AI] Trying OpenRouter...');
    result = await withTimeout(15_000, () => callOpenRouter(prompt));
    if (LOG) console.log(`[AI] OpenRouter → ${result ? 'SUCCESS' : 'FAILED'} (${Date.now() - t}ms)`);
  }
  if (!result) {
    const t = Date.now();
    if (LOG) console.log('[AI] Trying HuggingFace...');
    result = await withTimeout(15_000, () => callHuggingFace(prompt));
    if (LOG) console.log(`[AI] HuggingFace → ${result ? 'SUCCESS' : 'FAILED'} (${Date.now() - t}ms)`);
  }

  // Sanitize: discard response if it contains prompt leakage
  if (result && hasPromptLeakage(result.text)) {
    if (LOG) console.log('[AI] Prompt leakage detected — discarding response, using mock template');
    result = null;
  }

  if (!result && LOG) console.log('[AI] All providers failed — using mock template');

  if (!result) {
    const fallback = selectMockInsight(prefs);
    setCached(cacheKey, fallback);
    return { data: fallback, stale: false };
  }

  const insight = { text: result.text, model: result.model, generated_at: new Date().toISOString() };
  setCached(cacheKey, insight);

  pool.query(
    'INSERT INTO ai_insight_history (user_id, text, model) VALUES ($1, $2, $3)',
    [userId, insight.text, insight.model]
  ).then(() => pool.query(
    `DELETE FROM ai_insight_history WHERE user_id = $1 AND id NOT IN (
       SELECT id FROM ai_insight_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
     )`, [userId]
  )).catch(() => {});

  return { data: insight, stale: false };
}

// ─── Alert checking ────────────────────────────────────────────────────────
async function checkAlerts(userId, prices) {
  try {
    const { rows: alerts } = await pool.query(
      'SELECT * FROM price_alerts WHERE user_id = $1 AND triggered = FALSE',
      [userId]
    );
    if (!alerts.length) return [];

    const triggered = [];
    for (const alert of alerts) {
      const coin = prices.find(p => p.id === alert.coin_id);
      if (!coin) continue;
      const fires =
        (alert.condition === 'above' && coin.price >= parseFloat(alert.target_price)) ||
        (alert.condition === 'below' && coin.price <= parseFloat(alert.target_price));
      if (fires) {
        await pool.query(
          'UPDATE price_alerts SET triggered = TRUE, triggered_at = NOW() WHERE id = $1',
          [alert.id]
        );
        triggered.push({ ...alert, target_price: parseFloat(alert.target_price),
          current_price: coin.price, triggered_at: new Date().toISOString() });
      }
    }
    return triggered;
  } catch { return []; }
}

// ─── Cache warmup (called on server startup) ───────────────────────────────
async function warmCache() {
  const prefs = { interested_assets: [], investor_type: 'hodler', content_types: [] };
  if (!getCached('coingecko')) {
    await fetchCoinPrices(prefs, []).catch(err => {
      console.warn('[warmCache] coin prices failed, using mock:', err.message);
      setCached('coingecko', mockCoins);
    });
  }
  if (!getCached('cryptopanic')) {
    await fetchMarketNews(prefs).catch(() => {
      setCached('cryptopanic', mockNews);
    });
  }
}

// Daily news refresh — keeps the 24h cache fresh
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    bustCache('cryptopanic');
    const prefs = { interested_assets: [], investor_type: 'hodler', content_types: [] };
    fetchMarketNews(prefs).catch(() => {});
  }, 86_400_000);
}

// ─── GET /api/dashboard ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;

  // 1. Both DB queries run in parallel (was sequential — saves one round-trip)
  const [prefsRes, dislikedRes] = await Promise.allSettled([
    pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]),
    pool.query(
      "SELECT item_id FROM votes WHERE user_id=$1 AND section='coin_prices' AND vote=-1 AND item_id!='main'",
      [userId]
    ),
  ]);

  const prefs = (prefsRes.status === 'fulfilled' && prefsRes.value.rows[0])
    ? prefsRes.value.rows[0]
    : { interested_assets: [], investor_type: 'hodler', content_types: [] };

  const dislikedCoinIds = dislikedRes.status === 'fulfilled'
    ? dislikedRes.value.rows.map(r => r.item_id).filter(Boolean)
    : [];

  // 2. AI insight — serve from cache instantly, generate in background if stale
  //    This removes AI latency (up to 15s) from the critical response path.
  const insightKey    = insightCacheKey(userId, prefs);
  const cachedInsight = getCached(insightKey) ?? getStale(insightKey);
  if (!cachedInsight && process.env.NODE_ENV !== 'test') {
    // No cache at all — kick off generation in the background so the next
    // request (or the 60s auto-refresh) picks up the real insight.
    fetchAIInsight(prefs, userId, dislikedCoinIds).catch(() => {});
  }

  // 3. Coins + news only (both served from warm cache after startup — ~0ms)
  const [pricesResult, newsResult] = await Promise.allSettled([
    fetchCoinPrices(prefs, dislikedCoinIds),
    fetchMarketNews(prefs),
  ]);

  const staleFlags = [];
  const extract = (r, fallback) => {
    if (r.status === 'fulfilled') {
      if (r.value.stale) staleFlags.push(true);
      return r.value.data;
    }
    return fallback;
  };

  const coinPrices      = extract(pricesResult, filterCoins(mockCoins, prefs, dislikedCoinIds));
  const triggeredAlerts = await checkAlerts(userId, coinPrices);

  const aiInsight = cachedInsight
    ?? { ...selectMockInsight(prefs), generated_at: new Date().toISOString() };

  res.json({
    coin_prices:       coinPrices,
    coins_unavailable: false,
    market_news:       extract(newsResult, mockNews),
    ai_insight:        aiInsight,
    meme:              memes[Math.floor(Math.random() * memes.length)],
    memes:             memes,
    triggered_alerts:  triggeredAlerts,
    stale:             staleFlags.length > 0,
    fetched_at:        new Date().toISOString(),
  });
});

// Returns the stale coin price array (raw CoinGecko shape or mockCoins shape)
function getCachedCoinPrices() {
  return _stale.get('coingecko') || [];
}

module.exports = router;
module.exports.warmCache               = warmCache;
module.exports.bustCache               = bustCache;
module.exports.getCachedCoinPrices     = getCachedCoinPrices;
module.exports.bustInsightCacheForUser = bustInsightCacheForUser;
