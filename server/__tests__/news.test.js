process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

global.fetch = jest.fn();

const USER_ID = 'user-uuid-1';
const TOKEN   = jwt.sign({ id: USER_ID, email: 'test@test.com' }, 'test-secret');
const AUTH    = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => {
  jest.clearAllMocks();
  // Default: all external fetches fail — triggers hardcoded fallback
  global.fetch.mockResolvedValue({ ok: false, status: 503 });
  // Unset CRYPTOPANIC key so that branch is skipped by default
  delete process.env.CRYPTOPANIC_API_KEY;
});

// ─── Auth guard ────────────────────────────────────────────────────────────────

describe('GET /api/news/:symbol — auth', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/news/BTC');
    expect(res.status).toBe(401);
  });

  it('returns 200 with a valid token', async () => {
    const res = await request(app).get('/api/news/BTC-noCache1').set(AUTH);
    expect(res.status).toBe(200);
  });
});

// ─── Hardcoded fallback ─────────────────────────────────────────────────────────

describe('GET /api/news/:symbol — hardcoded fallback', () => {
  it('returns exactly 3 fallback items when all APIs fail', async () => {
    const res = await request(app).get('/api/news/BTC-fallback1').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });

  it('each fallback item has title, url, source, published_at', async () => {
    const res = await request(app).get('/api/news/BTC-fallback2').set(AUTH);
    for (const item of res.body) {
      expect(typeof item.title).toBe('string');
      expect(typeof item.url).toBe('string');
      expect(typeof item.source).toBe('string');
      expect(typeof item.published_at).toBe('string');
    }
  });

  it('fallback titles include the coin name query param', async () => {
    const res = await request(app)
      .get('/api/news/BTC-fallback3')
      .query({ name: 'Bitcoin' })
      .set(AUTH);
    const allTitles = res.body.map(n => n.title).join(' ');
    expect(allTitles).toContain('Bitcoin');
  });

  it('fallback uses the symbol when name param is omitted', async () => {
    const res = await request(app).get('/api/news/DOGE-fallback1').set(AUTH);
    const allTitles = res.body.map(n => n.title).join(' ');
    expect(allTitles).toContain('DOGE');
  });

  it('fallback URLs point to known crypto news outlets', async () => {
    const res = await request(app).get('/api/news/ETH-fallback1').set(AUTH);
    const urls = res.body.map(n => n.url);
    expect(urls.some(u => u.includes('coindesk') || u.includes('cointelegraph') || u.includes('decrypt'))).toBe(true);
  });
});

// ─── Symbol uppercasing ────────────────────────────────────────────────────────

describe('GET /api/news/:symbol — symbol handling', () => {
  it('uppercases lowercase symbol for consistent cache key', async () => {
    // Two requests — lowercase and uppercase — should hit the same cache entry
    const res1 = await request(app).get('/api/news/btc-case1').set(AUTH);
    const res2 = await request(app).get('/api/news/BTC-CASE1').set(AUTH);
    // Both return the same data (second comes from cache)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body).toEqual(res2.body);
    // Fetch should only be called once (NewsData.io attempt)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Caching ───────────────────────────────────────────────────────────────────

describe('GET /api/news/:symbol — caching', () => {
  it('serves cached response on second request without calling fetch again', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false }); // first: fails → fallback cached

    await request(app).get('/api/news/SOL-cache1').set(AUTH); // populates cache
    await request(app).get('/api/news/SOL-cache1').set(AUTH); // should use cache

    // fetch only called once (for the first request)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns identical data on cache hit', async () => {
    const res1 = await request(app).get('/api/news/ADA-cache1').set(AUTH);
    const res2 = await request(app).get('/api/news/ADA-cache1').set(AUTH);
    expect(res1.body).toEqual(res2.body);
  });

  it('fetches fresh data for a different symbol (no cache sharing)', async () => {
    await request(app).get('/api/news/LTC-fresh1').set(AUTH);
    await request(app).get('/api/news/XRP-fresh1').set(AUTH);
    // Each unique symbol triggers one fetch attempt
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ─── NewsData.io success path ──────────────────────────────────────────────────

describe('GET /api/news/:symbol — NewsData.io success', () => {
  it('returns news from NewsData.io when CryptoPanic key is absent', async () => {
    const newsDataResponse = {
      results: [
        { title: 'Bitcoin ETF approved', link: 'https://newsdata.io/btc-1', source_id: 'NewsData', pubDate: '2024-01-01T00:00:00Z' },
        { title: 'BTC volume surges',    link: 'https://newsdata.io/btc-2', source_id: 'NewsData', pubDate: '2024-01-02T00:00:00Z' },
      ],
    };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => newsDataResponse });

    const res = await request(app).get('/api/news/BTC-newsdata1').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Bitcoin ETF approved');
    expect(res.body[0].url).toBe('https://newsdata.io/btc-1');
    expect(res.body[0].source).toBe('NewsData');
  });

  it('filters out items missing title or url', async () => {
    const newsDataResponse = {
      results: [
        { title: 'Good article',  link: 'https://good.com', source_id: 'Src', pubDate: '2024-01-01' },
        { title: null,            link: 'https://notitle.com', source_id: 'Src', pubDate: '2024-01-01' },
        { title: 'No link item',  link: null, source_id: 'Src', pubDate: '2024-01-01' },
      ],
    };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => newsDataResponse });

    const res = await request(app).get('/api/news/BTC-newsdata2').set(AUTH);
    expect(res.body.every(n => n.title && n.url)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('falls through to hardcoded fallback when NewsData returns empty results', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });

    const res = await request(app).get('/api/news/BTC-newsdata3').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3); // hardcoded fallback
  });
});

// ─── CryptoPanic path ──────────────────────────────────────────────────────────

describe('GET /api/news/:symbol — CryptoPanic', () => {
  beforeEach(() => {
    process.env.CRYPTOPANIC_API_KEY = 'fake-key';
  });

  afterEach(() => {
    delete process.env.CRYPTOPANIC_API_KEY;
  });

  it('uses CryptoPanic when API key is set and response is ok', async () => {
    const cpResponse = {
      results: [
        { title: 'BTC news from CP', url: 'https://cryptopanic.com/1', source: { title: 'CP Source' }, published_at: '2024-01-01T00:00:00Z' },
      ],
    };
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => cpResponse });

    const res = await request(app).get('/api/news/BTC-cp1').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('BTC news from CP');
    expect(res.body[0].source).toBe('CP Source');
  });

  it('falls through to NewsData when CryptoPanic returns no results', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })  // CryptoPanic: empty
      .mockResolvedValueOnce({ ok: false });                                       // NewsData: fails → hardcoded fallback

    const res = await request(app).get('/api/news/BTC-cp2').set(AUTH);
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls through to NewsData when CryptoPanic returns non-ok status', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false })  // CryptoPanic fails
      .mockResolvedValueOnce({ ok: false }); // NewsData fails → hardcoded fallback

    const res = await request(app).get('/api/news/BTC-cp3').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3); // hardcoded fallback
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('caps CryptoPanic results at 5 items', async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      title: `News ${i}`, url: `https://cp.com/${i}`,
      source: { title: 'CP' }, published_at: '2024-01-01T00:00:00Z',
    }));
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: manyResults }) });

    const res = await request(app).get('/api/news/BTC-cp4').set(AUTH);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });
});
