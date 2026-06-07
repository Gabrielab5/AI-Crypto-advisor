import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import CoinModal from '../components/CoinModal';
import type { CoinPrice } from '../api/dashboard';

vi.mock('../api/coins', () => ({
  getCoinDetail: vi.fn(),
  getCoinChart:  vi.fn(),
  getCoinNews:   vi.fn(),
}));

import * as coinsApi from '../api/coins';

const COIN: CoinPrice = {
  id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC',
  image: 'https://example.com/btc.png',
  price: 60000, change_24h: 2.5, market_cap: 1e12,
};

const DETAIL = {
  id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', image: 'https://example.com/btc.png',
  price: 60000, change_24h: 2.5, change_7d: 5, change_30d: 10,
  market_cap: 1e12, volume_24h: 3e10, circulating_supply: 19e6,
  ath: 73000, ath_date: '2024-03-14',
};

const MOCK_NEWS = [
  { title: 'Bitcoin hits ATH today',  url: 'https://coindesk.com',      source: 'CoinDesk',      published_at: new Date().toISOString() },
  { title: 'BTC surges after ETF news', url: 'https://cointelegraph.com', source: 'CoinTelegraph', published_at: new Date().toISOString() },
];

beforeEach(() => {
  vi.clearAllMocks();
  (coinsApi.getCoinDetail as ReturnType<typeof vi.fn>).mockResolvedValue({ data: DETAIL });
  (coinsApi.getCoinChart  as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ ts: Date.now(), price: 60000 }] });
  (coinsApi.getCoinNews   as ReturnType<typeof vi.fn>).mockResolvedValue({ data: MOCK_NEWS });
});

function Wrapper({ onClose = vi.fn(), coinVote = null, onCoinVote = vi.fn() }: {
  onClose?: () => void;
  coinVote?: 'up' | 'down' | null;
  onCoinVote?: (v: 'up' | 'down') => void;
}) {
  return (
    <ThemeProvider><AuthProvider><MemoryRouter>
      <CoinModal coin={COIN} onClose={onClose} coinVote={coinVote} onCoinVote={onCoinVote} />
    </MemoryRouter></AuthProvider></ThemeProvider>
  );
}

// ─── Basic rendering ───────────────────────────────────────────────────────────

test('renders coin name and symbol', () => {
  render(<Wrapper />);
  expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  expect(screen.getByText('BTC')).toBeInTheDocument();
});

test('renders current price', () => {
  render(<Wrapper />);
  expect(screen.getByText('$60,000.00')).toBeInTheDocument();
});

test('renders 7d/30d chart toggle buttons', () => {
  render(<Wrapper />);
  expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
});

test('shows momentum score bar after detail loads', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Momentum Score')).toBeInTheDocument());
});

// ─── Coin detail ───────────────────────────────────────────────────────────────

test('loads coin detail on mount', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(coinsApi.getCoinDetail).toHaveBeenCalledWith('bitcoin'));
});

// ─── Chart ────────────────────────────────────────────────────────────────────

test('chart fetch called with correct coin id and default 7d', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(coinsApi.getCoinChart).toHaveBeenCalledWith('bitcoin', 7));
});

test('fetches 30d chart when 30d button clicked', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: '30d' }));
  await waitFor(() => expect(coinsApi.getCoinChart).toHaveBeenCalledWith('bitcoin', 30));
});

test('shows "Chart unavailable" when chart fetch fails', async () => {
  (coinsApi.getCoinChart as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('rate limited'));
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText(/chart unavailable/i)).toBeInTheDocument());
  expect(consoleSpy).toHaveBeenCalled();
  consoleSpy.mockRestore();
});

test('logs console.error when chart fetch fails', async () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  (coinsApi.getCoinChart as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));

  render(<Wrapper />);
  await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('[CoinModal] chart fetch failed'),
    expect.anything(),
  ));
  consoleSpy.mockRestore();
});

// ─── Latest News (coin-specific, fetched via getCoinNews) ─────────────────────

test('fetches coin-specific news on mount with symbol and name', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(coinsApi.getCoinNews).toHaveBeenCalledWith('BTC', 'Bitcoin'));
});

test('renders all news items returned by getCoinNews', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Bitcoin hits ATH today')).toBeInTheDocument());
  expect(screen.getByText('BTC surges after ETF news')).toBeInTheDocument();
});

test('each news item shows a "Read more →" link', async () => {
  render(<Wrapper />);
  await waitFor(() => {
    const links = screen.getAllByText('Read more →');
    expect(links.length).toBe(MOCK_NEWS.length);
  });
});

test('news link has correct href and opens in new tab', async () => {
  render(<Wrapper />);
  await waitFor(() => screen.getByText('Bitcoin hits ATH today'));
  const link = screen.getByText('Bitcoin hits ATH today').closest('a');
  expect(link).toHaveAttribute('href', 'https://coindesk.com');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('shows news source label for each item', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('CoinDesk')).toBeInTheDocument());
  expect(screen.getByText('CoinTelegraph')).toBeInTheDocument();
});

test('shows animated skeleton while news is loading', () => {
  (coinsApi.getCoinNews as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  const { container } = render(<Wrapper />);
  expect(container.querySelector('.animate-pulse')).toBeTruthy();
});

test('shows empty news section when getCoinNews returns empty array', async () => {
  (coinsApi.getCoinNews as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  render(<Wrapper />);
  await waitFor(() => expect(coinsApi.getCoinNews).toHaveBeenCalled());
  expect(screen.queryByText('Read more →')).not.toBeInTheDocument();
});

test('shows empty news section when getCoinNews fails', async () => {
  (coinsApi.getCoinNews as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
  render(<Wrapper />);
  await waitFor(() => expect(coinsApi.getCoinNews).toHaveBeenCalled());
  expect(screen.queryByText('Read more →')).not.toBeInTheDocument();
});

// ─── Per-coin votes ────────────────────────────────────────────────────────────

test('per-coin vote buttons are rendered when onCoinVote provided', async () => {
  render(<Wrapper onCoinVote={vi.fn()} />);
  await waitFor(() => expect(screen.getByText('Show this coin in my feed?')).toBeInTheDocument());
  expect(screen.getByTitle('Yes, keep showing')).toBeInTheDocument();
  expect(screen.getByTitle('No, show less')).toBeInTheDocument();
});

test('clicking per-coin down vote calls onCoinVote with "down"', async () => {
  const onCoinVote = vi.fn();
  render(<Wrapper onCoinVote={onCoinVote} />);
  await waitFor(() => screen.getByTitle('No, show less'));
  await userEvent.click(screen.getByTitle('No, show less'));
  expect(onCoinVote).toHaveBeenCalledWith('down');
});

test('clicking per-coin up vote calls onCoinVote with "up"', async () => {
  const onCoinVote = vi.fn();
  render(<Wrapper onCoinVote={onCoinVote} />);
  await waitFor(() => screen.getByTitle('Yes, keep showing'));
  await userEvent.click(screen.getByTitle('Yes, keep showing'));
  expect(onCoinVote).toHaveBeenCalledWith('up');
});

// ─── Close / keyboard ──────────────────────────────────────────────────────────

test('closes on Escape key', async () => {
  const onClose = vi.fn();
  render(<Wrapper onClose={onClose} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});
