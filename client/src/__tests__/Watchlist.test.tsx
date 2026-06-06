import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import WatchlistPanel from '../components/WatchlistPanel';
import type { WatchlistItem } from '../api/watchlist';

const ITEMS: WatchlistItem[] = [
  { id:'wl-1', user_id:'u1', coin_id:'bitcoin',  coin_symbol:'BTC', coin_name:'Bitcoin',  added_at: new Date().toISOString(), price:60000,  change_24h:2.5,  image:'https://example.com/btc.png' },
  { id:'wl-2', user_id:'u1', coin_id:'ethereum', coin_symbol:'ETH', coin_name:'Ethereum', added_at: new Date().toISOString(), price:3000,   change_24h:-1.2, image:'https://example.com/eth.png' },
];

test('renders watchlist coins with price and change', () => {
  render(<WatchlistPanel items={ITEMS} loading={false} onClose={vi.fn()} onRemove={vi.fn()} />);
  expect(screen.getByText('BTC')).toBeInTheDocument();
  expect(screen.getByText('ETH')).toBeInTheDocument();
  expect(screen.getByText('$60,000.00')).toBeInTheDocument();
  expect(screen.getByText('+2.50%')).toBeInTheDocument();
  expect(screen.getByText('-1.20%')).toBeInTheDocument();
});

test('shows empty state when no coins', () => {
  render(<WatchlistPanel items={[]} loading={false} onClose={vi.fn()} onRemove={vi.fn()} />);
  expect(screen.getByText(/no coins yet/i)).toBeInTheDocument();
});

test('shows loading spinner while fetching', () => {
  const { container } = render(<WatchlistPanel items={[]} loading={true} onClose={vi.fn()} onRemove={vi.fn()} />);
  expect(container.querySelector('.animate-spin')).toBeTruthy();
});

test('calls onClose when backdrop is clicked', async () => {
  const onClose = vi.fn();
  const { container } = render(<WatchlistPanel items={ITEMS} loading={false} onClose={onClose} onRemove={vi.fn()} />);
  // The fixed overlay backdrop is the first fixed div
  const backdrop = container.querySelector('.fixed.inset-0.z-40');
  if (backdrop) await userEvent.click(backdrop);
  expect(onClose).toHaveBeenCalled();
});

test('calls onRemove when X is clicked on a coin', async () => {
  const onRemove = vi.fn();
  render(<WatchlistPanel items={ITEMS} loading={false} onClose={vi.fn()} onRemove={onRemove} />);
  // Hover to reveal the remove button — use title attribute
  const removeButtons = screen.getAllByTitle('Remove from watchlist');
  await userEvent.click(removeButtons[0]);
  expect(onRemove).toHaveBeenCalledWith('bitcoin');
});

test('coin count is shown in header', () => {
  render(<WatchlistPanel items={ITEMS} loading={false} onClose={vi.fn()} onRemove={vi.fn()} />);
  expect(screen.getByText('2 coins tracked')).toBeInTheDocument();
});

test('singular "coin" for single item', () => {
  render(<WatchlistPanel items={[ITEMS[0]]} loading={false} onClose={vi.fn()} onRemove={vi.fn()} />);
  expect(screen.getByText('1 coin tracked')).toBeInTheDocument();
});
