import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PLACEHOLDER_CARDS = [
  { label: 'AI Analysis', icon: '🤖', desc: 'GPT-powered market summaries tailored to your portfolio — coming in Stage 4' },
  { label: 'News Feed', icon: '📰', desc: 'Curated crypto news filtered by your assets and sentiment — coming in Stage 5' },
  { label: 'Price Signals', icon: '📈', desc: 'Real-time price alerts and technical signals — coming in Stage 5' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* Navbar */}
      <nav className="sticky top-0 z-10 border-b border-[#2a2a2a] bg-[#1a1a1a]/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#00ff88]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">AI Crypto Advisor</span>
        </div>

        <div className="flex items-center gap-5">
          <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88] text-xs font-bold">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold mb-1">
            Good day, <span className="text-[#00ff88]">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-gray-500 text-sm">Your personalized crypto dashboard is being built.</p>
        </div>

        {/* Auth success banner */}
        <div className="flex items-start gap-3 bg-[#00ff88]/5 border border-[#00ff88]/15 rounded-xl px-5 py-4 mb-8">
          <svg className="w-5 h-5 text-[#00ff88] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-[#00ff88] text-sm font-medium">Stage 2 complete — Auth is live</p>
            <p className="text-gray-500 text-xs mt-0.5">
              JWT stored in localStorage · sent via <code className="text-gray-400">Authorization: Bearer</code> on every API call
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLACEHOLDER_CARDS.map(card => (
            <div
              key={card.label}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#3a3a3a] transition-colors"
            >
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-2">{card.label}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
