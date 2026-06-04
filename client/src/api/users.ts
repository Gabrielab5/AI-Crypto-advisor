import api from './client';

export const getMe = () => api.get('/api/users/me');

export const updatePreferences = (data: {
  interested_assets?: string[];
  investor_type?: string;
  content_types?: string[];
}) => api.patch('/api/users/preferences', data);
