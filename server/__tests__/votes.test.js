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
const VOTE    = { id:'v1', user_id: USER_ID, section:'coin_prices', item_id:'main', vote:1, created_at: new Date() };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/votes', () => {
  it('accepts "up" vote', async () => {
    pool.query.mockResolvedValueOnce({ rows: [VOTE] });
    const res = await request(app).post('/api/votes').set(AUTH).send({ section:'coin_prices', item_id:'main', vote:'up' });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [USER_ID, 'coin_prices', 'main', 1]);
  });

  it('accepts "down" vote', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...VOTE, vote: -1 }] });
    const res = await request(app).post('/api/votes').set(AUTH).send({ section:'coin_prices', item_id:'main', vote:'down' });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [USER_ID, 'coin_prices', 'main', -1]);
  });

  it('accepts numeric 1 vote (legacy)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [VOTE] });
    const res = await request(app).post('/api/votes').set(AUTH).send({ section:'news', item_id:'n1', vote:1 });
    expect(res.status).toBe(200);
  });

  it('rejects invalid vote values', async () => {
    const res = await request(app).post('/api/votes').set(AUTH).send({ section:'news', item_id:'n1', vote:'sideways' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/votes').send({ section:'news', item_id:'n1', vote:'up' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/votes', () => {
  it('returns all votes for user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [VOTE] });
    const res = await request(app).get('/api/votes').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filters by section when query param provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [VOTE] });
    const res = await request(app).get('/api/votes?section=coin_prices').set(AUTH);
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('section'), expect.arrayContaining([USER_ID, 'coin_prices']));
  });
});
