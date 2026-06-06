import { describe, it, expect, beforeEach } from 'vitest';
import api from '../api/client';

// Access the fulfilled handler of the first request interceptor.
// Axios 1.x stores interceptors in interceptors.request.handlers[].
function getRequestInterceptor() {
  const handlers = (api.interceptors.request as any).handlers as Array<{ fulfilled: Function } | null>;
  const handler = handlers.find(h => h !== null);
  if (!handler) throw new Error('No request interceptor registered');
  return handler.fulfilled;
}

describe('api client — request interceptor', () => {
  beforeEach(() => localStorage.clear());

  it('injects Authorization header when a token is stored', () => {
    localStorage.setItem('token', 'my-test-token');

    const config = { headers: {} as Record<string, string> };
    const result = getRequestInterceptor()(config);

    expect(result.headers['Authorization']).toBe('Bearer my-test-token');
  });

  it('does not add Authorization header when localStorage has no token', () => {
    const config = { headers: {} as Record<string, string> };
    const result = getRequestInterceptor()(config);

    expect(result.headers['Authorization']).toBeUndefined();
  });

  it('preserves existing headers when injecting the token', () => {
    localStorage.setItem('token', 'abc');

    const config = { headers: { 'Content-Type': 'application/json' } as Record<string, string> };
    const result = getRequestInterceptor()(config);

    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Authorization']).toBe('Bearer abc');
  });

  it('returns the config object (not a copy)', () => {
    const config = { headers: {} as Record<string, string> };
    const result = getRequestInterceptor()(config);
    expect(result).toBe(config);
  });
});

describe('api client — base configuration', () => {
  it('uses http://localhost:5000 as the default base URL', () => {
    expect((api.defaults as any).baseURL).toBe('http://localhost:5000');
  });
});
