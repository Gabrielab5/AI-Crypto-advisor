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
  triggered_alerts: TriggeredAlert[];
  stale?:           boolean;
  fetched_at:       string;
}

export type { TriggeredAlert };
export const getDashboard = () => api.get<DashboardData>('/api/dashboard');
