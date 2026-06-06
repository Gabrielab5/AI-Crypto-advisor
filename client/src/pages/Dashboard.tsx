import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getDashboard, getInsight,
  type CoinPrice, type NewsItem, type AIInsight, type Meme,
  type DashboardData,
} from '../api/dashboard';
import { getPreferences } from '../api/preferences';
import { castVote, deleteVote, getVotes, type VoteRecord } from '../api/votes';
import { getWatchlist, addToWatchlist, removeFromWatchlist, type WatchlistItem } from '../api/watchlist';
import { getMarketCoins } from '../api/coins';
import Drawer         from '../components/Drawer';
import CoinModal      from '../components/CoinModal';
import WatchlistPanel from '../components/WatchlistPanel';
import ToastContainer, { type ToastItem } from '../components/Toast';

const REFRESH_MS = 60_000;
const LS_KEY     = 'dashboard_cache';
const TICKERS    = ['BTC','ETH','SOL','BNB','ADA','XRP','DOGE','AVAX','LINK','DOT','LTC','ATOM'];

// ─── Helpers ──────────────────────────────────────────────────────────────
function greeting(name: string) {
  const h = new Date().getHours();
  const t = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${t}, ${name?.split(' ')[0] ?? 'Anon'} 🚀`;
}
function fmt(n: number) {
  return n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toPrecision(4);
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5)    return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Coin Prices Loading State ─────────────────────────────────────────────
function CoinPricesLoadingCard() {
  const row = [...TICKERS, ...TICKERS];
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg bg-[var(--c-s2)] h-8 relative">
        <div className="absolute top-0 left-0 h-full flex items-center gap-6 px-4 whitespace-nowrap animate-ticker">
          {row.map((t, i) => (
            <span key={i} className="text-[var(--c-accent)] text-xs font-mono font-bold">{t}</span>
          ))}
        </div>
      </div>
      <p className="text-[var(--c-muted)] text-xs text-center animate-pulse">
        Fetching live prices from the market…
      </p>
      <div className="h-1 bg-[var(--c-s2)] rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 w-2/5 bg-[var(--c-accent)] rounded-full animate-indeterminate" />
      </div>
      <div className="space-y-3 pt-1">
        {[80, 65, 75, 55, 70].map((w, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-[var(--c-s2)] shrink-0" />
            <div className="flex-1 h-2.5 bg-[var(--c-s2)] rounded" style={{ width: `${w}%` }} />
            <div className="h-2.5 w-16 bg-[var(--c-s2)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton (other cards) ────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 animate-pulse">
      <div className="flex justify-between items-center mb-5">
        <div className="h-4 w-32 bg-[var(--c-s2)] rounded" />
        <div className="flex gap-2">
          <div className="h-7 w-7 bg-[var(--c-s2)] rounded-lg" />
          <div className="h-7 w-7 bg-[var(--c-s2)] rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        {[1,2,3,4].map(i => <div key={i} className="h-3 bg-[var(--c-s2)] rounded" style={{width:`${50+i*10}%`}} />)}
      </div>
    </div>
  );
}

// ─── Vote buttons ──────────────────────────────────────────────────────────
interface VoteBtnProps { section:string; itemId:string; current:'up'|'down'|null; pending:boolean; onVote:(s:string,id:string,v:'up'|'down')=>void; }
function VoteButtons({ section, itemId, current, pending, onVote }: VoteBtnProps) {
  const [bouncing, setBouncing] = useState<'up'|'down'|null>(null);
  function handle(v: 'up'|'down') {
    setBouncing(v); setTimeout(() => setBouncing(null), 400); onVote(section, itemId, v);
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      {(['up','down'] as const).map(v => (
        <button key={v} onClick={() => handle(v)} disabled={pending} title={v==='up'?'Helpful':'Not helpful'}
          className={`min-w-[44px] min-h-[44px] rounded-lg text-base flex items-center justify-center transition-all duration-150 disabled:opacity-40 hover:scale-110 active:scale-95
            ${bouncing===v?'animate-vote-bounce':''}
            ${current===v
              ? v==='up'?'bg-[var(--c-accent-bg)] text-[var(--c-accent)] border border-[var(--c-accent)]/30 shadow-[0_0_8px_rgba(0,255,136,0.2)]'
                        :'bg-[var(--c-red-bg)] text-red-400 border border-red-500/25'
              :'bg-[var(--c-s2)] text-[var(--c-muted)] border border-[var(--c-border)] hover:text-[var(--c-text)] hover:border-[var(--c-s3)]'}`}>
          {v==='up'?'👍':'👎'}
        </button>
      ))}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────
interface CardProps { title:string; icon:string; section:string; itemId?:string; voteKey:string; votes:Record<string,'up'|'down'>; pendingVote:string|null; onVote:(s:string,id:string,v:'up'|'down')=>void; children:React.ReactNode; }
function Card({ title, icon, section, itemId='main', voteKey, votes, pendingVote, onVote, children }: CardProps) {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 flex flex-col card-hover animate-fade-in">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="text-[var(--c-text)] font-semibold text-sm">{title}</h3>
        </div>
        <VoteButtons section={section} itemId={itemId} current={votes[voteKey]??null} pending={pendingVote===voteKey} onVote={onVote} />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ─── Coin Prices Card ──────────────────────────────────────────────────────
interface CoinPricesCardProps {
  coins:        CoinPrice[];
  onCoinClick:  (c: CoinPrice) => void;
  watchlistIds: Set<string>;
  extraCoins:   CoinPrice[];
  showExtra:    boolean;
  loadingExtra: boolean;
  onLoadMore:   () => void;
  onCollapse:   () => void;
}
function CoinPricesCard({ coins, onCoinClick, watchlistIds, extraCoins, showExtra, loadingExtra, onLoadMore, onCollapse }: CoinPricesCardProps) {
  const sorted   = [...coins.filter(c => watchlistIds.has(c.id)), ...coins.filter(c => !watchlistIds.has(c.id))];
  const allCoins = showExtra ? [...sorted, ...extraCoins] : sorted;

  if (!sorted.length) return <p className="text-[var(--c-muted)] text-sm">No coin data.</p>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead><tr className="text-[var(--c-muted)] text-xs">
          <th className="text-left pb-3 pl-1 font-medium">Coin</th>
          <th className="text-right pb-3 font-medium">Price</th>
          <th className="text-right pb-3 pr-1 font-medium">24h</th>
        </tr></thead>
        <tbody className="divide-y divide-[var(--c-border)]">
          {allCoins.map(c => (
            <tr key={c.id} onClick={() => onCoinClick(c)}
              className="cursor-pointer hover:bg-[var(--c-s2)] transition-colors duration-150 group">
              <td className="py-2.5 pl-1">
                <div className="flex items-center gap-2.5">
                  {watchlistIds.has(c.id) && <Star className="w-3 h-3 text-yellow-400 shrink-0 fill-yellow-400" />}
                  <img src={c.image} alt={c.symbol} className="w-6 h-6 rounded-full" />
                  <div>
                    <span className="text-[var(--c-text)] font-medium group-hover:text-[var(--c-accent)] transition-colors">{c.symbol}</span>
                    <span className="text-[var(--c-muted)] text-xs ml-1.5 hidden sm:inline">{c.name}</span>
                  </div>
                </div>
              </td>
              <td className="py-2.5 text-right text-[var(--c-text)] font-mono text-xs">${fmt(c.price)}</td>
              <td className={`py-2.5 pr-1 text-right font-mono text-xs font-medium ${c.change_24h>=0?'text-[var(--c-accent)]':'text-red-400'}`}>
                {c.change_24h>=0?'+':''}{c.change_24h.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-col items-center gap-1">
        <p className="text-[var(--c-muted)] text-xs">Click a row for more details</p>
        {showExtra ? (
          <button onClick={onCollapse}
            className="text-[var(--c-accent)] text-xs hover:underline btn-base">
            Show Less ↑
          </button>
        ) : (
          <button onClick={onLoadMore} disabled={loadingExtra}
            className="flex items-center gap-1.5 text-xs text-[var(--c-muted)] hover:text-[var(--c-accent)] transition-colors disabled:opacity-50 btn-base">
            {loadingExtra ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {loadingExtra ? 'Loading…' : 'Explore More Coins ↓'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Market News Card ──────────────────────────────────────────────────────
function MarketNewsCard({ news }: { news: NewsItem[] }) {
  return (
    <ul className="space-y-3">
      {news.map((item, i) => (
        <li key={item.id}>
          <div className="flex items-start gap-3">
            <span className="text-[var(--c-s3)] text-xs font-mono mt-0.5 w-4 shrink-0">{String(i+1).padStart(2,'0')}</span>
            <div className="min-w-0">
              <a href={item.url !== '#' ? item.url : undefined}
                target={item.url !== '#' ? '_blank' : undefined} rel="noopener noreferrer"
                className={`block text-[var(--c-text-2)] text-xs leading-relaxed line-clamp-2 ${item.url !== '#' ? 'hover:text-[var(--c-text)] hover:underline transition-colors cursor-pointer' : 'cursor-default'}`}>
                {item.title}
              </a>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[var(--c-muted)] text-xs">{item.source}</span>
                <span className="text-[var(--c-s3)] text-xs">·</span>
                <span className="text-[var(--c-s3)] text-xs">{timeAgo(item.published_at)}</span>
                {item.url !== '#' && (
                  <>
                    <span className="text-[var(--c-s3)] text-xs">·</span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-[var(--c-accent)] text-xs hover:underline transition-colors">
                      Read more →
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── AI Insight Card ───────────────────────────────────────────────────────
function AIInsightCard({ insight, onRefresh, refreshing }: { insight: AIInsight; onRefresh:()=>void; refreshing:boolean }) {
  return (
    <div className="flex flex-col h-full">
      <blockquote className="flex-1 relative">
        <span className="text-[var(--c-accent)]/20 text-6xl font-serif absolute -top-2 -left-1 leading-none select-none">"</span>
        {refreshing ? (
          <div className="pl-5 space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-3 bg-[var(--c-s2)] rounded" style={{width:`${60+i*10}%`}} />)}
          </div>
        ) : (
          <p className="text-[var(--c-text-2)] text-sm leading-relaxed pl-5 italic">{insight.text}</p>
        )}
      </blockquote>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--c-border)]">
        <div>
          <span className="text-[var(--c-muted)] text-xs">
            {insight.model === 'fallback' || insight.model === 'static' ? 'Static insight' : insight.model.split('/').pop()}
          </span>
          <span className="text-[var(--c-s3)] text-xs ml-2">{timeAgo(insight.generated_at)}</span>
        </div>
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-[var(--c-accent)] hover:text-[var(--c-accent-2)] transition-colors disabled:opacity-50 btn-base">
          <svg className={`w-3 h-3 ${refreshing?'animate-spin':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {refreshing ? 'Generating…' : 'New insight'}
        </button>
      </div>
    </div>
  );
}

// ─── Meme Card ─────────────────────────────────────────────────────────────
function MemeCard({ meme, allMemes, onNewMeme }: { meme: Meme; allMemes: Meme[]; onNewMeme:()=>void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl overflow-hidden bg-[var(--c-s2)]">
        <img
          src={meme.imageUrl} alt={meme.title}
          className="w-full h-auto block"
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <p className="text-[var(--c-text)] text-xl font-bold text-center leading-snug px-2">"{meme.title}"</p>
      <button onClick={onNewMeme} disabled={allMemes.length <= 1}
        className="mx-auto flex items-center gap-2 px-5 py-2 rounded-lg border border-[var(--c-accent)] text-[var(--c-accent)] text-sm font-medium hover:bg-[var(--c-accent)] hover:text-[#0d0d0d] transition-all duration-150 disabled:opacity-30 btn-base">
        🔀 New Meme
      </button>
    </div>
  );
}


// ─── Main ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data,             setData]             = useState<DashboardData | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [loadError,        setLoadError]        = useState(false);
  const [isStale,          setIsStale]          = useState(false);
  const [votes,            setVotes]            = useState<Record<string,'up'|'down'>>({});
  const [pendingVote,      setPendingVote]      = useState<string|null>(null);
  const [refreshingAI,     setRefreshingAI]     = useState(false);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [selectedCoin,     setSelectedCoin]     = useState<CoinPrice|null>(null);
  const [activeMeme,       setActiveMeme]       = useState<Meme|null>(null);
  const [allMemes,         setAllMemes]         = useState<Meme[]>([]);
  const [lastUpdated,      setLastUpdated]      = useState<Date|null>(null);
  const [secondsAgo,       setSecondsAgo]       = useState(0);
  const [toasts,           setToasts]           = useState<ToastItem[]>([]);
  const [watchlistIds,     setWatchlistIds]     = useState<Set<string>>(new Set());
  const [watchlistItems,   setWatchlistItems]   = useState<WatchlistItem[]>([]);
  const [watchlistOpen,    setWatchlistOpen]    = useState(false);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [extraCoins,       setExtraCoins]       = useState<CoinPrice[]>([]);
  const [showExtra,        setShowExtra]        = useState(false);
  const [loadingExtra,     setLoadingExtra]     = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => { document.title = 'Dashboard | AI Crypto Advisor'; }, []);

  // Onboarding guard + initial watchlist load
  useEffect(() => {
    getPreferences().then(({ data: p }) => {
      if (!p.interested_assets.length || !p.investor_type) { navigate('/onboarding', { replace: true }); return; }
    }).catch(() => navigate('/onboarding', { replace: true }));

    getWatchlist().then(({ data: items }) => {
      setWatchlistItems(items);
      setWatchlistIds(new Set(items.map(i => i.coin_id)));
    }).catch(() => {});
  }, [navigate]);

  // Seconds-ago ticker
  useEffect(() => {
    const t = setInterval(() => { if (lastUpdated) setSecondsAgo(Math.floor((Date.now()-lastUpdated.getTime())/1000)); }, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);


  // ─── Toast ───────────────────────────────────────────────────────────────
  function addToast(message: string, type: ToastItem['type'] = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2200);
  }

  // ─── Load dashboard ───────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoadError(false);
    try {
      const [dash, userVotes] = await Promise.all([getDashboard(), getVotes()]);
      const d = dash.data;
      setData(d);
      setIsStale(false);
      setLastUpdated(new Date());

      // Refresh meme pool and pick a new random meme on every load
      const pool = d.memes?.length ? d.memes : (d.meme ? [d.meme] : []);
      if (pool.length) {
        setAllMemes(pool);
        setActiveMeme(prev => {
          const others = prev ? pool.filter(m => m.id !== prev.id) : pool;
          const pick   = others.length ? others : pool;
          return pick[Math.floor(Math.random() * pick.length)];
        });
      }

      localStorage.setItem(LS_KEY, JSON.stringify({ data: d, at: Date.now() }));
      const vm: Record<string,'up'|'down'> = {};
      for (const v of (userVotes.data as VoteRecord[])) vm[`${v.section}_${v.item_id}`] = v.vote===1?'up':'down';
      setVotes(vm);
    } catch {
      setLoadError(true);
      const cached = localStorage.getItem(LS_KEY);
      if (cached && !data) {
        try {
          const { data: cd } = JSON.parse(cached);
          setData(cd);
          const pool = cd.memes?.length ? cd.memes : (cd.meme ? [cd.meme] : []);
          if (pool.length) { setAllMemes(pool); setActiveMeme(pool[Math.floor(Math.random() * pool.length)]); }
          setIsStale(true);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadDashboard();
    intervalRef.current = setInterval(loadDashboard, REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadDashboard]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleVote(section: string, itemId: string, vote: 'up'|'down') {
    const key         = `${section}_${itemId}`;
    const currentVote = votes[key] ?? null;
    if (pendingVote === key) return;

    // Same vote → toggle off silently
    if (currentVote === vote) {
      setPendingVote(key);
      try {
        await deleteVote({ section, item_id: itemId });
        setVotes(prev => { const n = { ...prev }; delete n[key]; return n; });
      } catch { /* silent */ }
      finally { setPendingVote(null); }
      return;
    }

    const isSwitch = currentVote !== null;
    setPendingVote(key);
    try {
      await castVote({ section, item_id: itemId, vote });
      setVotes(prev => ({ ...prev, [key]: vote }));
      addToast(isSwitch ? 'Preference updated ✓' : 'Preference saved ✓');
    } catch { addToast('Vote failed — try again', 'error'); }
    finally { setPendingVote(null); }
  }

  async function handleRefreshInsight() {
    if (refreshingAI) return;
    setRefreshingAI(true);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 20_000)
    );

    try {
      const { data: fresh } = await Promise.race([getInsight(), timeout]);
      setData(prev => prev ? { ...prev, ai_insight: fresh.ai_insight } : prev);
      setLastUpdated(new Date());
    } catch (err) {
      addToast(
        err instanceof Error && err.message === 'timeout'
          ? 'Could not fetch new insight — try again'
          : 'Failed to refresh insight',
        'error',
      );
    } finally {
      setRefreshingAI(false);
    }
  }

  async function handleWatchlistToggle(coinId: string) {
    const coin = data?.coin_prices.find(c => c.id === coinId);
    if (!coin) return;
    const isIn = watchlistIds.has(coinId);
    if (isIn) {
      await removeFromWatchlist(coinId).catch(() => null);
      setWatchlistIds(prev => { const n = new Set(prev); n.delete(coinId); return n; });
      setWatchlistItems(prev => prev.filter(i => i.coin_id !== coinId));
      addToast('Removed from watchlist');
    } else {
      try {
        const { data: item } = await addToWatchlist({ coin_id: coinId, coin_symbol: coin.symbol, coin_name: coin.name });
        setWatchlistIds(prev => new Set([...prev, coinId]));
        setWatchlistItems(prev => [item, ...prev]);
        addToast('⭐ Added to watchlist');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        if (msg === 'Already in watchlist') addToast('Already in watchlist', 'info');
        else addToast('Failed to add to watchlist', 'error');
      }
    }
  }

  async function handleWatchlistRemove(coinId: string) {
    await removeFromWatchlist(coinId).catch(() => null);
    setWatchlistIds(prev => { const n = new Set(prev); n.delete(coinId); return n; });
    setWatchlistItems(prev => prev.filter(i => i.coin_id !== coinId));
  }

  async function openWatchlist() {
    setWatchlistOpen(true);
    setLoadingWatchlist(true);
    try {
      const { data: items } = await getWatchlist();
      setWatchlistItems(items);
      setWatchlistIds(new Set(items.map(i => i.coin_id)));
    } finally { setLoadingWatchlist(false); }
  }

  function handleNewMeme() {
    if (allMemes.length <= 1 || !activeMeme) return;
    const others = allMemes.filter(m => m.id !== activeMeme.id);
    setActiveMeme(others[Math.floor(Math.random() * others.length)]);
  }

  async function handleLoadMore() {
    if (loadingExtra) return;
    setLoadingExtra(true);
    try {
      const { data: more } = await getMarketCoins(2, 10);
      // exclude coins already in main list
      const mainIds = new Set(data?.coin_prices.map(c => c.id) ?? []);
      setExtraCoins(more.filter(c => !mainIds.has(c.id)));
      setShowExtra(true);
    } catch { addToast('Failed to load more coins', 'error'); }
    finally { setLoadingExtra(false); }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--c-bg)]">
      {drawerOpen && <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
      {watchlistOpen && (
        <WatchlistPanel
          items={watchlistItems}
          loading={loadingWatchlist}
          onClose={() => setWatchlistOpen(false)}
          onRemove={handleWatchlistRemove}
        />
      )}
      {selectedCoin && data && (
        <CoinModal
          coin={selectedCoin}
          news={data.market_news}
          isPinned={watchlistIds.has(selectedCoin.id)}
          onPin={handleWatchlistToggle}
          onClose={() => setSelectedCoin(null)}
          coinVote={votes[`coin_prices_${selectedCoin.id}`] ?? null}
          onCoinVote={v => handleVote('coin_prices', selectedCoin.id, v)}
          pendingCoinVote={pendingVote === `coin_prices_${selectedCoin.id}`}
        />
      )}
      <ToastContainer toasts={toasts} />

      {/* Navbar */}
      <nav className="sticky top-0 z-10 border-b border-[var(--c-border)] bg-[var(--c-surface)]/90 backdrop-blur-sm px-3 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-bg)] border border-[var(--c-accent)]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--c-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-[var(--c-text)] font-semibold text-sm tracking-tight">AI Crypto Advisor</span>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdated && !loading && (
            <span className="text-[var(--c-muted)] text-xs hidden md:block">
              Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
            </span>
          )}
          <span className="text-[var(--c-muted)] text-xs hidden sm:block">{user?.email}</span>
          <div className="w-7 h-7 rounded-full bg-[var(--c-accent-bg)] border border-[var(--c-accent)]/20 flex items-center justify-center text-[var(--c-accent)] text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>

          {/* Watchlist star */}
          <button onClick={openWatchlist} title="My Watchlist"
            className="text-[var(--c-muted)] hover:text-yellow-400 transition-colors opacity-80 hover:opacity-100 p-1 btn-base relative" aria-label="Watchlist">
            <Star className={`w-4 h-4 ${watchlistIds.size > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {watchlistIds.size > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-400 text-[#0d0d0d] text-[9px] font-bold flex items-center justify-center">
                {watchlistIds.size}
              </span>
            )}
          </button>

          <button onClick={() => { logout(); navigate('/login'); }}
            className="text-[var(--c-muted)] hover:text-[var(--c-text)] text-xs transition-colors opacity-80 hover:opacity-100 flex items-center gap-1.5 btn-base">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
          <button onClick={() => setDrawerOpen(true)}
            className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors opacity-80 hover:opacity-100 p-1 btn-base" aria-label="Open settings">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-7">
          <h1 className="text-[var(--c-text)] text-2xl font-bold tracking-tight">{greeting(user?.name ?? '')}</h1>
          <p className="text-[var(--c-muted)] text-sm mt-1">Here's what's happening in the market today.</p>
        </div>

        {isStale && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-3 mb-5 text-yellow-400 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            ⚠️ Showing cached data — you appear to be offline
          </div>
        )}
        {loadError && !isStale && (
          <div className="flex items-center justify-between bg-[var(--c-red-bg)] border border-red-500/20 rounded-xl px-5 py-3 mb-5">
            <p className="text-red-400 text-sm">Failed to load dashboard.</p>
            <button onClick={loadDashboard} className="text-red-400 hover:text-red-300 text-sm underline btn-base">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Coin Prices */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 flex flex-col card-hover animate-fade-in">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">🪙</span>
                <h3 className="text-[var(--c-text)] font-semibold text-sm">Coin Prices</h3>
              </div>
              <VoteButtons section="coin_prices" itemId="main" current={votes['coin_prices_main']??null} pending={pendingVote==='coin_prices_main'} onVote={handleVote} />
            </div>
            <div className="flex-1 min-h-0">
              {loading ? <CoinPricesLoadingCard /> : data && (
                <CoinPricesCard
                  coins={data.coin_prices}
                  onCoinClick={setSelectedCoin}
                  watchlistIds={watchlistIds}
                  extraCoins={extraCoins}
                  showExtra={showExtra}
                  loadingExtra={loadingExtra}
                  onLoadMore={handleLoadMore}
                  onCollapse={() => { setShowExtra(false); setExtraCoins([]); }}
                />
              )}
            </div>
          </div>

          {loading ? <Skeleton /> : data && (
            <Card title="Market News" icon="📰" section="market_news" voteKey="market_news_main" votes={votes} pendingVote={pendingVote} onVote={handleVote}>
              <MarketNewsCard news={data.market_news} />
            </Card>
          )}
          {loading ? <Skeleton /> : data?.ai_insight && (
            <Card title="AI Insight" icon="🤖" section="ai_insight" voteKey="ai_insight_main" votes={votes} pendingVote={pendingVote} onVote={handleVote}>
              <AIInsightCard insight={data.ai_insight} onRefresh={handleRefreshInsight} refreshing={refreshingAI} />
            </Card>
          )}
          {loading ? <Skeleton /> : activeMeme && (
            <Card title="Meme of the Day" icon="😂" section="meme" itemId={activeMeme.id} voteKey={`meme_${activeMeme.id}`} votes={votes} pendingVote={pendingVote} onVote={handleVote}>
              <MemeCard meme={activeMeme} allMemes={allMemes} onNewMeme={handleNewMeme} />
            </Card>
          )}
        </div>

        <p className="text-[var(--c-muted)] text-xs text-center mt-10 opacity-60">
          Prices via CoinGecko · AI via Gemini / OpenRouter · Auto-refreshes every 60s
        </p>
      </main>
    </div>
  );
}
