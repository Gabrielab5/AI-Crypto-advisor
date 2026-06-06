import api from './client';

export interface VoteRecord {
  id: string;
  user_id: string;
  section: string;
  item_id: string;
  vote: 1 | -1;
}

export interface VotesSummary {
  liked:    string[];
  disliked: string[];
}

export const castVote = (data: { section: string; item_id: string; vote: 'up' | 'down' }) =>
  api.post<VoteRecord>('/api/votes', data);

export const deleteVote = (data: { section: string; item_id: string }) =>
  api.delete<{ deleted: boolean }>('/api/votes', { data });

export const getVotes = (section?: string) =>
  api.get<VoteRecord[]>('/api/votes', { params: section ? { section } : {} });

export const getVotesSummary = () =>
  api.get<VotesSummary>('/api/votes/summary');
