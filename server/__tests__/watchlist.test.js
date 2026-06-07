process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');
const pool    = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

global.fetch = jest.fn();

const USER_ID = 'user-uuid-1';
const TOKEN   = jwt.sign({ id: USER_ID, email: 'test@test.com' }, 'test-secret');
const AUTH    = { Authorization: `Bearer ${TOKEN}` };

const ITEM = {
  id: 'wl-1', user_id: USER_ID, coin_id: 'bitcoin',
  coin_symbol: 'BTC', coin_name: 'Bitcoin',
  added_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockResolvedValue({ ok: false }); // default: price fetch fails gracefully
});

describe('GET /api/watchlist', () => {
  it('returns empty array when watchlist is empty', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/watchlist').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns watchlist items (without prices when CoinGecko fails)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [ITEM] });
    const res = await request(app).get('/api/watchlist').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].coin_id).toBe('bitcoin');
    expect(res.body[0].price).toBeNull();
  });

  it('enriches items from server-side dashboard price cache', async () => {
    // The dashboard module caches coin prices at module level (mockCoins as fallback).
    // Watchlist reads from that cache — no CoinGecko call needed.
    const { getCachedCoinPrices } = require('../src/routes/dashboard');
    pool.query.mockResolvedValueOnce({ rows: [ITEM] });
    const res = await request(app).get('/api/watchlist').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body[0].coin_id).toBe('bitcoin');
    // Price comes from cache — assert it's a number when cache has data, or null when empty
    const cached = getCachedCoinPrices();
    const btc    = cached.find(c => c.id === 'bitcoin');
    const expectedPrice = btc ? (btc.current_price ?? btc.price ?? null) : null;
    expect(res.body[0].price).toBe(expectedPrice);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/watchlist');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/watchlist', () => {
  it('adds a coin to watchlist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [ITEM] });
    const res = await request(app).post('/api/watchlist').set(AUTH)
      .send({ coin_id: 'bitcoin', coin_symbol: 'BTC', coin_name: 'Bitcoin' });
    expect(res.status).toBe(201);
    expect(res.body.coin_id).toBe('bitcoin');
  });

  it('rejects duplicate add (409 conflict)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING → no rows
    const res = await request(app).post('/api/watchlist').set(AUTH)
      .send({ coin_id: 'bitcoin', coin_symbol: 'BTC' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Already in watchlist');
  });

  it('requires coin_id and coin_symbol', async () => {
    const res = await request(app).post('/api/watchlist').set(AUTH).send({ coin_id: 'bitcoin' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/watchlist/:coin_id', () => {
  it('removes a coin from watchlist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/watchlist/bitcoin').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String), [USER_ID, 'bitcoin']
    );
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/watchlist/bitcoin');
    expect(res.status).toBe(401);
  });
});
