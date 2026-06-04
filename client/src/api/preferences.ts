import api from './client';

export interface Preferences {
  user_id: string;
  interested_assets: string[];
  investor_type: string | null;
  content_types: string[];
}

export const getPreferences = () =>
  api.get<Preferences>('/api/preferences');

export const savePreferences = (data: {
  interested_assets: string[];
  investor_type: string;
  content_types: string[];
}) => api.post<Preferences>('/api/preferences', data);
