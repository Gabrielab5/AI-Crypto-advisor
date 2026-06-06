process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

const USER_ID = 'user-uuid-1';
const TOKEN   = jwt.sign({ id: USER_ID, email: 'test@test.com' }, 'test-secret');
const AUTH    = { Authorization: `Bearer ${TOKEN}` };

const MARKET_FIXTURE = [
  { id: 'bitcoin',  name: 'Bitcoin',  symbol: 'btc', image: 'https://example.com/btc.png',
    current_price: 60000, price_change_percentage_24h: 2.5, market_cap: 1e12 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'eth', image: 'https://example.com/eth.png',
    current_price: 3000, price_change_percentage_24h: 1.5, market_cap: 4e11 },
];

const DETAIL_FIXTURE = {
  id: 'litecoin', name: 'Litecoin', symbol: 'ltc',
  image: { large: 'https://example.com/ltc.png' },
  market_data: {
    current_price: { usd: 80 },
    price_change_percentage_24h: 0.5,
    price_change_percentage_7d: -1.2,
    price_change_percentage_30d: 3.1,
    market_cap: { usd: 5e9 },
    total_volume: { usd: 3e8 },
    circulating_supply: 70000000,
    ath: { usd: 410 },
    ath_date: { usd: '2021-05-10T06:04:38.480Z' },
  },
};

const CHART_FIXTURE = {
  prices: [[1700000000000, 60000], [1700003600000, 61000], [1700007200000, 59500]],
};

// Re-assign global.fetch in each beforeEach to get a clean mock with no
// leftover once-queue entries from previous tests.
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
});

// ─── GET /api/coins/market ──────────────────────────────────────────────────
// Note: each test uses a UNIQUE page/per_page combo to guarantee a cache miss
// and avoid interference with the module-level cache that persists across tests.

describe('GET /api/coins/market', () => {
  it('returns shaped coin list on successful CoinGecko fetch', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => MARKET_FIXTURE });

    const res = await request(app).get('/api/coins/market?page=11&per_page=2').set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const btc = res.body.find(c => c.id === 'bitcoin');
    expect(btc).toBeDefined();
    expect(btc.symbol).toBe('BTC');   // uppercased
    expect(btc.price).toBe(60000);
    expect(btc.change_24h).toBe(2.5);
    expect(btc.market_cap).toBe(1e12);
  });

  it('uses page and per_page in the CoinGecko request URL', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await request(app).get('/api/coins/market?page=12&per_page=3').set(AUTH);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page=12'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('per_page=3'),
      expect.any(Object)
    );
  });

  it('caps per_page at 20 regardless of query param', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await request(app).get('/api/coins/market?page=13&per_page=99').set(AUTH);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('per_page=20'),
      expect.any(Object)
    );
  });

  it('returns 503 with error message when CoinGecko is unavailable', async () => {
    // Default mock is already { ok: false, status: 503 }, no override needed.
    const res = await request(app).get('/api/coins/market?page=14&per_page=2').set(AUTH);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/CoinGecko/i);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/coins/market');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/coins/:id ─────────────────────────────────────────────────────
// Each test uses a unique coin ID to avoid cache hits from previous tests.

describe('GET /api/coins/:id', () => {
  it('returns shaped coin detail on successful fetch', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => DETAIL_FIXTURE });

    const res = await request(app).get('/api/coins/litecoin-t1').set(AUTH);

    // The fixture id is 'litecoin' but the response is shaped from the fixture data
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Litecoin');
    expect(res.body.symbol).toBe('LTC');   // uppercased
    expect(res.body.price).toBe(80);
    expect(res.body.change_24h).toBe(0.5);
    expect(res.body.change_7d).toBe(-1.2);
    expect(res.body.change_30d).toBe(3.1);
    expect(res.body.market_cap).toBe(5e9);
    expect(res.body.ath).toBe(410);
    expect(res.body.image).toBe('https://example.com/ltc.png');
  });

  it('uses nullish-coalescing defaults for missing market_data fields', async () => {
    const sparse = {
      id: 'sparse-coin', name: 'Sparse', symbol: 'spr',
      image: {},
      market_data: {
        current_price: {}, price_change_percentage_24h: null,
        price_change_percentage_7d: null, price_change_percentage_30d: null,
        market_cap: {}, total_volume: {}, circulating_supply: null,
        ath: {}, ath_date: {},
      },
    };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => sparse });

    const res = await request(app).get('/api/coins/sparse-coin-t1').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(0);
    expect(res.body.change_24h).toBe(0);
    expect(res.body.market_cap).toBe(0);
    expect(res.body.ath).toBe(0);
    expect(res.body.ath_date).toBeNull();
    expect(res.body.circulating_supply).toBe(0);
  });

  it('returns 503 with error message when CoinGecko is unavailable', async () => {
    // Default mock is already { ok: false, status: 503 }, no override needed.
    const res = await request(app).get('/api/coins/down-coin-t1').set(AUTH);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/CoinGecko/i);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/coins/bitcoin');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/coins/:id/chart ───────────────────────────────────────────────
// Each test uses a unique coin ID to avoid cache hits from previous tests.

describe('GET /api/coins/:id/chart', () => {
  it('returns downsampled price array on successful fetch', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => CHART_FIXTURE });

    const res = await request(app).get('/api/coins/chart-coin-t1/chart?days=7').set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('ts');
    expect(res.body[0]).toHaveProperty('price');
  });

  it('defaults to days=7 for an unsupported days value', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => CHART_FIXTURE });

    await request(app).get('/api/coins/chart-coin-t2/chart?days=999').set(AUTH);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('days=7'),
      expect.any(Object)
    );
  });

  it('accepts days=30', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => CHART_FIXTURE });

    await request(app).get('/api/coins/chart-coin-t3/chart?days=30').set(AUTH);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('days=30'),
      expect.any(Object)
    );
  });

  it('returns synthetic chart data when CoinGecko returns non-OK', async () => {
    // Default mock is already non-OK; let it handle chart-coin-t4.
    const res = await request(app).get('/api/coins/chart-coin-t4/chart?days=7').set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.headers['x-synthetic-data']).toBe('true');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/coins/bitcoin/chart');
    expect(res.status).toBe(401);
  });
});

// ─── Cache behaviour ────────────────────────────────────────────────────────

describe('Caching', () => {
  it('serves market data from cache without calling fetch a second time', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => MARKET_FIXTURE });

    // First request — unique page combo ensures a cache miss and populates cache.
    const res1 = await request(app).get('/api/coins/market?page=17&per_page=1').set(AUTH);
    // Second request — same params, should come from cache.
    const res2 = await request(app).get('/api/coins/market?page=17&per_page=1').set(AUTH);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res1.body).toEqual(res2.body);
  });
});
