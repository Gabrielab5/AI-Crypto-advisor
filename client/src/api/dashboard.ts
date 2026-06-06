import api from './client';
import type { TriggeredAlert } from './alerts';

export interface CoinPrice {
  id: string; name: string; symbol: string; image: string;
  price: number; change_24h: number; market_cap: number;
}
export interface NewsItem {
  id: string; title: string; url: string; source: string; published_at: string;
}
export interface AIInsight {
  text: string; model: string; generated_at: string;
}
export interface Meme {
  id: string; title: string; imageUrl: string;
}
export interface DashboardData {
  coin_prices:      CoinPrice[];
  market_news:      NewsItem[];
  ai_insight:       AIInsight | null;
  meme:             Meme | null;
  memes?:           Meme[];
  triggered_alerts: TriggeredAlert[];
  stale?:           boolean;
  fetched_at:       string;
}

export interface DashboardParams {
  section?:       string;
  bypass_cache?:  boolean;
}

export type { TriggeredAlert };
export const getDashboard = (params?: DashboardParams) =>
  api.get<DashboardData>('/api/dashboard', { params });

export const getInsight = () =>
  api.get<{ ai_insight: AIInsight; fetched_at: string }>('/api/dashboard/insight');
