import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from '../api/client';
import { login, register, requestPasswordReset, resetPassword } from '../api/auth';

const mockedPost = vi.mocked(api.post);

beforeEach(() => vi.clearAllMocks());

describe('login', () => {
  it('calls POST /api/auth/login with email and password', () => {
    login({ email: 'user@example.com', password: 'secret' });
    expect(mockedPost).toHaveBeenCalledWith('/api/auth/login', {
      email: 'user@example.com',
      password: 'secret',
    });
  });
});

describe('register', () => {
  it('calls POST /api/auth/register with name, email and password', () => {
    register({ name: 'Alice', email: 'alice@example.com', password: 'pass123' });
    expect(mockedPost).toHaveBeenCalledWith('/api/auth/register', {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'pass123',
    });
  });
});

describe('requestPasswordReset', () => {
  it('calls POST /api/auth/request-password-reset with the email', () => {
    requestPasswordReset('user@example.com');
    expect(mockedPost).toHaveBeenCalledWith('/api/auth/request-password-reset', {
      email: 'user@example.com',
    });
  });

  it('passes different email addresses correctly', () => {
    requestPasswordReset('other@domain.io');
    expect(mockedPost).toHaveBeenCalledWith('/api/auth/request-password-reset', {
      email: 'other@domain.io',
    });
  });
});

describe('resetPassword', () => {
  it('calls POST /api/auth/reset-password with token and password', () => {
    resetPassword('abc123token', 'newpassword');
    expect(mockedPost).toHaveBeenCalledWith('/api/auth/reset-password', {
      token: 'abc123token',
      password: 'newpassword',
    });
  });

  it('passes the token verbatim', () => {
    const token = 'deadbeef1234567890abcdef';
    resetPassword(token, 'secure!pass');
    expect(mockedPost).toHaveBeenCalledWith('/api/auth/reset-password', {
      token,
      password: 'secure!pass',
    });
  });
});
