import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
    patch:  vi.fn(),
  },
}));

import api from '../api/client';
import { castVote, deleteVote, getVotes, getVotesSummary } from '../api/votes';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../api/watchlist';
import { getMe, updatePreferences } from '../api/users';

const mockedGet    = vi.mocked(api.get);
const mockedPost   = vi.mocked(api.post);
const mockedDelete = vi.mocked(api.delete);
const mockedPatch  = vi.mocked(api.patch);

beforeEach(() => vi.clearAllMocks());

// ─── votes.ts ────────────────────────────────────────────────────────────────

describe('castVote', () => {
  it('calls POST /api/votes with up vote', () => {
    castVote({ section: 'coin_prices', item_id: 'bitcoin', vote: 'up' });
    expect(mockedPost).toHaveBeenCalledWith('/api/votes', {
      section: 'coin_prices', item_id: 'bitcoin', vote: 'up',
    });
  });

  it('calls POST /api/votes with down vote', () => {
    castVote({ section: 'market_news', item_id: 'news-1', vote: 'down' });
    expect(mockedPost).toHaveBeenCalledWith('/api/votes', {
      section: 'market_news', item_id: 'news-1', vote: 'down',
    });
  });
});

describe('deleteVote', () => {
  it('calls DELETE /api/votes with body payload', () => {
    deleteVote({ section: 'coin_prices', item_id: 'bitcoin' });
    expect(mockedDelete).toHaveBeenCalledWith('/api/votes', {
      data: { section: 'coin_prices', item_id: 'bitcoin' },
    });
  });
});

describe('getVotes', () => {
  it('calls GET /api/votes with empty params when no section given', () => {
    getVotes();
    expect(mockedGet).toHaveBeenCalledWith('/api/votes', { params: {} });
  });

  it('calls GET /api/votes with section filter when provided', () => {
    getVotes('coin_prices');
    expect(mockedGet).toHaveBeenCalledWith('/api/votes', {
      params: { section: 'coin_prices' },
    });
  });
});

describe('getVotesSummary', () => {
  it('calls GET /api/votes/summary', () => {
    getVotesSummary();
    expect(mockedGet).toHaveBeenCalledWith('/api/votes/summary');
  });
});

// ─── watchlist.ts ─────────────────────────────────────────────────────────────

describe('getWatchlist', () => {
  it('calls GET /api/watchlist', () => {
    getWatchlist();
    expect(mockedGet).toHaveBeenCalledWith('/api/watchlist');
  });
});

describe('addToWatchlist', () => {
  it('calls POST /api/watchlist with required fields', () => {
    addToWatchlist({ coin_id: 'bitcoin', coin_symbol: 'BTC' });
    expect(mockedPost).toHaveBeenCalledWith('/api/watchlist', {
      coin_id: 'bitcoin', coin_symbol: 'BTC',
    });
  });

  it('calls POST /api/watchlist with optional coin_name', () => {
    addToWatchlist({ coin_id: 'bitcoin', coin_symbol: 'BTC', coin_name: 'Bitcoin' });
    expect(mockedPost).toHaveBeenCalledWith('/api/watchlist', {
      coin_id: 'bitcoin', coin_symbol: 'BTC', coin_name: 'Bitcoin',
    });
  });
});

describe('removeFromWatchlist', () => {
  it('calls DELETE /api/watchlist/:coinId', () => {
    removeFromWatchlist('bitcoin');
    expect(mockedDelete).toHaveBeenCalledWith('/api/watchlist/bitcoin');
  });
});

// ─── users.ts ─────────────────────────────────────────────────────────────────

describe('getMe', () => {
  it('calls GET /api/users/me', () => {
    getMe();
    expect(mockedGet).toHaveBeenCalledWith('/api/users/me');
  });
});

describe('updatePreferences', () => {
  it('calls PATCH /api/users/preferences with provided data', () => {
    updatePreferences({ interested_assets: ['BTC'], investor_type: 'hodler' });
    expect(mockedPatch).toHaveBeenCalledWith('/api/users/preferences', {
      interested_assets: ['BTC'], investor_type: 'hodler',
    });
  });

  it('calls PATCH with only theme_preference when others are omitted', () => {
    updatePreferences({ content_types: ['market_news'] });
    expect(mockedPatch).toHaveBeenCalledWith('/api/users/preferences', {
      content_types: ['market_news'],
    });
  });
});
