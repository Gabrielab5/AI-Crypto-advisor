import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Star } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getCoinDetail, getCoinChart, getCoinNews, type CoinDetail, type ChartPoint, type CoinNewsItem } from '../api/coins';
import type { CoinPrice } from '../api/dashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n >= 1
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 4 });
}
function fmtLarge(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString('en-US');
}
function fmtSupply(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString('en-US');
}
function changeCls(v: number) { return v >= 0 ? 'text-[var(--c-accent)]' : 'text-red-400'; }
function changeStr(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }

function momentumScore(c24: number, c7: number, c30: number): number {
  const w = c24 * 0.5 + c7 * 0.3 + c30 * 0.2;
  return Math.round(Math.max(0, Math.min(100, w + 50)));
}
function scoreLabel(s: number) {
  if (s >= 70) return { label: 'Bullish',          color: 'var(--c-accent)' };
  if (s >= 50) return { label: 'Slightly Bullish',  color: '#86efac' };
  if (s >= 35) return { label: 'Neutral',           color: '#facc15' };
  return             { label: 'Bearish',            color: '#f87171' };
}

// ─── Custom chart tooltip ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--c-muted)] mb-0.5">{label}</p>
      <p className="text-[var(--c-text)] font-semibold">{fmtPrice(payload[0].value)}</p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────

interface CoinModalProps {
  coin:             CoinPrice;
  onClose:          () => void;
  isPinned?:        boolean;
  onPin?:           (coinId: string) => void;
  coinVote?:        'up' | 'down' | null;
  onCoinVote?:      (vote: 'up' | 'down') => void;
  pendingCoinVote?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function CoinModal({ coin, onClose, isPinned = false, onPin, coinVote, onCoinVote, pendingCoinVote }: CoinModalProps) {
  const [detail,         setDetail]         = useState<CoinDetail | null>(null);
  const [chart,          setChart]          = useState<ChartPoint[]>([]);
  const [chartErr,       setChartErr]       = useState(false);
  const [chartSynthetic, setChartSynthetic] = useState(false);
  const [days,           setDays]           = useState<7 | 30>(7);
  const [loadingD,       setLoadingD]       = useState(true);
  const [loadingC,       setLoadingC]       = useState(true);
  const [coinNews,       setCoinNews]       = useState<CoinNewsItem[]>([]);
  const [loadingN,       setLoadingN]       = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    setLoadingD(true);
    getCoinDetail(coin.id)
      .then(r => setDetail(r.data))
      .catch(err => console.error('[CoinModal] detail fetch failed:', err))
      .finally(() => setLoadingD(false));
  }, [coin.id]);

  useEffect(() => {
    setLoadingC(true);
    setChartErr(false);
    setChartSynthetic(false);
    getCoinChart(coin.id, days)
      .then(r => {
        setChart(r.data);
        setChartSynthetic(r.headers?.['x-synthetic-data'] === 'true');
      })
      .catch(err => {
        console.error(`[CoinModal] chart fetch failed for ${coin.id} (${days}d):`, err);
        setChart([]);
        setChartErr(true);
      })
      .finally(() => setLoadingC(false));
  }, [coin.id, days]);

  useEffect(() => {
    setLoadingN(true);
    getCoinNews(coin.symbol, coin.name)
      .then(r => setCoinNews(r.data))
      .catch(() => setCoinNews([]))
      .finally(() => setLoadingN(false));
  }, [coin.symbol, coin.name]);

  const c7    = detail?.change_7d  ?? 0;
  const c30   = detail?.change_30d ?? 0;
  const score = momentumScore(coin.change_24h, c7, c30);
  const { label: scoreText, color: scoreColor } = scoreLabel(score);


  const chartData = chart.map(p => ({
    date:  new Date(p.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: p.price,
  }));
  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.998 : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.002 : 0;
  const isUp = chartData.length >= 2 && chartData[chartData.length - 1].price >= chartData[0].price;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl animate-modal-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)] sticky top-0 bg-[var(--c-surface)] z-10">
          <div className="flex items-center gap-3">
            <img src={coin.image} alt={coin.symbol} className="w-9 h-9 rounded-full" />
            <div>
              <h2 className="text-[var(--c-text)] font-bold text-lg leading-tight">{coin.name}</h2>
              <span className="text-[var(--c-muted)] text-xs font-mono">{coin.symbol}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onPin && (
              <button
                onClick={() => onPin(coin.id)}
                title={isPinned ? 'Remove from watchlist' : 'Add to watchlist'}
                className={`flex items-center gap-1 text-xs transition-colors btn-base ${isPinned ? 'text-yellow-400 hover:text-yellow-300' : 'text-[var(--c-muted)] hover:text-yellow-400'}`}
              >
                <Star className={`w-4 h-4 ${isPinned ? 'fill-yellow-400' : ''}`} />
                <span className="hidden sm:inline">{isPinned ? 'In Watchlist' : 'Watchlist'}</span>
              </button>
            )}
            <a
              href={`https://www.coingecko.com/en/coins/${coin.id}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[var(--c-muted)] hover:text-[var(--c-accent)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              CoinGecko
            </a>
            <button onClick={onClose} aria-label="Close" className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* Price + changes */}
          <div className="flex items-end justify-between flex-wrap gap-4">
            <p className="text-[var(--c-text)] text-3xl font-bold font-mono">{fmtPrice(coin.price)}</p>
            <div className="flex gap-4">
              {[['24h', coin.change_24h], ['7d', c7], ['30d', c30]].map(([label, val]) => (
                <div key={label as string} className="text-right">
                  <p className="text-[var(--c-muted)] text-xs mb-0.5">{label as string}</p>
                  <p className={`font-semibold text-sm font-mono ${changeCls(val as number)}`}>
                    {(val as number) >= 0
                      ? <TrendingUp className="inline w-3.5 h-3.5 mr-0.5" />
                      : <TrendingDown className="inline w-3.5 h-3.5 mr-0.5" />}
                    {changeStr(val as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[var(--c-text)] text-sm font-semibold">Price History</p>
              <div className="flex gap-1">
                {([7, 30] as const).map(d => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${days === d ? 'bg-[var(--c-accent)] text-[#0d0d0d]' : 'bg-[var(--c-s2)] text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', height: 220, minHeight: 220 }}>
              {loadingC ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 text-[var(--c-muted)]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--c-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[minP, maxP]} tick={{ fontSize: 10, fill: 'var(--c-muted)' }} tickLine={false} axisLine={false}
                      tickFormatter={v => `$${(v/1000).toFixed(v>999?1:0)}${v>999?'k':''}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="price" stroke={isUp ? 'var(--c-accent)' : '#f87171'} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--c-muted)] text-sm">
                  {chartErr ? 'Chart unavailable — try again later' : 'No chart data'}
                </div>
              )}
            </div>
            {chartSynthetic && (
              <p className="text-[var(--c-muted)] text-xs text-center mt-1.5 italic">
                Estimated data — live chart temporarily unavailable
              </p>
            )}
          </div>

          {/* Stats grid */}
          {loadingD ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[var(--c-s2)] rounded-xl" />)}
            </div>
          ) : detail && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Market Cap',          fmtLarge(detail.market_cap)],
                ['24h Volume',          fmtLarge(detail.volume_24h)],
                ['Circulating Supply',  `${fmtSupply(detail.circulating_supply)} ${detail.symbol}`],
                ['All-Time High',       `${fmtPrice(detail.ath)}${detail.ath_date ? ` · ${new Date(detail.ath_date).getFullYear()}` : ''}`],
              ].map(([label, val]) => (
                <div key={label} className="bg-[var(--c-s2)] rounded-xl p-4">
                  <p className="text-[var(--c-muted)] text-xs mb-1">{label}</p>
                  <p className="text-[var(--c-text)] text-sm font-semibold font-mono">{val}</p>
                </div>
              ))}
            </div>
          )}

          {/* Momentum Score */}
          <div className="bg-[var(--c-s2)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[var(--c-text)] text-sm font-semibold">Momentum Score</p>
              <span className="text-xs font-semibold" style={{ color: scoreColor }}>{scoreText}</span>
            </div>
            <div className="h-2.5 bg-[var(--c-border)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[var(--c-muted)] text-xs">Bearish</span>
              <span className="text-[var(--c-muted)] text-xs">{score}/100</span>
              <span className="text-[var(--c-muted)] text-xs">Bullish</span>
            </div>
          </div>

          {/* Per-coin feedback */}
          {onCoinVote && (
            <div className="bg-[var(--c-s2)] rounded-xl p-4 flex items-center justify-between">
              <p className="text-[var(--c-text-2)] text-sm">Show this coin in my feed?</p>
              <div className="flex gap-2">
                {(['up', 'down'] as const).map(v => (
                  <button key={v} onClick={() => onCoinVote(v)} disabled={pendingCoinVote}
                    title={v === 'up' ? 'Yes, keep showing' : 'No, show less'}
                    className={`min-w-[44px] min-h-[44px] rounded-lg text-base flex items-center justify-center transition-all disabled:opacity-40 hover:scale-110 active:scale-95
                      ${coinVote === v
                        ? v === 'up'
                          ? 'bg-[var(--c-accent-bg)] text-[var(--c-accent)] border border-[var(--c-accent)]/30'
                          : 'bg-[var(--c-red-bg)] text-red-400 border border-red-500/25'
                        : 'bg-[var(--c-s3)] text-[var(--c-muted)] border border-[var(--c-border)] hover:text-[var(--c-text)]'}`}>
                    {v === 'up' ? '👍' : '👎'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Latest News — coin-specific */}
          <div>
            <p className="text-[var(--c-text)] text-sm font-semibold mb-3">Latest News</p>
            {loadingN ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--c-s2)] mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-[var(--c-s2)] rounded w-full" />
                      <div className="h-2.5 bg-[var(--c-s2)] rounded w-3/4" />
                      <div className="h-2 bg-[var(--c-s2)] rounded w-1/3 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-3">
                {coinNews.map((item, i) => (
                  <li key={i}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="group flex items-start gap-2 cursor-pointer">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--c-accent)] mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[var(--c-text-2)] text-xs leading-relaxed group-hover:text-[var(--c-text)] transition-colors line-clamp-2">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[var(--c-muted)] text-xs">{item.source}</span>
                          <span className="text-[var(--c-s3)] text-xs">·</span>
                          <span className="text-[var(--c-accent)] text-xs group-hover:underline">Read more →</span>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
