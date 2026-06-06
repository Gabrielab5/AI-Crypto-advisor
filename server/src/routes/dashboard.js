const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const memes  = require('../../data/memes.json');

// ─── Tiered in-memory cache ────────────────────────────────────────────────
const TTL = { coingecko: 60_000, cryptopanic: 5*60_000, ai_insight: 10*60_000 };
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
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets' +
      '?vs_currency=usd&order=market_cap_desc&per_page=30&sparkline=false&price_change_percentage=24h',
      { headers: { Accept:'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      const stale = getStale('coingecko');
      if (stale) return { data: filterCoins(stale, prefs, dislikedIds), stale: true };
      throw new Error(`CoinGecko HTTP ${res.status}`);
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
    price: c.current_price, change_24h: c.price_change_percentage_24h ?? 0, market_cap: c.market_cap,
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

async function callOpenRouter(prompt) {
  const models = ['mistralai/mistral-7b-instruct:free','meta-llama/llama-3.1-8b-instruct:free','google/gemma-3-1b-it:free'];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,
                   'HTTP-Referer': process.env.CLIENT_URL||'http://localhost:5173', 'X-Title':'AI Crypto Advisor' },
        body: JSON.stringify({ model, messages:[{role:'user',content:prompt}], max_tokens:200, temperature:0.75 }),
        signal: AbortSignal.timeout(9000),
      });
      const json = await res.json();
      if (!res.ok) { console.error(`[OpenRouter] ${model} HTTP ${res.status}:`, JSON.stringify(json)); continue; }
      if (json.error) { console.error(`[OpenRouter] ${model}:`, JSON.stringify(json.error)); continue; }
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      return { text, model: json.model ?? model };
    } catch (err) { console.error(`[OpenRouter] ${model}:`, err.message); }
  }
  return null;
}

async function callHuggingFace(prompt) {
  if (!process.env.HUGGINGFACE_API_KEY) return null;
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.HUGGINGFACE_API_KEY}` },
      body: JSON.stringify({ inputs:`<s>[INST] ${prompt} [/INST]`, parameters:{ max_new_tokens:200, return_full_text:false, temperature:0.75 } }),
      signal: AbortSignal.timeout(9000),
    });
    const json = await res.json();
    if (!res.ok) { console.error('[HuggingFace]:', JSON.stringify(json)); return null; }
    const text = Array.isArray(json) ? json[0]?.generated_text?.trim() : json?.generated_text?.trim();
    return text ? { text, model:'huggingface/mistral-7b-instruct-v0.2' } : null;
  } catch (err) { console.error('[HuggingFace]:', err.message); return null; }
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.75 },
        }),
        signal: AbortSignal.timeout(14_000),
      }
    );
    const json = await res.json();
    if (!res.ok) { console.error('[Gemini] HTTP error:', JSON.stringify(json)); return null; }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) { console.error('[Gemini] empty response:', JSON.stringify(json)); return null; }
    return { text, model: 'gemini-1.5-flash' };
  } catch (err) { console.error('[Gemini] threw:', err.message); return null; }
}

async function fetchAIInsight(prefs, userId, dislikedCoinIds = []) {
  const cacheKey = `ai_insight_${userId}`;
  const cached   = getCached(cacheKey);
  if (cached) return { data: cached, stale: false };

  const assets       = (prefs.interested_assets||[]).join(', ') || 'Bitcoin and Ethereum';
  const investorType = prefs.investor_type || 'hodler';
  const today        = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  let memoryContext = '';
  try {
    const { rows: history } = await pool.query(
      'SELECT text FROM ai_insight_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    if (history.length > 0) {
      const prevList = history.map((r,i) => `${i+1}. "${r.text}"`).join('\n');
      memoryContext = `\n\nPrevious insights you gave this user (do NOT repeat these points):\n${prevList}\n`;
    }
  } catch { /* non-fatal */ }

  const dislikedStr = dislikedCoinIds.length
    ? `\n\nThe user has expressed disinterest in: ${dislikedCoinIds.join(', ')}. Do not focus on these. Prioritize their preferred assets: ${assets}.`
    : '';

  const prompt = `Give a short 3-sentence crypto market insight for a ${investorType} investor interested in ${assets}. Today is ${today}. Be concise, specific, and actionable. Do not use bullet points or headers.${dislikedStr}${memoryContext}`;

  // Priority: Gemini → OpenRouter → HuggingFace → static fallback (15s each)
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
  if (!result && LOG) console.log('[AI] All providers failed — using static fallback');

  if (!result) {
    const stale = getStale(cacheKey);
    if (stale) return { data: stale, stale: true };
    return { data: { ...STATIC_INSIGHT, generated_at: new Date().toISOString() }, stale: false };
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
  if (getCached('coingecko')) return; // already warm
  const prefs = { interested_assets: [], investor_type: 'hodler', content_types: [] };
  await fetchCoinPrices(prefs, []);
}

// ─── GET /api/dashboard/insight — dedicated fresh AI insight endpoint ────
router.get('/insight', requireAuth, async (req, res) => {
  const userId = req.user.id;
  bustCacheFull(`ai_insight_${userId}`);

  let prefs = { interested_assets:[], investor_type:'hodler', content_types:[] };
  try {
    const { rows } = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    if (rows[0]) prefs = rows[0];
  } catch {}

  let dislikedCoinIds = [];
  try {
    const { rows } = await pool.query(
      "SELECT item_id FROM votes WHERE user_id=$1 AND section='coin_prices' AND vote=-1 AND item_id!='main'",
      [userId]
    );
    dislikedCoinIds = rows.map(r => r.item_id).filter(Boolean);
  } catch {}

  const { data: insight } = await fetchAIInsight(prefs, userId, dislikedCoinIds);
  res.json({ ai_insight: insight, fetched_at: new Date().toISOString() });
});

// ─── GET /api/dashboard ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { section, bypass_cache } = req.query;
  const userId  = req.user.id;
  const bypassC = bypass_cache === 'true';

  let prefs = { interested_assets:[], investor_type:'hodler', content_types:[] };
  try {
    const { rows } = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    if (rows[0]) prefs = rows[0];
  } catch {}

  // ── Fetch disliked coin IDs for feedback loop ──────────────────────────
  let dislikedCoinIds = [];
  try {
    const { rows } = await pool.query(
      "SELECT item_id FROM votes WHERE user_id=$1 AND section='coin_prices' AND vote=-1 AND item_id!='main'",
      [userId]
    );
    dislikedCoinIds = rows.map(r => r.item_id).filter(Boolean);
  } catch {}

  // ── Single-section bypass (for AI insight refresh) ─────────────────────
  if (section === 'ai_insight' && bypassC) {
    bustCache(`ai_insight_${userId}`);
    const { data: insight } = await fetchAIInsight(prefs, userId, dislikedCoinIds);
    return res.json({ ai_insight: insight, fetched_at: new Date().toISOString() });
  }

  const [pricesResult, newsResult, insightResult] = await Promise.allSettled([
    fetchCoinPrices(prefs, dislikedCoinIds),
    fetchMarketNews(prefs),
    fetchAIInsight(prefs, userId, dislikedCoinIds),
  ]);

  const staleFlags = [];
  const extract = (r, fallback) => {
    if (r.status === 'fulfilled') {
      if (r.value.stale) staleFlags.push(true);
      return r.value.data;
    }
    return fallback;
  };

  const coinPrices      = extract(pricesResult, []);
  const triggeredAlerts = await checkAlerts(userId, coinPrices);

  res.json({
    coin_prices:      coinPrices,
    market_news:      extract(newsResult,   FALLBACK_NEWS),
    ai_insight:       extract(insightResult, { ...STATIC_INSIGHT, generated_at: new Date().toISOString() }),
    meme:             memes[Math.floor(Math.random() * memes.length)],
    memes:            memes,
    triggered_alerts: triggeredAlerts,
    stale:            staleFlags.length > 0,
    fetched_at:       new Date().toISOString(),
  });
});

module.exports = router;
module.exports.warmCache  = warmCache;
module.exports.bustCache  = bustCache;
