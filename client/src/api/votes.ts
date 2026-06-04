import api from './client';

export const castVote = (data: { section: string; item_id: string; vote: 1 | -1 }) =>
  api.post('/api/votes', data);

export const getVotes = (section?: string) =>
  api.get('/api/votes', { params: section ? { section } : {} });
