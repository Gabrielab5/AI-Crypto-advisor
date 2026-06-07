import api from './client';

export const register = (data: { name: string; email: string; password: string }) =>
  api.post('/api/auth/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post('/api/auth/login', data);

export const requestPasswordReset = (email: string) =>
  api.post('/api/auth/request-password-reset', { email });

export const resetPassword = (token: string, password: string) =>
  api.post('/api/auth/reset-password', { token, password });
