import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../api/client';
import { getCoinDetail, getCoinChart, getMarketCoins } from '../api/coins';

const mockedGet = vi.mocked(api.get);

beforeEach(() => vi.clearAllMocks());

describe('getCoinDetail', () => {
  it('calls GET /api/coins/:id', () => {
    getCoinDetail('bitcoin');
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/bitcoin');
  });

  it('uses the provided coin id in the URL', () => {
    getCoinDetail('ethereum');
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/ethereum');
  });
});

describe('getCoinChart', () => {
  it('calls GET /api/coins/:id/chart with default days=7', () => {
    getCoinChart('bitcoin');
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/bitcoin/chart?days=7');
  });

  it('calls with days=30 when specified', () => {
    getCoinChart('bitcoin', 30);
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/bitcoin/chart?days=30');
  });

  it('uses the provided coin id in the chart URL', () => {
    getCoinChart('solana', 7);
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/solana/chart?days=7');
  });
});

describe('getMarketCoins', () => {
  it('calls GET /api/coins/market with default page=2, per_page=10', () => {
    getMarketCoins();
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/market', {
      params: { page: 2, per_page: 10 },
    });
  });

  it('passes custom page and per_page params', () => {
    getMarketCoins(3, 5);
    expect(mockedGet).toHaveBeenCalledWith('/api/coins/market', {
      params: { page: 3, per_page: 5 },
    });
  });
});
