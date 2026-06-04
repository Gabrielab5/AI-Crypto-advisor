import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Bell, Star, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getDashboard,
  type CoinPrice, type NewsItem, type AIInsight, type Meme,
  type DashboardData, type TriggeredAlert,
} from '../api/dashboard';
import { getPreferences } from '../api/preferences';
import { castVote, getVotes, type VoteRecord } from '../api/votes';
import { deleteAlert } from '../api/alerts';
import api from '../api/client';
import Drawer      from '../components/Drawer';
import CoinModal   from '../components/CoinModal';
import ToastContainer, { type ToastItem } from '../components/Toast';

const REFRESH_MS = 60_000;
const LS_KEY     = 'dashboard_cache';

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
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 animate-pulse">
      <div className="flex justify-between items-center mb-5">
        <div className="h-4 w-32 bg-[var(--c-s2)] rounded" />
        <div className="flex gap-2"><div className="h-7 w-7 bg-[var(--c-s2)] rounded-lg" /><div className="h-7 w-7 bg-[var(--c-s2)] rounded-lg" /></div>
      </div>
      <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-3 bg-[var(--c-s2)] rounded" style={{width:`${50+i*10}%`}} />)}</div>
    </div>
  );
}

// ─── Vote buttons ──────────────────────────────────────────────────────────
interface VoteBtnProps { section:string; itemId:string; current:'up'|'down'|null; pending:boolean; onVote:(s:string,id:string,v:'up'|'down')=>void; }
function VoteButtons({ section, itemId, current, pending, onVote }: VoteBtnProps) {
  const [bouncing, setBouncing] = useState<'up'|'down'|null>(null);
  function handle(v: 'up'|'down') {
    setBouncing(v); setTimeout(()=>setBouncing(null),400); onVote(section,itemId,v);
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      {(['up','down'] as const).map(v => (
        <button key={v} onClick={()=>handle(v)} disabled={pending} title={v==='up'?'Helpful':'Not helpful'}
          className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all duration-150 disabled:opacity-40 hover:scale-110 active:scale-95
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
        <div className="flex items-center gap-2"><span className="text-lg">{icon}</span><h3 className="text-[var(--c-text)] font-semibold text-sm">{title}</h3></div>
        <VoteButtons section={section} itemId={itemId} current={votes[voteKey]??null} pending={pendingVote===voteKey} onVote={onVote} />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ─── Section renderers ─────────────────────────────────────────────────────

interface CoinPricesCardProps { coins: CoinPrice[]; onCoinClick:(c:CoinPrice)=>void; pinnedCoins:string[]; }
function CoinPricesCard({ coins, onCoinClick, pinnedCoins }: CoinPricesCardProps) {
  const sorted = [...coins.filter(c => pinnedCoins.includes(c.id)), ...coins.filter(c => !pinnedCoins.includes(c.id))];
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
          {sorted.map(c => (
            <tr key={c.id} onClick={() => onCoinClick(c)}
              className="cursor-pointer hover:bg-[var(--c-s2)] transition-colors duration-150 group">
              <td className="py-2.5 pl-1">
                <div className="flex items-center gap-2.5">
                  {pinnedCoins.includes(c.id) && <Star className="w-3 h-3 text-yellow-400 shrink-0 fill-yellow-400" />}
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
      <p className="text-[var(--c-muted)] text-xs mt-3 text-center">Click a row for details &amp; alerts</p>
    </div>
  );
}

function MarketNewsCard({ news }: { news: NewsItem[] }) {
  return (
    <ul className="space-y-3">
      {news.map((item,i) => (
        <li key={item.id}>
          <a href={item.url!=='#'?item.url:undefined} target={item.url!=='#'?'_blank':undefined} rel="noopener noreferrer"
            className={`group flex items-start gap-3 ${item.url!=='#'?'cursor-pointer':'cursor-default'}`}>
            <span className="text-[var(--c-s3)] text-xs font-mono mt-0.5 w-4 shrink-0">{String(i+1).padStart(2,'0')}</span>
            <div className="min-w-0">
              <p className={`text-[var(--c-text-2)] text-xs leading-relaxed line-clamp-2 ${item.url!=='#'?'group-hover:text-[var(--c-text)] group-hover:underline transition-colors':''}`}>{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[var(--c-muted)] text-xs">{item.source}</span>
                <span className="text-[var(--c-s3)] text-xs">·</span>
                <span className="text-[var(--c-s3)] text-xs">{timeAgo(item.published_at)}</span>
              </div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

function AIInsightCard({ insight, onRefresh, refreshing }: { insight: AIInsight; onRefresh:()=>void; refreshing:boolean }) {
  return (
    <div className="flex flex-col h-full">
      <blockquote className="flex-1 relative">
        <span className="text-[var(--c-accent)]/20 text-6xl font-serif absolute -top-2 -left-1 leading-none select-none">"</span>
        <p className="text-[var(--c-text-2)] text-sm leading-relaxed pl-5 italic">{insight.text}</p>
      </blockquote>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--c-border)]">
        <div>
          <span className="text-[var(--c-muted)] text-xs">{insight.model==='fallback'||insight.model==='static'?'Static insight':insight.model.split('/').pop()}</span>
          <span className="text-[var(--c-s3)] text-xs ml-2">{timeAgo(insight.generated_at)}</span>
        </div>
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-[var(--c-accent)] hover:text-[var(--c-accent-2)] transition-colors disabled:opacity-50 btn-base">
          <svg className={`w-3 h-3 ${refreshing?'animate-spin':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
          {refreshing?'Generating…':'New insight'}
        </button>
      </div>
    </div>
  );
}

function MemeCard({ meme, allMemes, onNewMeme }: { meme: Meme; allMemes: Meme[]; onNewMeme:()=>void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl overflow-hidden bg-[var(--c-s2)] aspect-video">
        <img src={meme.imageUrl} alt={meme.title} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-[var(--c-text)] text-xl font-bold text-center leading-snug px-2">"{meme.title}"</p>
      <button onClick={onNewMeme} disabled={allMemes.length<=1}
        className="mx-auto flex items-center gap-2 px-5 py-2 rounded-lg border border-[var(--c-accent)] text-[var(--c-accent)] text-sm font-medium hover:bg-[var(--c-accent)] hover:text-[#0d0d0d] transition-all duration-150 disabled:opacity-30 btn-base">
        🔀 New Meme
      </button>
    </div>
  );
}

// ─── Alert notification dropdown ────────────────────────────────────────────
function AlertDropdown({ alerts, onDismiss, onClose }: { alerts: TriggeredAlert[]; onDismiss:(id:string)=>void; onClose:()=>void }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl shadow-2xl z-30 animate-modal-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
        <p className="text-[var(--c-text)] font-semibold text-sm">Price Alerts</p>
        <button onClick={onClose} className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors"><X className="w-4 h-4" /></button>
      </div>
      {alerts.length === 0 ? (
        <p className="px-4 py-8 text-[var(--c-muted)] text-sm text-center">No alerts triggered yet</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {alerts.map(alert => (
            <li key={alert.id} className="px-4 py-3 border-b border-[var(--c-border)] last:border-0 flex items-start justify-between gap-3">
              <div>
                <p className="text-[var(--c-text)] text-sm font-medium">
                  {alert.coin_symbol} went <span className={alert.condition==='above'?'text-[var(--c-accent)]':'text-red-400'}>{alert.condition}</span> ${alert.target_price.toLocaleString()}
                </p>
                <p className="text-[var(--c-muted)] text-xs mt-0.5">
                  Current: ${alert.current_price?.toLocaleString()} · {alert.triggered_at?timeAgo(alert.triggered_at):'just now'}
                </p>
              </div>
              <button onClick={() => onDismiss(alert.id)} className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data,           setData]           = useState<DashboardData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState(false);
  const [isStale,        setIsStale]        = useState(false);
  const [votes,          setVotes]          = useState<Record<string,'up'|'down'>>({});
  const [pendingVote,    setPendingVote]    = useState<string|null>(null);
  const [refreshingAI,   setRefreshingAI]   = useState(false);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [selectedCoin,   setSelectedCoin]   = useState<CoinPrice|null>(null);
  const [activeMeme,     setActiveMeme]     = useState<Meme|null>(null);
  const [allMemes,       setAllMemes]       = useState<Meme[]>([]);
  const [lastUpdated,    setLastUpdated]    = useState<Date|null>(null);
  const [secondsAgo,     setSecondsAgo]     = useState(0);
  // Feature 2: toasts
  const [toasts,         setToasts]         = useState<ToastItem[]>([]);
  // Feature 3: watchlist
  const [pinnedCoins,    setPinnedCoins]    = useState<string[]>([]);
  // Feature 4: alerts
  const [triggeredAlerts,setTriggeredAlerts]= useState<TriggeredAlert[]>([]);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Onboarding guard + load pinned coins
  useEffect(() => {
    getPreferences().then(({ data: p }) => {
      if (!p.interested_assets.length || !p.investor_type) { navigate('/onboarding', { replace: true }); return; }
      setPinnedCoins((p as { pinned_coins?: string[] }).pinned_coins ?? []);
    }).catch(() => navigate('/onboarding', { replace: true }));
  }, [navigate]);

  // Seconds-ago ticker
  useEffect(() => {
    const t = setInterval(() => { if (lastUpdated) setSecondsAgo(Math.floor((Date.now()-lastUpdated.getTime())/1000)); }, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  // Close notif dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Toast helper ────────────────────────────────────────────────────────
  function addToast(message: string, type: ToastItem['type'] = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2200);
  }

  // ─── Data loading ─────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoadError(false);
    try {
      const [dash, userVotes] = await Promise.all([getDashboard(), getVotes()]);
      const d = dash.data;
      setData(d);
      setIsStale(false);
      setLastUpdated(new Date());
      if (d.meme && !activeMeme) setActiveMeme(d.meme);
      if (d.meme) setAllMemes(prev => prev.find(m => m.id === d.meme!.id) ? prev : [...prev, d.meme!]);
      if (d.triggered_alerts?.length) {
        setTriggeredAlerts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAlerts = d.triggered_alerts.filter(a => !existingIds.has(a.id));
          if (newAlerts.length) { setNotifOpen(true); addToast(`🔔 ${newAlerts.length} price alert${newAlerts.length>1?'s':''} triggered!`, 'info'); }
          return [...prev, ...newAlerts];
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
        try { const { data: cd } = JSON.parse(cached); setData(cd); if(cd.meme)setActiveMeme(cd.meme); setIsStale(true); } catch {}
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
    const key = `${section}_${itemId}`;
    if (pendingVote===key) return;
    setPendingVote(key);
    try {
      await castVote({ section, item_id: itemId, vote });
      setVotes(prev => ({ ...prev, [key]: vote }));
      addToast(vote==='up' ? '👍 Marked as helpful' : '👎 Marked as not helpful');
    } catch { addToast('Vote failed — try again', 'error'); }
    finally { setPendingVote(null); }
  }

  async function handleRefreshInsight() {
    if (refreshingAI) return;
    setRefreshingAI(true);
    try {
      const dash = await getDashboard();
      setData(prev => prev ? { ...prev, ai_insight: dash.data.ai_insight } : dash.data);
      setLastUpdated(new Date());
    } finally { setRefreshingAI(false); }
  }

  // Feature 3: pin/unpin
  async function handlePinCoin(coinId: string) {
    const isPinned = pinnedCoins.includes(coinId);
    const newPins  = isPinned ? pinnedCoins.filter(id => id !== coinId) : [...pinnedCoins, coinId].slice(0, 5);
    setPinnedCoins(newPins);
    try {
      await api.patch('/api/users/preferences', { pinned_coins: newPins });
      addToast(isPinned ? '⭐ Unpinned from watchlist' : '⭐ Pinned to watchlist');
    } catch { setPinnedCoins(pinnedCoins); addToast('Failed to save', 'error'); }
  }

  // Feature 4: dismiss alert
  async function handleDismissAlert(id: string) {
    try {
      await deleteAlert(id);
      setTriggeredAlerts(prev => prev.filter(a => a.id !== id));
    } catch { addToast('Failed to dismiss alert', 'error'); }
  }

  function handleNewMeme() {
    if (allMemes.length <= 1 || !activeMeme) return;
    const others = allMemes.filter(m => m.id !== activeMeme.id);
    setActiveMeme(others[Math.floor(Math.random() * others.length)]);
  }

  const undismissedAlerts = triggeredAlerts;

  return (
    <div className="min-h-screen bg-[var(--c-bg)]">
      {drawerOpen && <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
      {selectedCoin && data && (
        <CoinModal
          coin={selectedCoin}
          news={data.market_news}
          isPinned={pinnedCoins.includes(selectedCoin.id)}
          onPin={handlePinCoin}
          onClose={() => setSelectedCoin(null)}
        />
      )}
      <ToastContainer toasts={toasts} />

      {/* Navbar */}
      <nav className="sticky top-0 z-10 border-b border-[var(--c-border)] bg-[var(--c-surface)]/90 backdrop-blur-sm px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-bg)] border border-[var(--c-accent)]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--c-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
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

          {/* Bell — Feature 4 */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(o => !o)}
              className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors opacity-80 hover:opacity-100 p-1 relative btn-base" aria-label="Alerts">
              <Bell className="w-4 h-4" />
              {undismissedAlerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {undismissedAlerts.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <AlertDropdown
                alerts={undismissedAlerts}
                onDismiss={handleDismissAlert}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>

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
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
            ⚠️ Showing cached data — you appear to be offline
          </div>
        )}
        {loadError && !isStale && (
          <div className="flex items-center justify-between bg-[var(--c-red-bg)] border border-red-500/20 rounded-xl px-5 py-3 mb-5">
            <p className="text-red-400 text-sm">Failed to load dashboard.</p>
            <button onClick={loadDashboard} className="text-red-400 hover:text-red-300 text-sm underline btn-base">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? <Skeleton /> : data && (
            <Card title="Coin Prices" icon="🪙" section="coin_prices" voteKey="coin_prices_main" votes={votes} pendingVote={pendingVote} onVote={handleVote}>
              <CoinPricesCard coins={data.coin_prices} onCoinClick={setSelectedCoin} pinnedCoins={pinnedCoins} />
            </Card>
          )}
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
          Prices via CoinGecko · AI via OpenRouter / HuggingFace · Auto-refreshes every 60s
        </p>
      </main>
    </div>
  );
}
