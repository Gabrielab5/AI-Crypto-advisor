import api from './client';

export const register = (data: { name: string; email: string; password: string }) =>
  api.post('/api/auth/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post('/api/auth/login', data);
