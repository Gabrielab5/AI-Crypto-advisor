process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const app     = require('../src/app');
const pool    = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({ query: jest.fn() }));

const FAKE_USER = { id: 'uuid-1', name: 'Test', email: 'test@test.com', password_hash: '', created_at: new Date(), reset_token: null, reset_token_expiry: null };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auth/register', () => {
  it('registers a new user and returns JWT', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: FAKE_USER.id, name: 'Test', email: 'test@test.com', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'test@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@test.com');
  });

  it('returns 409 on duplicate email', async () => {
    pool.query.mockRejectedValueOnce({ code: '23505' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'test@test.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns JWT on valid credentials', async () => {
    const hash = await bcrypt.hash('password123', 10);
    pool.query.mockResolvedValueOnce({ rows: [{ ...FAKE_USER, password_hash: hash }] });

    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    pool.query.mockResolvedValueOnce({ rows: [{ ...FAKE_USER, password_hash: hash }] });

    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 401 when email not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({ email: 'no@no.com', password: 'pw' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/request-password-reset', () => {
  it('returns 404 with descriptive error when email is not registered', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // email not found
    const res = await request(app).post('/api/auth/request-password-reset').send({ email: 'no@no.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no account found/i);
  });

  it('returns 200 and sends reset link when email is registered', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app).post('/api/auth/request-password-reset').send({ email: 'test@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link sent/i);
  });

  it('generates and stores a reset token when email is registered', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE
    await request(app).post('/api/auth/request-password-reset').send({ email: 'test@test.com' });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET reset_token'),
      expect.arrayContaining([expect.any(String), expect.any(Date), 'uuid-1'])
    );
  });

  it('returns 400 when email field is missing', async () => {
    const res = await request(app).post('/api/auth/request-password-reset').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('resets password with valid token', async () => {
    const user = { ...FAKE_USER };
    pool.query
      .mockResolvedValueOnce({ rows: [user] })    // find by token
      .mockResolvedValueOnce({ rows: [] });        // UPDATE

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'valid-token', password: 'newpassword' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password reset successfully');
  });

  it('returns 400 for expired/invalid token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'bad', password: 'newpass' });
    expect(res.status).toBe(400);
  });
});
