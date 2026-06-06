import api from './client';
import type { CoinPrice } from './dashboard';

export interface CoinDetail {
  id: string; name: string; symbol: string; image: string;
  price: number; change_24h: number; change_7d: number; change_30d: number;
  market_cap: number; volume_24h: number; circulating_supply: number;
  ath: number; ath_date: string | null;
}

export interface ChartPoint { ts: number; price: number; }

export const getCoinDetail = (id: string) =>
  api.get<CoinDetail>(`/api/coins/${id}`);

export const getCoinChart = (id: string, days: 7 | 30 = 7) =>
  api.get<ChartPoint[]>(`/api/coins/${id}/chart?days=${days}`);

export const getMarketCoins = (page = 2, perPage = 10) =>
  api.get<CoinPrice[]>('/api/coins/market', { params: { page, per_page: perPage } });
