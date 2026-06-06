process.env.JWT_SECRET          = 'test-secret';
process.env.NODE_ENV            = 'test';
process.env.GEMINI_API_KEY      = '';
process.env.OPENROUTER_API_KEY  = '';
process.env.HUGGINGFACE_API_KEY = '';

const request     = require('supertest');
const jwt         = require('jsonwebtoken');
const app         = require('../src/app');
const pool        = require('../src/db/pool');
const { bustCache } = require('../src/routes/dashboard');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

global.fetch = jest.fn();

const USER_ID = 'user-uuid-1';
const TOKEN   = jwt.sign({ id: USER_ID, email: 'test@test.com' }, 'test-secret');
const AUTH    = { Authorization: `Bearer ${TOKEN}` };

const COIN_FIXTURE = [{
  id:'bitcoin', name:'Bitcoin', symbol:'btc', image:'https://example.com/btc.png',
  current_price: 60000, price_change_percentage_24h: 2.5, market_cap: 1e12,
}];

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({
    rows: [{ interested_assets:['BTC'], investor_type:'hodler', content_types:['coin_prices'] }],
  });
});

describe('GET /api/dashboard', () => {
  it('returns all 4 sections plus memes array', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => COIN_FIXTURE });

    const res = await request(app).get('/api/dashboard').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('coin_prices');
    expect(res.body).toHaveProperty('market_news');
    expect(res.body).toHaveProperty('ai_insight');
    expect(res.body).toHaveProperty('meme');
    expect(res.body).toHaveProperty('memes');
    expect(Array.isArray(res.body.memes)).toBe(true);
    expect(res.body).toHaveProperty('fetched_at');
  });

  it('ai_insight always has text even when APIs fail', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => COIN_FIXTURE });

    const res = await request(app).get('/api/dashboard').set(AUTH);
    expect(res.status).toBe(200);
    expect(typeof res.body.ai_insight.text).toBe('string');
    expect(res.body.ai_insight.text.length).toBeGreaterThan(10);
  });

  it('handles CoinGecko failure gracefully and returns fallback news', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const res = await request(app).get('/api/dashboard').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.market_news).toBeDefined();
    expect(res.body.ai_insight).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/dashboard?section=ai_insight&bypass_cache=true', () => {
  it('returns only ai_insight field', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => COIN_FIXTURE });

    const res = await request(app)
      .get('/api/dashboard?section=ai_insight&bypass_cache=true')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ai_insight');
    expect(res.body).toHaveProperty('fetched_at');
    expect(res.body).not.toHaveProperty('coin_prices');
  });

  it('returns fresh ai_insight on bypass (static fallback when no AI keys)', async () => {
    const res = await request(app)
      .get('/api/dashboard?section=ai_insight&bypass_cache=true')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(typeof res.body.ai_insight.text).toBe('string');
  });
});

describe('Feedback loop — disliked coin exclusion', () => {
  beforeEach(() => {
    bustCache('coingecko');        // clear live cache so fresh fetch fires
    global.fetch.mockReset();      // drop any unconsumed mocks from prior tests
  });

  it('excludes disliked coins from coin_prices list', async () => {
    // Use 5 coins so the <4-fallback never re-adds bitcoin after exclusion
    const manyCoins = [
      { id:'bitcoin',  name:'Bitcoin',  symbol:'btc', image:'', current_price:60000, price_change_percentage_24h:2.5,  market_cap:1e12 },
      { id:'ethereum', name:'Ethereum', symbol:'eth', image:'', current_price:3000,  price_change_percentage_24h:1.5,  market_cap:4e11 },
      { id:'solana',   name:'Solana',   symbol:'sol', image:'', current_price:200,   price_change_percentage_24h:3.0,  market_cap:8e10 },
      { id:'cardano',  name:'Cardano',  symbol:'ada', image:'', current_price:0.5,   price_change_percentage_24h:1.0,  market_cap:1.5e10 },
      { id:'ripple',   name:'XRP',      symbol:'xrp', image:'', current_price:0.6,   price_change_percentage_24h:0.5,  market_cap:3e10 },
    ];
    pool.query
      .mockResolvedValueOnce({ rows: [{ interested_assets:['BTC'], investor_type:'hodler', content_types:[] }] })
      .mockResolvedValueOnce({ rows: [{ item_id: 'bitcoin' }] }) // bitcoin disliked
      .mockResolvedValueOnce({ rows: [] });                      // no ai history
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => manyCoins });

    const res = await request(app).get('/api/dashboard').set(AUTH);
    expect(res.status).toBe(200);
    const ids = res.body.coin_prices.map(c => c.id);
    expect(ids).not.toContain('bitcoin');
  });
});
