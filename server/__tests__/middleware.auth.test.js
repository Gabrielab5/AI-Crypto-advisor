process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV   = 'test';

const jwt         = require('jsonwebtoken');
const { requireAuth } = require('../src/middleware/auth');

function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const next = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('requireAuth middleware', () => {
  it('calls next() and attaches user when token is valid', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com' }, 'test-secret');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.id).toBe('u1');
    expect(req.user.email).toBe('a@b.com');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is absent', () => {
    const req = makeReq(undefined);
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with "Bearer "', () => {
    const req = makeReq('Token abc123');
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ id: 'u1' }, 'test-secret', { expiresIn: -1 });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is signed with a different secret', () => {
    const token = jwt.sign({ id: 'u1' }, 'wrong-secret');
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed token string', () => {
    const req = makeReq('Bearer not.a.valid.jwt');
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when "Bearer " prefix is present but token part is empty', () => {
    const req = makeReq('Bearer ');
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
