import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import CoinModal from '../components/CoinModal';
import type { CoinPrice, NewsItem } from '../api/dashboard';

vi.mock('../api/coins', () => ({
  getCoinDetail: vi.fn(),
  getCoinChart:  vi.fn(),
}));

import * as coinsApi from '../api/coins';

const COIN: CoinPrice = {
  id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC',
  image: 'https://example.com/btc.png',
  price: 60000, change_24h: 2.5, market_cap: 1e12,
};

const NEWS: NewsItem[] = [
  { id: 'n1', title: 'Bitcoin hits ATH today',   url: 'https://coindesk.com', source: 'CoinDesk', published_at: new Date().toISOString() },
  { id: 'n2', title: 'Ethereum surges on demand', url: 'https://cointelegraph.com', source: 'CoinTelegraph', published_at: new Date().toISOString() },
];

const DETAIL = {
  id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', image: 'https://example.com/btc.png',
  price: 60000, change_24h: 2.5, change_7d: 5, change_30d: 10,
  market_cap: 1e12, volume_24h: 3e10, circulating_supply: 19e6,
  ath: 73000, ath_date: '2024-03-14',
};

beforeEach(() => {
  vi.clearAllMocks();
  (coinsApi.getCoinDetail as ReturnType<typeof vi.fn>).mockResolvedValue({ data: DETAIL });
  (coinsApi.getCoinChart  as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ ts: Date.now(), price: 60000 }] });
});

function Wrapper({ onClose = vi.fn(), coinVote = null, onCoinVote = vi.fn() }: {
  onClose?: () => void;
  coinVote?: 'up' | 'down' | null;
  onCoinVote?: (v: 'up' | 'down') => void;
}) {
  return (
    <ThemeProvider><AuthProvider><MemoryRouter>
      <CoinModal coin={COIN} news={NEWS} onClose={onClose} coinVote={coinVote} onCoinVote={onCoinVote} />
    </MemoryRouter></AuthProvider></ThemeProvider>
  );
}

test('renders coin name and symbol', () => {
  render(<Wrapper />);
  expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  expect(screen.getByText('BTC')).toBeInTheDocument();
});

test('renders current price', () => {
  render(<Wrapper />);
  expect(screen.getByText('$60,000.00')).toBeInTheDocument();
});

test('chart fetch called with correct coin id', async () => {
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
    expect.anything(),
  ));
  consoleSpy.mockRestore();
});

test('shows related news filtered by coin name', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Bitcoin hits ATH today')).toBeInTheDocument());
  expect(screen.queryByText('Ethereum surges on demand')).not.toBeInTheDocument();
});

test('shows "No recent news" when no news matches', async () => {
  const dogeCoin: CoinPrice = { ...COIN, id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' };
  render(
    <ThemeProvider><AuthProvider><MemoryRouter>
      <CoinModal coin={dogeCoin} news={NEWS} onClose={vi.fn()} />
    </MemoryRouter></AuthProvider></ThemeProvider>
  );
  await waitFor(() => expect(screen.getByText(/no recent news for doge/i)).toBeInTheDocument());
});

test('news items show Read more link', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Read more →')).toBeInTheDocument());
});

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

test('closes on Escape key', async () => {
  const onClose = vi.fn();
  render(<Wrapper onClose={onClose} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});

test('loads coin detail on mount', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(coinsApi.getCoinDetail).toHaveBeenCalledWith('bitcoin'));
});

test('renders 7d/30d chart toggle buttons', () => {
  render(<Wrapper />);
  expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
});

test('shows momentum score bar', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Momentum Score')).toBeInTheDocument());
});
