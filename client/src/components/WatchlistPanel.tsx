import { X } from 'lucide-react';
import type { WatchlistItem } from '../api/watchlist';
import type { CoinPrice } from '../api/dashboard';

interface WatchlistPanelProps {
  items:        WatchlistItem[];
  loading:      boolean;
  onClose:      () => void;
  onRemove:     (coinId: string) => void;
  onCoinClick:  (coin: CoinPrice) => void;
}

function fmtPrice(n: number | null): string {
  if (n === null) return '—';
  return n >= 1
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 4 });
}

function toCoinPrice(item: WatchlistItem): CoinPrice {
  return {
    id:         item.coin_id,
    name:       item.coin_name ?? item.coin_symbol,
    symbol:     item.coin_symbol,
    image:      item.image ?? `https://ui-avatars.com/api/?name=${item.coin_symbol}&background=1a1a2e&color=00ff88&size=32`,
    price:      item.price      ?? 0,
    change_24h: item.change_24h ?? 0,
    market_cap: 0,
  };
}

export default function WatchlistPanel({ items, loading, onClose, onRemove, onCoinClick }: WatchlistPanelProps) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-80 max-w-full bg-[var(--c-surface)] border-l border-[var(--c-border)] flex flex-col shadow-2xl animate-drawer-in">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
          <div>
            <h3 className="text-[var(--c-text)] font-semibold text-sm">My Watchlist</h3>
            <p className="text-[var(--c-muted)] text-xs mt-0.5">
              {items.length} coin{items.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <svg className="animate-spin w-5 h-5 text-[var(--c-muted)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3 px-6 text-center">
              <span className="text-4xl">⭐</span>
              <p className="text-[var(--c-muted)] text-sm leading-relaxed">
                No coins yet. Click the ☆ star in any coin&apos;s detail modal to add it here.
              </p>
            </div>
          ) : (
            <ul>
              {items.map(item => (
                <li key={item.coin_id}
                  className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-s2)] transition-colors group cursor-pointer"
                  onClick={() => { onCoinClick(toCoinPrice(item)); onClose(); }}
                >
                  {item.image
                    ? <img src={item.image} alt={item.coin_symbol} className="w-8 h-8 rounded-full shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.coin_symbol}&background=1a1a2e&color=00ff88&size=32`; }} />
                    : <div className="w-8 h-8 rounded-full bg-[var(--c-accent-bg)] border border-[var(--c-accent)]/20 flex items-center justify-center text-[var(--c-accent)] text-xs font-bold shrink-0">{item.coin_symbol[0]}</div>
                  }

                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--c-text)] text-sm font-medium group-hover:text-[var(--c-accent)] transition-colors">{item.coin_symbol}</p>
                    <p className="text-[var(--c-muted)] text-xs truncate">{item.coin_name ?? '—'}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[var(--c-text)] text-xs font-mono">{fmtPrice(item.price)}</p>
                    {item.change_24h !== null && (
                      <p className={`text-xs font-mono ${item.change_24h >= 0 ? 'text-[var(--c-accent)]' : 'text-red-400'}`}>
                        {item.change_24h >= 0 ? '+' : ''}{item.change_24h.toFixed(2)}%
                      </p>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); onRemove(item.coin_id); }}
                    title="Remove from watchlist"
                    className="text-[var(--c-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
