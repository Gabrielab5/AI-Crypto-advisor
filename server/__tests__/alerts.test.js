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

const ALERT = {
  id: 'alert-1', user_id: USER_ID, coin_id: 'bitcoin',
  coin_symbol: 'BTC', coin_name: 'Bitcoin',
  condition: 'above', target_price: 70000,
  triggered: false, triggered_at: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/alerts', () => {
  it('returns list of active alerts for authenticated user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [ALERT] });

    const res = await request(app).get('/api/alerts').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].coin_id).toBe('bitcoin');
    expect(res.body[0].condition).toBe('above');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('triggered = FALSE'),
      [USER_ID]
    );
  });

  it('returns empty array when user has no alerts', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/alerts').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/alerts', () => {
  it('creates a new alert and returns 201', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // cap check
      .mockResolvedValueOnce({ rows: [ALERT] });          // INSERT RETURNING

    const res = await request(app).post('/api/alerts').set(AUTH).send({
      coin_id: 'bitcoin', coin_symbol: 'BTC', coin_name: 'Bitcoin',
      condition: 'above', target_price: 70000,
    });

    expect(res.status).toBe(201);
    expect(res.body.coin_id).toBe('bitcoin');
    expect(res.body.condition).toBe('above');
  });

  it('falls back to coin_symbol when coin_name is omitted', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ ...ALERT, coin_name: 'BTC' }] });

    await request(app).post('/api/alerts').set(AUTH).send({
      coin_id: 'bitcoin', coin_symbol: 'BTC', condition: 'below', target_price: 50000,
    });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO price_alerts'),
      [USER_ID, 'bitcoin', 'BTC', 'BTC', 'below', 50000]
    );
  });

  it('returns 400 when coin_symbol is missing', async () => {
    const res = await request(app).post('/api/alerts').set(AUTH).send({
      coin_id: 'bitcoin', condition: 'above', target_price: 70000,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when target_price is missing', async () => {
    const res = await request(app).post('/api/alerts').set(AUTH).send({
      coin_id: 'bitcoin', coin_symbol: 'BTC', condition: 'above',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid condition value', async () => {
    const res = await request(app).post('/api/alerts').set(AUTH).send({
      coin_id: 'bitcoin', coin_symbol: 'BTC', condition: 'equal', target_price: 70000,
    });
    expect(res.status).toBe(400);
  });

  it('returns 422 when user has reached the 10-alert cap', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

    const res = await request(app).post('/api/alerts').set(AUTH).send({
      coin_id: 'bitcoin', coin_symbol: 'BTC', condition: 'above', target_price: 70000,
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Maximum 10/);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/alerts').send({
      coin_id: 'bitcoin', coin_symbol: 'BTC', condition: 'above', target_price: 70000,
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/alerts/:id', () => {
  it('deletes an alert owned by the user', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/alerts/alert-1').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM price_alerts'),
      ['alert-1', USER_ID]
    );
  });

  it('returns 404 when alert does not exist or belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app).delete('/api/alerts/nonexistent').set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Alert not found');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/alerts/alert-1');
    expect(res.status).toBe(401);
  });
});
