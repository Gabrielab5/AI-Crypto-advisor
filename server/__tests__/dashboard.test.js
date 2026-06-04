process.env.JWT_SECRET        = 'test-secret';
process.env.NODE_ENV          = 'test';
process.env.OPENROUTER_API_KEY = '';      // disabled in tests
process.env.HUGGINGFACE_API_KEY = '';     // disabled in tests

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');
const pool    = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

// Mock global fetch
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
  pool.query.mockResolvedValue({ rows: [{ interested_assets:['BTC'], investor_type:'hodler', content_types:['coin_prices'] }] });
});

describe('GET /api/dashboard', () => {
  it('returns all 4 sections', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => COIN_FIXTURE }); // coingecko

    const res = await request(app).get('/api/dashboard').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('coin_prices');
    expect(res.body).toHaveProperty('market_news');
    expect(res.body).toHaveProperty('ai_insight');
    expect(res.body).toHaveProperty('meme');
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
    global.fetch.mockRejectedValueOnce(new Error('Network error')); // coingecko fails

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
