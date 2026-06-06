import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api/client';
import { getAlerts, createAlert, deleteAlert } from '../api/alerts';

const mockedGet    = vi.mocked(api.get);
const mockedPost   = vi.mocked(api.post);
const mockedDelete = vi.mocked(api.delete);

beforeEach(() => vi.clearAllMocks());

describe('getAlerts', () => {
  it('calls GET /api/alerts', () => {
    getAlerts();
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith('/api/alerts');
  });
});

describe('createAlert', () => {
  it('calls POST /api/alerts with the full body', () => {
    const payload = {
      coin_id: 'bitcoin', coin_symbol: 'BTC', coin_name: 'Bitcoin',
      condition: 'above' as const, target_price: 70000,
    };

    createAlert(payload);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith('/api/alerts', payload);
  });

  it('calls POST /api/alerts with "below" condition', () => {
    const payload = {
      coin_id: 'ethereum', coin_symbol: 'ETH', coin_name: 'Ethereum',
      condition: 'below' as const, target_price: 2000,
    };

    createAlert(payload);

    expect(mockedPost).toHaveBeenCalledWith('/api/alerts', payload);
  });
});

describe('deleteAlert', () => {
  it('calls DELETE /api/alerts/:id with the given id', () => {
    deleteAlert('alert-abc-123');

    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('/api/alerts/alert-abc-123');
  });
});
