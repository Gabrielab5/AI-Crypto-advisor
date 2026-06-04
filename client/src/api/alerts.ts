import api from './client';

export interface PriceAlert {
  id: string;
  user_id: string;
  coin_id: string;
  coin_symbol: string;
  coin_name: string;
  condition: 'above' | 'below';
  target_price: number;
  triggered: boolean;
  triggered_at: string | null;
  created_at: string;
}

export interface TriggeredAlert extends PriceAlert {
  current_price: number;
}

export const getAlerts    = ()                                                         => api.get<PriceAlert[]>('/api/alerts');
export const createAlert  = (d: { coin_id:string; coin_symbol:string; coin_name:string; condition:'above'|'below'; target_price:number }) => api.post<PriceAlert>('/api/alerts', d);
export const deleteAlert  = (id: string)                                               => api.delete(`/api/alerts/${id}`);
