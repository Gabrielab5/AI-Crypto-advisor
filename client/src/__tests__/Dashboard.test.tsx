import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Dashboard from '../pages/Dashboard';

vi.mock('../api/dashboard',  () => ({ getDashboard:  vi.fn() }));
vi.mock('../api/votes',      () => ({ getVotes: vi.fn(), castVote: vi.fn(), deleteVote: vi.fn() }));
vi.mock('../api/preferences',() => ({ getPreferences: vi.fn() }));
vi.mock('../api/alerts',     () => ({ deleteAlert: vi.fn().mockResolvedValue({}) }));
vi.mock('../api/watchlist',  () => ({
  getWatchlist:        vi.fn().mockResolvedValue({ data: [] }),
  addToWatchlist:      vi.fn(),
  removeFromWatchlist: vi.fn(),
}));
vi.mock('../api/coins', () => ({ getMarketCoins: vi.fn() }));

import * as dashApi  from '../api/dashboard';
import * as votesApi from '../api/votes';
import * as prefsApi from '../api/preferences';
import * as coinsApi from '../api/coins';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => vi.fn() };
});

const MEMES = [
  { id:'1', title:'Test meme 1', imageUrl:'https://example.com/m1.png' },
  { id:'2', title:'Test meme 2', imageUrl:'https://example.com/m2.png' },
];

const DASH_DATA = {
  coin_prices: [{ id:'bitcoin', name:'Bitcoin', symbol:'BTC', image:'', price:60000, change_24h:2.5, market_cap:1e12 }],
  market_news: [{ id:'n1', title:'BTC hits ATH', url:'https://coindesk.com', source:'CoinDesk', published_at: new Date().toISOString() }],
  ai_insight:  { text: 'Test insight', model: 'test', generated_at: new Date().toISOString() },
  meme:        MEMES[0],
  memes:       MEMES,
  stale: false,
  fetched_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('token', 'valid-token');
  localStorage.setItem('user', JSON.stringify({ id:'1', name:'Alice', email:'a@b.com' }));
  (prefsApi.getPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { interested_assets: ['BTC'], investor_type: 'hodler', content_types: [] },
  });
  (dashApi.getDashboard  as ReturnType<typeof vi.fn>).mockResolvedValue({ data: DASH_DATA });
  (votesApi.getVotes     as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  (votesApi.castVote     as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  (votesApi.deleteVote   as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { deleted: true } });
});

function Wrapper() {
  return <ThemeProvider><AuthProvider><MemoryRouter><Dashboard /></MemoryRouter></AuthProvider></ThemeProvider>;
}

// ─── Core rendering ────────────────────────────────────────────────────────

test('shows loading ticker initially (Coin Prices card)', () => {
  render(<Wrapper />);
  // The ticker contains BTC in the animated strip
  expect(document.querySelector('.animate-ticker')).toBeTruthy();
});

test('renders all 4 sections after load', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Coin Prices')).toBeInTheDocument());
  expect(screen.getByText('Market News')).toBeInTheDocument();
  expect(screen.getByText('AI Insight')).toBeInTheDocument();
  expect(screen.getByText('Meme of the Day')).toBeInTheDocument();
});

test('renders coin price data', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('BTC')).toBeInTheDocument());
  expect(screen.getByText('$60,000')).toBeInTheDocument();
});

test('renders AI insight text', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Test insight')).toBeInTheDocument());
});

// ─── Vote toast logic ──────────────────────────────────────────────────────

test('first vote shows "Preference saved ✓" toast', async () => {
  render(<Wrapper />);
  await waitFor(() => screen.getByText('Coin Prices'));
  const upBtns = screen.getAllByTitle('Helpful');
  await userEvent.click(upBtns[0]);
  await waitFor(() => expect(screen.getByText('Preference saved ✓')).toBeInTheDocument());
});

test('switching vote shows "Preference updated ✓" toast', async () => {
  // Pre-set an existing up vote for coin_prices_main
  (votesApi.getVotes as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ section: 'coin_prices', item_id: 'main', vote: 1 }],
  });
  render(<Wrapper />);
  await waitFor(() => screen.getByText('Coin Prices'));
  const downBtns = screen.getAllByTitle('Not helpful');
  await userEvent.click(downBtns[0]);
  await waitFor(() => expect(screen.getByText('Preference updated ✓')).toBeInTheDocument());
});

test('same vote silently calls deleteVote (no toast)', async () => {
  (votesApi.getVotes as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ section: 'coin_prices', item_id: 'main', vote: 1 }],
  });
  render(<Wrapper />);
  await waitFor(() => screen.getByText('Coin Prices'));
  const upBtns = screen.getAllByTitle('Helpful');
  await userEvent.click(upBtns[0]);
  await waitFor(() => expect(votesApi.deleteVote).toHaveBeenCalled());
  // No toast shown
  expect(screen.queryByText('Preference saved ✓')).not.toBeInTheDocument();
  expect(screen.queryByText('Preference updated ✓')).not.toBeInTheDocument();
});

// ─── News ─────────────────────────────────────────────────────────────────

test('news items show "Read more →" link for real URLs', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Read more →')).toBeInTheDocument());
});

// ─── Meme ─────────────────────────────────────────────────────────────────

test('renders meme title', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText(/Test meme/)).toBeInTheDocument());
});

test('New Meme button is enabled when meme pool has multiple memes', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('🔀 New Meme')).toBeInTheDocument());
  expect(screen.getByText('🔀 New Meme').closest('button')).not.toBeDisabled();
});

// ─── Explore More Coins ────────────────────────────────────────────────────

test('shows Explore More Coins button after data loads', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Explore More Coins ↓')).toBeInTheDocument());
});

test('Explore More Coins fetches page 2 and appends coins', async () => {
  const extra = [{ id:'ethereum', name:'Ethereum', symbol:'ETH', image:'', price:3000, change_24h:1.5, market_cap:3e11 }];
  (coinsApi.getMarketCoins as ReturnType<typeof vi.fn>).mockResolvedValue({ data: extra });

  render(<Wrapper />);
  await waitFor(() => screen.getByText('Explore More Coins ↓'));
  await userEvent.click(screen.getByText('Explore More Coins ↓'));
  await waitFor(() => expect(coinsApi.getMarketCoins).toHaveBeenCalledWith(2, 10));
  // ETH should now appear in the table
  await waitFor(() => expect(screen.getByText('ETH')).toBeInTheDocument());
});

test('Show Less collapses extra coins', async () => {
  const extra = [{ id:'ethereum', name:'Ethereum', symbol:'ETH', image:'', price:3000, change_24h:1.5, market_cap:3e11 }];
  (coinsApi.getMarketCoins as ReturnType<typeof vi.fn>).mockResolvedValue({ data: extra });

  render(<Wrapper />);
  await waitFor(() => screen.getByText('Explore More Coins ↓'));
  await userEvent.click(screen.getByText('Explore More Coins ↓'));
  await waitFor(() => screen.getByText('Show Less ↑'));
  await userEvent.click(screen.getByText('Show Less ↑'));
  expect(screen.queryByText('ETH')).not.toBeInTheDocument();
});

// ─── Stale + offline ──────────────────────────────────────────────────────

test('shows stale banner when localStorage used', async () => {
  (dashApi.getDashboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
  localStorage.setItem('dashboard_cache', JSON.stringify({ data: DASH_DATA, at: Date.now() }));
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText(/showing cached data/i)).toBeInTheDocument());
});
