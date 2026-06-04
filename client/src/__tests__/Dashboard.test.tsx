import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Dashboard from '../pages/Dashboard';

vi.mock('../api/dashboard', () => ({ getDashboard: vi.fn() }));
vi.mock('../api/votes',     () => ({ getVotes: vi.fn(), castVote: vi.fn() }));
vi.mock('../api/preferences',() => ({ getPreferences: vi.fn() }));

import * as dashApi  from '../api/dashboard';
import * as votesApi from '../api/votes';
import * as prefsApi from '../api/preferences';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => vi.fn() };
});

const DASH_DATA = {
  coin_prices: [{ id:'bitcoin', name:'Bitcoin', symbol:'BTC', image:'', price:60000, change_24h:2.5, market_cap:1e12 }],
  market_news: [{ id:'n1', title:'BTC hits ATH', url:'#', source:'CryptoDesk', published_at: new Date().toISOString() }],
  ai_insight:  { text: 'Test insight', model: 'test', generated_at: new Date().toISOString() },
  meme:        { id:'1', title:'Test meme', imageUrl:'https://picsum.photos/seed/t/100/60' },
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
});

function Wrapper() {
  return (
    <ThemeProvider><AuthProvider><MemoryRouter><Dashboard /></MemoryRouter></AuthProvider></ThemeProvider>
  );
}

test('shows loading skeletons initially', () => {
  render(<Wrapper />);
  expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
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

test('vote buttons submit castVote', async () => {
  render(<Wrapper />);
  await waitFor(() => screen.getByText('Coin Prices'));
  const upBtns = screen.getAllByTitle('Helpful');
  await userEvent.click(upBtns[0]);
  await waitFor(() => expect(votesApi.castVote).toHaveBeenCalledWith(expect.objectContaining({ vote: 'up' })));
});

test('shows stale banner when localStorage used', async () => {
  (dashApi.getDashboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
  localStorage.setItem('dashboard_cache', JSON.stringify({ data: DASH_DATA, at: Date.now() }));
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText(/showing cached data/i)).toBeInTheDocument());
});
