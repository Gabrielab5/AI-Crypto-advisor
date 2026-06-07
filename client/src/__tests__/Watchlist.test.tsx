import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import WatchlistPanel from '../components/WatchlistPanel';
import type { WatchlistItem } from '../api/watchlist';
import type { CoinPrice } from '../api/dashboard';

const ITEMS: WatchlistItem[] = [
  { id:'wl-1', user_id:'u1', coin_id:'bitcoin',  coin_symbol:'BTC', coin_name:'Bitcoin',  added_at: new Date().toISOString(), price:60000,  change_24h:2.5,  image:'https://example.com/btc.png' },
  { id:'wl-2', user_id:'u1', coin_id:'ethereum', coin_symbol:'ETH', coin_name:'Ethereum', added_at: new Date().toISOString(), price:3000,   change_24h:-1.2, image:'https://example.com/eth.png' },
];

function renderPanel(overrides: {
  items?: WatchlistItem[];
  loading?: boolean;
  onClose?: () => void;
  onRemove?: (id: string) => void;
  onCoinClick?: (coin: CoinPrice) => void;
} = {}) {
  return render(
    <WatchlistPanel
      items={overrides.items ?? ITEMS}
      loading={overrides.loading ?? false}
      onClose={overrides.onClose ?? vi.fn()}
      onRemove={overrides.onRemove ?? vi.fn()}
      onCoinClick={overrides.onCoinClick ?? vi.fn()}
    />
  );
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

test('renders watchlist coins with price and change', () => {
  renderPanel();
  expect(screen.getByText('BTC')).toBeInTheDocument();
  expect(screen.getByText('ETH')).toBeInTheDocument();
  expect(screen.getByText('$60,000.00')).toBeInTheDocument();
  expect(screen.getByText('+2.50%')).toBeInTheDocument();
  expect(screen.getByText('-1.20%')).toBeInTheDocument();
});

test('shows empty state when no coins', () => {
  renderPanel({ items: [] });
  expect(screen.getByText(/no coins yet/i)).toBeInTheDocument();
});

test('shows loading spinner while fetching', () => {
  const { container } = renderPanel({ items: [], loading: true });
  expect(container.querySelector('.animate-spin')).toBeTruthy();
});

test('coin count is shown in header', () => {
  renderPanel();
  expect(screen.getByText('2 coins tracked')).toBeInTheDocument();
});

test('singular "coin" for single item', () => {
  renderPanel({ items: [ITEMS[0]] });
  expect(screen.getByText('1 coin tracked')).toBeInTheDocument();
});

test('renders coin logo image', () => {
  renderPanel();
  const imgs = screen.getAllByRole('img');
  const btcImg = imgs.find(img => img.getAttribute('src') === 'https://example.com/btc.png');
  expect(btcImg).toBeTruthy();
});

test('renders letter avatar div (not img) when coin image is null', () => {
  const itemNoImage: WatchlistItem = {
    ...ITEMS[0], image: null, coin_symbol: 'DOGE', coin_id: 'dogecoin',
  };
  const { container } = renderPanel({ items: [itemNoImage] });
  // No img element should exist (letter avatar is a <div>)
  expect(container.querySelector('img')).toBeNull();
  // The first letter of the symbol is shown in the avatar div
  expect(screen.getByText('D')).toBeInTheDocument();
});

// ─── Close ─────────────────────────────────────────────────────────────────────

test('calls onClose when backdrop is clicked', async () => {
  const onClose = vi.fn();
  const { container } = renderPanel({ onClose });
  const backdrop = container.querySelector('.fixed.inset-0.z-40');
  if (backdrop) await userEvent.click(backdrop);
  expect(onClose).toHaveBeenCalled();
});

// ─── Remove ────────────────────────────────────────────────────────────────────

test('calls onRemove with coin_id when X button is clicked', async () => {
  const onRemove = vi.fn();
  renderPanel({ onRemove });
  const removeButtons = screen.getAllByTitle('Remove from watchlist');
  await userEvent.click(removeButtons[0]);
  expect(onRemove).toHaveBeenCalledWith('bitcoin');
});

// ─── Click row → open CoinModal ────────────────────────────────────────────────

test('clicking a coin row calls onCoinClick with the correct CoinPrice', async () => {
  const onCoinClick = vi.fn();
  const { container } = renderPanel({ onCoinClick });
  const rows = container.querySelectorAll('.cursor-pointer');
  await userEvent.click(rows[0]);
  expect(onCoinClick).toHaveBeenCalledTimes(1);
  const arg: CoinPrice = onCoinClick.mock.calls[0][0];
  expect(arg.id).toBe('bitcoin');
  expect(arg.symbol).toBe('BTC');
  expect(arg.price).toBe(60000);
  expect(arg.change_24h).toBe(2.5);
});

test('clicking the second coin row passes ethereum CoinPrice', async () => {
  const onCoinClick = vi.fn();
  const { container } = renderPanel({ onCoinClick });
  const rows = container.querySelectorAll('.cursor-pointer');
  await userEvent.click(rows[1]);
  const arg: CoinPrice = onCoinClick.mock.calls[0][0];
  expect(arg.id).toBe('ethereum');
  expect(arg.symbol).toBe('ETH');
  expect(arg.price).toBe(3000);
});

test('clicking row also calls onClose to close the watchlist', async () => {
  const onClose = vi.fn();
  const { container } = renderPanel({ onClose });
  const rows = container.querySelectorAll('.cursor-pointer');
  await userEvent.click(rows[0]);
  expect(onClose).toHaveBeenCalled();
});

test('clicking remove button does NOT trigger onCoinClick (stopPropagation)', async () => {
  const onCoinClick = vi.fn();
  renderPanel({ onCoinClick });
  const removeButtons = screen.getAllByTitle('Remove from watchlist');
  await userEvent.click(removeButtons[0]);
  expect(onCoinClick).not.toHaveBeenCalled();
});

test('coin with null price shows "—" placeholder', () => {
  const itemNoPrice: WatchlistItem = { ...ITEMS[0], price: null };
  renderPanel({ items: [itemNoPrice] });
  expect(screen.getByText('—')).toBeInTheDocument();
});
