import api from './client';

export interface WatchlistItem {
  id:          string;
  user_id:     string;
  coin_id:     string;
  coin_symbol: string;
  coin_name:   string | null;
  added_at:    string;
  price:       number | null;
  change_24h:  number | null;
  image:       string | null;
}

export const getWatchlist = () =>
  api.get<WatchlistItem[]>('/api/watchlist');

export const addToWatchlist = (data: { coin_id: string; coin_symbol: string; coin_name?: string }) =>
  api.post<WatchlistItem>('/api/watchlist', data);

export const removeFromWatchlist = (coinId: string) =>
  api.delete<{ deleted: boolean }>(`/api/watchlist/${coinId}`);
