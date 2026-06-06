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

const PROFILE = {
  id: USER_ID, name: 'Test User', email: 'test@test.com',
  created_at: new Date().toISOString(),
  interested_assets: ['BTC', 'ETH'],
  investor_type: 'hodler',
  content_types: ['coin_prices', 'market_news'],
  theme_preference: 'dark',
};

beforeEach(() => jest.clearAllMocks());

// ─── GET /api/users/me ───────────────────────────────────────────────────────

describe('GET /api/users/me', () => {
  it('returns user profile with preferences for authenticated user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PROFILE] });

    const res = await request(app).get('/api/users/me').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(USER_ID);
    expect(res.body.email).toBe('test@test.com');
    expect(res.body.investor_type).toBe('hodler');
    expect(res.body.interested_assets).toEqual(['BTC', 'ETH']);
    expect(res.body.theme_preference).toBe('dark');
    // password_hash must never be returned
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 404 when user is not found in the database', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/users/me').set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('queries with the correct user ID from the JWT', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PROFILE] });

    await request(app).get('/api/users/me').set(AUTH);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE u.id = $1'),
      [USER_ID]
    );
  });

  it('includes preferences fields from LEFT JOIN', async () => {
    pool.query.mockResolvedValueOnce({ rows: [PROFILE] });

    const res = await request(app).get('/api/users/me').set(AUTH);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('user_preferences'),
      expect.any(Array)
    );
    expect(res.body.content_types).toEqual(['coin_prices', 'market_news']);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/users/preferences ────────────────────────────────────────────

describe('PATCH /api/users/preferences', () => {
  const UPDATED_PREFS = {
    user_id: USER_ID, interested_assets: ['SOL'],
    investor_type: 'trader', content_types: ['coin_prices'],
    theme_preference: 'light',
  };

  it('upserts all preference fields and returns updated row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [UPDATED_PREFS] });

    const res = await request(app).patch('/api/users/preferences').set(AUTH).send({
      interested_assets: ['SOL'], investor_type: 'trader',
      content_types: ['coin_prices'], theme_preference: 'light',
    });

    expect(res.status).toBe(200);
    expect(res.body.investor_type).toBe('trader');
    expect(res.body.interested_assets).toEqual(['SOL']);
    expect(res.body.theme_preference).toBe('light');
  });

  it('sends null for theme_preference when omitted (COALESCE keeps existing)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [UPDATED_PREFS] });

    await request(app).patch('/api/users/preferences').set(AUTH).send({
      interested_assets: ['BTC'], investor_type: 'hodler', content_types: ['market_news'],
    });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      [USER_ID, ['BTC'], 'hodler', ['market_news'], null]
    );
  });

  it('partial body is accepted (other fields will be COALESCE-preserved by DB)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [UPDATED_PREFS] });

    const res = await request(app).patch('/api/users/preferences').set(AUTH).send({
      theme_preference: 'dark',
    });

    expect(res.status).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/users/preferences').send({
      interested_assets: ['BTC'], investor_type: 'hodler', content_types: [],
    });
    expect(res.status).toBe(401);
  });
});
