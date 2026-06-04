const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const memes  = require('../../data/memes.json');

// ─── Tiered in-memory cache ────────────────────────────────────────────────
const TTL = { coingecko: 60_000, cryptopanic: 5*60_000, ai_insight: 10*60_000 };
const _live  = new Map();
const _stale = new Map();

function getCached(key) {
  const e = _live.get(key);
  return e && Date.now() - e.at < TTL[key] ? e.data : null;
}
function setCached(key, data) { _live.set(key, { data, at: Date.now() }); _stale.set(key, data); }
function getStale(key) { return _stale.get(key) ?? null; }

// ─── Asset → CoinGecko id ─────────────────────────────────────────────────
const COIN_ID = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin',
  XRP:'ripple', DOGE:'dogecoin', ADA:'cardano', AVAX:'avalanche-2',
  MATIC:'matic-network', LINK:'chainlink', DOT:'polkadot', LTC:'litecoin',
  ATOM:'cosmos', UNI:'uniswap', ARB:'arbitrum',
};

// ─── Coin prices ──────────────────────────────────────────────────────────
async function fetchCoinPrices(prefs) {
  const cached = getCached('coingecko');
  let all = cached;
  if (!all) {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets' +
      '?vs_currency=usd&order=market_cap_desc&per_page=20&sparkline=false&price_change_percentage=24h',
      { headers: { Accept:'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      const stale = getStale('coingecko');
      if (stale) return { data: filterCoins(stale, prefs), stale: true };
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    all = await res.json();
    setCached('coingecko', all);
  }
  return { data: filterCoins(all, prefs), stale: false };
}

function filterCoins(all, prefs) {
  const ids = (prefs.interested_assets||[]).map(a => COIN_ID[a]).filter(Boolean);
  const preferred = ids.length ? all.filter(c => ids.includes(c.id)) : [];
  const result = [...preferred];
  for (const coin of all) {
    if (result.length >= 8) break;
    if (!result.find(c => c.id === coin.id)) result.push(coin);
  }
  return result.slice(0,8).map(c => ({
    id:c.id, name:c.name, symbol:c.symbol.toUpperCase(), image:c.image,
    price:c.current_price, change_24h:c.price_change_percentage_24h??0, market_cap:c.market_cap,
  }));
}

// ─── News ─────────────────────────────────────────────────────────────────
const FALLBACK_NEWS = [
  { id:'fn1', title:'Bitcoin consolidates above key support as institutional demand holds steady',  url:'#', source:'CryptoDesk',    published_at:new Date().toISOString() },
  { id:'fn2', title:'Ethereum Layer 2 transaction volumes reach new all-time highs',                url:'#', source:'DeFi Pulse',    published_at:new Date().toISOString() },
  { id:'fn3', title:'On-chain data shows record number of long-term Bitcoin holders accumulating',  url:'#', source:'Glassnode',     published_at:new Date().toISOString() },
  { id:'fn4', title:'Solana DeFi TVL surpasses $5B milestone for the first time',                  url:'#', source:'The Block',     published_at:new Date().toISOString() },
  { id:'fn5', title:'Regulatory clarity drives renewed interest from asset managers globally',      url:'#', source:'Reuters Crypto',published_at:new Date().toISOString() },
];

async function fetchMarketNews(prefs) {
  const cached = getCached('cryptopanic');
  if (cached) return { data: cached, stale: false };
  if (!process.env.CRYPTOPANIC_API_KEY) return { data: FALLBACK_NEWS, stale: false };
  try {
    const assets = (prefs.interested_assets||[]).filter(a=>['BTC','ETH','SOL','BNB','XRP'].includes(a)).join(',');
    const res = await fetch(
      `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&public=true${assets?`&currencies=${assets}`:''}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) { const s=getStale('cryptopanic'); return s?{data:s,stale:true}:{data:FALLBACK_NEWS,stale:false}; }
    const json = await res.json();
    const news = (json.results||[]).slice(0,5).map(item => ({
      id:String(item.id), title:item.title, url:item.url,
      source:item.source?.title??'CryptoPanic', published_at:item.published_at,
    }));
    setCached('cryptopanic', news);
    return { data: news, stale: false };
  } catch {
    const s = getStale('cryptopanic');
    return s ? { data:s, stale:true } : { data:FALLBACK_NEWS, stale:false };
  }
}

// ─── AI Insight — OpenRouter → HuggingFace → static ──────────────────────
const STATIC_INSIGHT = {
  text: 'The crypto market rewards patience and consistent research over reactive trading. Layer 2 solutions and DeFi protocols are reshaping how value moves on-chain. Focus on fundamentals, manage your risk, and avoid letting short-term volatility override your long-term strategy.',
  model: 'static',
  generated_at: new Date().toISOString(),
};

async function callOpenRouter(prompt) {
  const models = ['mistralai/mistral-7b-instruct:free','meta-llama/llama-3.1-8b-instruct:free','google/gemma-3-1b-it:free'];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer':process.env.CLIENT_URL||'http://localhost:5173', 'X-Title':'AI Crypto Advisor' },
        body: JSON.stringify({ model, messages:[{role:'user',content:prompt}], max_tokens:200, temperature:0.75 }),
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      if (!res.ok) { console.error(`[OpenRouter] ${model} HTTP ${res.status}:`, JSON.stringify(json)); continue; }
      if (json.error) { console.error(`[OpenRouter] ${model}:`, JSON.stringify(json.error)); continue; }
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      return { text, model: json.model??model };
    } catch (err) { console.error(`[OpenRouter] ${model}:`, err.message); }
  }
  return null;
}

async function callHuggingFace(prompt) {
  if (!process.env.HUGGINGFACE_API_KEY) return null;
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.HUGGINGFACE_API_KEY}` },
      body: JSON.stringify({ inputs:`<s>[INST] ${prompt} [/INST]`, parameters:{ max_new_tokens:200, return_full_text:false, temperature:0.75 } }),
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();
    if (!res.ok) { console.error('[HuggingFace]:', JSON.stringify(json)); return null; }
    const text = Array.isArray(json) ? json[0]?.generated_text?.trim() : json?.generated_text?.trim();
    return text ? { text, model:'huggingface/mistral-7b-instruct-v0.2' } : null;
  } catch (err) { console.error('[HuggingFace]:', err.message); return null; }
}

async function fetchAIInsight(prefs, userId) {
  const cacheKey = `ai_insight_${userId}`;
  const cached = getCached(cacheKey);
  if (cached) return { data: cached, stale: false };

  const assets      = (prefs.interested_assets||[]).join(', ') || 'Bitcoin and Ethereum';
  const investorType = prefs.investor_type || 'hodler';
  const today       = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  // ── Feature 5: memory — fetch last 5 insights for context ─────────────
  let memoryContext = '';
  try {
    const { rows: history } = await pool.query(
      'SELECT text FROM ai_insight_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    if (history.length > 0) {
      const prevList = history.map((r,i) => `${i+1}. "${r.text}"`).join('\n');
      memoryContext = `\n\nPrevious insights you gave this user (do NOT repeat these points, build on or update them):\n${prevList}\n`;
    }
  } catch { /* non-fatal */ }

  const prompt = `Give a short 3-sentence crypto market insight for a ${investorType} investor interested in ${assets}. Today is ${today}. Be concise, specific, and actionable. Do not use bullet points or headers.${memoryContext}`;

  let result = null;
  if (process.env.OPENROUTER_API_KEY) result = await callOpenRouter(prompt);
  if (!result) result = await callHuggingFace(prompt);

  if (!result) {
    const stale = getStale(cacheKey);
    if (stale) return { data: stale, stale: true };
    return { data: { ...STATIC_INSIGHT, generated_at: new Date().toISOString() }, stale: false };
  }

  const insight = { text: result.text, model: result.model, generated_at: new Date().toISOString() };
  setCached(cacheKey, insight);

  // Save to history (fire-and-forget, keep only 10 per user)
  pool.query(
    `INSERT INTO ai_insight_history (user_id, text, model) VALUES ($1, $2, $3)`,
    [userId, insight.text, insight.model]
  ).then(() => pool.query(
    `DELETE FROM ai_insight_history WHERE user_id = $1 AND id NOT IN (
       SELECT id FROM ai_insight_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
     )`, [userId]
  )).catch(() => {});

  return { data: insight, stale: false };
}

// ─── Feature 4: alert checking ────────────────────────────────────────────
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
        triggered.push({
          ...alert,
          target_price:  parseFloat(alert.target_price),
          current_price: coin.price,
          triggered_at:  new Date().toISOString(),
        });
      }
    }
    return triggered;
  } catch { return []; }
}

// ─── GET /api/dashboard ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  let prefs = { interested_assets:[], investor_type:'hodler', content_types:[] };
  try {
    const { rows } = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    if (rows[0]) prefs = rows[0];
  } catch {}

  const [pricesResult, newsResult, insightResult] = await Promise.allSettled([
    fetchCoinPrices(prefs),
    fetchMarketNews(prefs),
    fetchAIInsight(prefs, userId),
  ]);

  const staleFlags = [];
  const extract = (r, fallback) => {
    if (r.status === 'fulfilled') {
      if (r.value.stale) staleFlags.push(true);
      return r.value.data;
    }
    return fallback;
  };

  const coinPrices = extract(pricesResult, []);

  // Check price alerts against live prices
  const triggeredAlerts = await checkAlerts(userId, coinPrices);

  res.json({
    coin_prices:       coinPrices,
    market_news:       extract(newsResult, FALLBACK_NEWS),
    ai_insight:        extract(insightResult, { ...STATIC_INSIGHT, generated_at:new Date().toISOString() }),
    meme:              memes[Math.floor(Math.random() * memes.length)],
    triggered_alerts:  triggeredAlerts,
    stale:             staleFlags.length > 0,
    fetched_at:        new Date().toISOString(),
  });
});

module.exports = router;
