import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboard, type CoinPrice, type NewsItem, type AIInsight, type Meme, type DashboardData } from '../api/dashboard';
import { getPreferences } from '../api/preferences';
import { castVote, getVotes, type VoteRecord } from '../api/votes';
import Drawer from '../components/Drawer';

const REFRESH_INTERVAL = 60_000; // 60 s
const LS_KEY = 'dashboard_cache';

// ─── Helpers ──────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name?.split(' ')[0] ?? 'Anon'} 🚀`;
}
function fmt(n: number) {
  return n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toPrecision(4);
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 animate-pulse">
      <div className="flex justify-between items-center mb-5">
        <div className="h-4 w-32 bg-[#2a2a2a] rounded" />
        <div className="flex gap-2"><div className="h-7 w-7 bg-[#2a2a2a] rounded-lg" /><div className="h-7 w-7 bg-[#2a2a2a] rounded-lg" /></div>
      </div>
      <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-3 bg-[#2a2a2a] rounded" style={{width:`${50+i*10}%`}} />)}</div>
    </div>
  );
}

interface VoteBtnProps { section: string; itemId: string; current: 'up'|'down'|null; pending: boolean; onVote:(s:string,id:string,v:'up'|'down')=>void; }
function VoteButtons({ section, itemId, current, pending, onVote }: VoteBtnProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {(['up','down'] as const).map(v => (
        <button key={v} onClick={() => onVote(section, itemId, v)} disabled={pending} title={v === 'up' ? 'Helpful' : 'Not helpful'}
          className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all disabled:opacity-40
            ${current === v
              ? v === 'up' ? 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_8px_rgba(0,255,136,0.2)]'
                           : 'bg-red-500/10 text-red-400 border border-red-500/25'
              : 'bg-[#242424] text-gray-500 border border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a]'}`}>
          {v === 'up' ? '👍' : '👎'}
        </button>
      ))}
    </div>
  );
}

interface CardProps { title: string; icon: string; section: string; itemId?: string; voteKey: string; votes: Record<string,'up'|'down'>; pendingVote:string|null; onVote:(s:string,id:string,v:'up'|'down')=>void; children: React.ReactNode; }
function Card({ title, icon, section, itemId='main', voteKey, votes, pendingVote, onVote, children }: CardProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col hover:border-[#3a3a3a] transition-colors">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2"><span className="text-lg">{icon}</span><h3 className="text-white font-semibold text-sm">{title}</h3></div>
        <VoteButtons section={section} itemId={itemId} current={votes[voteKey]??null} pending={pendingVote===voteKey} onVote={onVote} />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────

function CoinPricesCard({ coins }: { coins: CoinPrice[] }) {
  if (!coins.length) return <p className="text-gray-600 text-sm">No coin data.</p>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead><tr className="text-gray-600 text-xs"><th className="text-left pb-3 pl-1 font-medium">Coin</th><th className="text-right pb-3 font-medium">Price</th><th className="text-right pb-3 pr-1 font-medium">24h</th></tr></thead>
        <tbody className="divide-y divide-[#242424]">
          {coins.map(c => (
            <tr key={c.id} className="hover:bg-[#242424]/50 transition-colors">
              <td className="py-2.5 pl-1"><div className="flex items-center gap-2.5"><img src={c.image} alt={c.symbol} className="w-6 h-6 rounded-full" /><div><span className="text-white font-medium">{c.symbol}</span><span className="text-gray-600 text-xs ml-1.5 hidden sm:inline">{c.name}</span></div></div></td>
              <td className="py-2.5 text-right text-white font-mono text-xs">${fmt(c.price)}</td>
              <td className={`py-2.5 pr-1 text-right font-mono text-xs font-medium ${c.change_24h >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>{c.change_24h >= 0 ? '+' : ''}{c.change_24h.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketNewsCard({ news }: { news: NewsItem[] }) {
  return (
    <ul className="space-y-3">
      {news.map((item, i) => (
        <li key={item.id}>
          <a href={item.url !== '#' ? item.url : undefined} target={item.url !== '#' ? '_blank' : undefined} rel="noopener noreferrer" className={`group flex items-start gap-3 ${item.url !== '#' ? 'cursor-pointer' : 'cursor-default'}`}>
            <span className="text-gray-700 text-xs font-mono mt-0.5 w-4 shrink-0">{String(i+1).padStart(2,'0')}</span>
            <div className="min-w-0">
              <p className={`text-gray-300 text-xs leading-relaxed line-clamp-2 ${item.url !== '#' ? 'group-hover:text-white transition-colors' : ''}`}>{item.title}</p>
              <div className="flex items-center gap-2 mt-1"><span className="text-gray-600 text-xs">{item.source}</span><span className="text-gray-700 text-xs">·</span><span className="text-gray-700 text-xs">{timeAgo(item.published_at)}</span></div>
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
        <span className="text-[#00ff88]/20 text-6xl font-serif absolute -top-2 -left-1 leading-none select-none">"</span>
        <p className="text-gray-300 text-sm leading-relaxed pl-5 italic">{insight.text}</p>
      </blockquote>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#242424]">
        <div><span className="text-gray-600 text-xs">{insight.model === 'fallback' || insight.model === 'static' ? 'Static insight' : insight.model.split('/').pop()}</span><span className="text-gray-700 text-xs ml-2">{timeAgo(insight.generated_at)}</span></div>
        <button onClick={onRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-[#00ff88] hover:text-[#00cc6a] transition-colors disabled:opacity-50">
          <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
          {refreshing ? 'Generating…' : 'New insight'}
        </button>
      </div>
    </div>
  );
}

function MemeCard({ meme }: { meme: Meme }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl overflow-hidden bg-[#242424] aspect-video">
        <img src={meme.imageUrl} alt={meme.title} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-gray-300 text-xs leading-relaxed text-center italic">"{meme.title}"</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data,           setData]           = useState<DashboardData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState(false);
  const [isStale,        setIsStale]        = useState(false);
  const [votes,          setVotes]          = useState<Record<string,'up'|'down'>>({});
  const [pendingVote,    setPendingVote]    = useState<string | null>(null);
  const [refreshingAI,   setRefreshingAI]   = useState(false);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null);
  const [secondsAgo,     setSecondsAgo]     = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Onboarding guard
  useEffect(() => {
    getPreferences().then(({ data: p }) => {
      if (!p.interested_assets.length || !p.investor_type)
        navigate('/onboarding', { replace: true });
    }).catch(() => navigate('/onboarding', { replace: true }));
  }, [navigate]);

  // "X seconds ago" ticker
  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  // ─── Data loading ─────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    setLoadError(false);
    try {
      const [dash, userVotes] = await Promise.all([getDashboard(), getVotes()]);
      const d = dash.data;
      setData(d);
      setIsStale(false);
      setLastUpdated(new Date());
      localStorage.setItem(LS_KEY, JSON.stringify({ data: d, at: Date.now() }));

      const voteMap: Record<string,'up'|'down'> = {};
      for (const v of (userVotes.data as VoteRecord[])) {
        voteMap[`${v.section}_${v.item_id}`] = v.vote === 1 ? 'up' : 'down';
      }
      setVotes(voteMap);
    } catch {
      setLoadError(true);
      // Try localStorage fallback
      const cached = localStorage.getItem(LS_KEY);
      if (cached && !data) {
        try {
          const { data: cachedData } = JSON.parse(cached);
          setData(cachedData);
          setIsStale(true);
        } catch { /* ignore parse errors */ }
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load + 60s interval
  useEffect(() => {
    loadDashboard();
    intervalRef.current = setInterval(loadDashboard, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadDashboard]);

  async function handleVote(section: string, itemId: string, vote: 'up' | 'down') {
    const key = `${section}_${itemId}`;
    if (pendingVote === key) return;
    setPendingVote(key);
    try {
      await castVote({ section, item_id: itemId, vote });
      setVotes(prev => ({ ...prev, [key]: vote }));
    } finally {
      setPendingVote(null);
    }
  }

  async function handleRefreshInsight() {
    if (refreshingAI) return;
    setRefreshingAI(true);
    try {
      const dash = await getDashboard();
      setData(prev => prev ? { ...prev, ai_insight: dash.data.ai_insight } : dash.data);
      setLastUpdated(new Date());
    } finally {
      setRefreshingAI(false);
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Navbar */}
      <nav className="sticky top-0 z-10 border-b border-[#2a2a2a] bg-[#1a1a1a]/90 backdrop-blur-sm px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#00ff88]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">AI Crypto Advisor</span>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdated && !loading && (
            <span className="text-gray-600 text-xs hidden md:block">
              Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
            </span>
          )}
          <span className="text-gray-500 text-xs hidden sm:block">{user?.email}</span>
          <div className="w-7 h-7 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88] text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <button onClick={handleLogout} className="text-gray-500 hover:text-white text-xs transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            Sign out
          </button>
          {/* Hamburger */}
          <button onClick={() => setDrawerOpen(true)} className="text-gray-500 hover:text-white transition-colors p-1" aria-label="Open settings">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-7">
          <h1 className="text-white text-2xl font-bold tracking-tight">{greeting(user?.name ?? '')}</h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening in the market today.</p>
        </div>

        {/* Stale data banner */}
        {isStale && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-3 mb-5 text-yellow-400 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
            ⚠️ Showing cached data — you appear to be offline
          </div>
        )}

        {/* Error bar */}
        {loadError && !isStale && (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 mb-5">
            <p className="text-red-400 text-sm">Failed to load dashboard.</p>
            <button onClick={loadDashboard} className="text-red-400 hover:text-red-300 text-sm underline">Retry</button>
          </div>
        )}

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? <Skeleton /> : data && (
            <Card title="Coin Prices" icon="🪙" section="coin_prices" voteKey="coin_prices_main" votes={votes} pendingVote={pendingVote} onVote={handleVote}>
              <CoinPricesCard coins={data.coin_prices} />
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
          {loading ? <Skeleton /> : data?.meme && (
            <Card title="Meme of the Day" icon="😂" section="meme" itemId={data.meme.id} voteKey={`meme_${data.meme.id}`} votes={votes} pendingVote={pendingVote} onVote={handleVote}>
              <MemeCard meme={data.meme} />
            </Card>
          )}
        </div>

        <p className="text-gray-700 text-xs text-center mt-10">
          Prices via CoinGecko · AI via OpenRouter / HuggingFace · Auto-refreshes every 60s
        </p>
      </main>
    </div>
  );
}
