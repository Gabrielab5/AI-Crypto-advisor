process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');
const pool    = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

const USER_ID = 'user-uuid-1';
const TOKEN   = jwt.sign({ id: USER_ID, email: 'test@test.com' }, 'test-secret');
const AUTH    = { Authorization: `Bearer ${TOKEN}` };

const PREFS = { user_id: USER_ID, interested_assets: ['BTC','ETH'], investor_type: 'hodler', content_types: ['market_news'], theme_preference: 'dark' };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/preferences', () => {
  it('returns saved preferences', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PREFS] });
    const res = await request(app).get('/api/preferences').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.investor_type).toBe('hodler');
    expect(res.body.interested_assets).toEqual(['BTC','ETH']);
  });

  it('returns empty defaults when no prefs exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/preferences').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.interested_assets).toEqual([]);
    expect(res.body.investor_type).toBeNull();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/preferences');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/preferences', () => {
  it('saves preferences and returns them', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PREFS] });
    const res = await request(app).post('/api/preferences').set(AUTH).send({ interested_assets: ['BTC'], investor_type: 'hodler', content_types: ['coin_prices'] });
    expect(res.status).toBe(200);
    expect(res.body.investor_type).toBe('hodler');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/preferences').set(AUTH).send({ interested_assets: ['BTC'] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when arrays are empty', async () => {
    const res = await request(app).post('/api/preferences').set(AUTH).send({ interested_assets: [], investor_type: 'hodler', content_types: ['news'] });
    expect(res.status).toBe(400);
  });
});
