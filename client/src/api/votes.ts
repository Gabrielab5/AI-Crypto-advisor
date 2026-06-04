import api from './client';

export interface VoteRecord {
  id: string;
  user_id: string;
  section: string;
  item_id: string;
  vote: 1 | -1;
}

export const castVote = (data: { section: string; item_id: string; vote: 'up' | 'down' }) =>
  api.post<VoteRecord>('/api/votes', data);

export const getVotes = (section?: string) =>
  api.get<VoteRecord[]>('/api/votes', { params: section ? { section } : {} });
