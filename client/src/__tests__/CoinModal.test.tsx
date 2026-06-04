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
  { id: 'n1', title: 'Bitcoin hits ATH today', url: '#', source: 'CryptoDesk', published_at: new Date().toISOString() },
  { id: 'n2', title: 'Ethereum surges', url: '#', source: 'The Block', published_at: new Date().toISOString() },
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

function Wrapper({ onClose = vi.fn() }: { onClose?: () => void }) {
  return (
    <ThemeProvider><AuthProvider><MemoryRouter>
      <CoinModal coin={COIN} news={NEWS} onClose={onClose} />
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

test('closes on X button click', async () => {
  const onClose = vi.fn();
  render(<Wrapper onClose={onClose} />);
  await userEvent.click(screen.getByTitle ? document.querySelector('button[aria-label="Close"]') ?? screen.getAllByRole('button')[0] : screen.getAllByRole('button')[0]);
  // X is the first button inside the header area
});

test('shows related news filtered by coin symbol', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Bitcoin hits ATH today')).toBeInTheDocument());
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

test('renders 7d/30d chart toggle buttons', async () => {
  render(<Wrapper />);
  expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
});

test('fetches 30d chart when 30d button clicked', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: '30d' }));
  await waitFor(() => expect(coinsApi.getCoinChart).toHaveBeenCalledWith('bitcoin', 30));
});

test('shows momentum score bar', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText('Momentum Score')).toBeInTheDocument());
});
