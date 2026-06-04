import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPreferences, savePreferences } from '../api/preferences';

// ─── Step data ────────────────────────────────────────────────────────────────

interface Option { value: string; label: string; icon: string; desc?: string; group?: string }
interface Step {
  key: 'interested_assets' | 'investor_type' | 'content_types';
  question: string;
  subtitle: string;
  type: 'multi' | 'single';
  options: Option[];
}

const STEPS: Step[] = [
  {
    key: 'interested_assets',
    question: 'Which crypto assets interest you?',
    subtitle: 'Select everything that catches your eye — you can change this later',
    type: 'multi',
    options: [
      // Major coins
      { value: 'BTC',       label: 'Bitcoin',     icon: '₿',  group: 'Top Coins' },
      { value: 'ETH',       label: 'Ethereum',    icon: 'Ξ',  group: 'Top Coins' },
      { value: 'SOL',       label: 'Solana',      icon: '◎',  group: 'Top Coins' },
      { value: 'BNB',       label: 'BNB',         icon: '⬡',  group: 'Top Coins' },
      { value: 'XRP',       label: 'XRP',         icon: '✕',  group: 'Top Coins' },
      // Altcoins
      { value: 'DOGE',      label: 'Dogecoin',    icon: '🐕', group: 'Altcoins' },
      { value: 'ADA',       label: 'Cardano',     icon: '₳',  group: 'Altcoins' },
      { value: 'AVAX',      label: 'Avalanche',   icon: '🔺', group: 'Altcoins' },
      { value: 'MATIC',     label: 'Polygon',     icon: '⬡',  group: 'Altcoins' },
      { value: 'LINK',      label: 'Chainlink',   icon: '🔗', group: 'Altcoins' },
      { value: 'DOT',       label: 'Polkadot',    icon: '●',  group: 'Altcoins' },
      { value: 'ATOM',      label: 'Cosmos',      icon: '⚛️', group: 'Altcoins' },
      // Sectors / themes
      { value: 'DeFi',      label: 'DeFi',        icon: '🏦', group: 'Sectors' },
      { value: 'NFTs',      label: 'NFTs',        icon: '🎨', group: 'Sectors' },
      { value: 'GameFi',    label: 'GameFi',      icon: '🎮', group: 'Sectors' },
      { value: 'Layer2s',   label: 'Layer 2s',    icon: '⚡', group: 'Sectors' },
      { value: 'Memecoins', label: 'Memecoins',   icon: '🚀', group: 'Sectors' },
      { value: 'Altcoins',  label: 'All Altcoins',icon: '🪙', group: 'Sectors' },
    ],
  },
  {
    key: 'investor_type',
    question: 'What type of investor are you?',
    subtitle: 'Pick the one that fits you best right now',
    type: 'single',
    options: [
      { value: 'hodler',        label: 'HODLer',             icon: '💎', desc: 'Buy and hold long-term. Diamond hands only.' },
      { value: 'day_trader',    label: 'Day Trader',          icon: '⚡', desc: 'Active daily trading for short-term gains.' },
      { value: 'swing_trader',  label: 'Swing Trader',        icon: '📊', desc: 'Holds positions for days to weeks on momentum.' },
      { value: 'defi_farmer',   label: 'DeFi Farmer',         icon: '🌾', desc: 'Yield farming, liquidity pools, and staking.' },
      { value: 'nft_collector', label: 'NFT Collector',       icon: '🎨', desc: 'Digital art, PFPs, and on-chain collectibles.' },
      { value: 'tech_analyst',  label: 'Technical Analyst',   icon: '📈', desc: 'Chart patterns, indicators, and TA setups.' },
      { value: 'diversified',   label: 'Diversified',         icon: '🎯', desc: 'Balanced mix of strategies and asset types.' },
      { value: 'beginner',      label: 'Curious Beginner',    icon: '🌱', desc: 'Just starting out and learning the ropes.' },
    ],
  },
  {
    key: 'content_types',
    question: 'What content do you want to see?',
    subtitle: 'Your dashboard will be filtered around your selections',
    type: 'multi',
    options: [
      { value: 'coin_prices',    label: 'Coin Prices',        icon: '📈' },
      { value: 'market_news',    label: 'Market News',        icon: '📰' },
      { value: 'ai_insights',    label: 'AI Insights',        icon: '🤖' },
      { value: 'fun_memes',      label: 'Fun Memes',          icon: '😂' },
      { value: 'tech_analysis',  label: 'Technical Analysis', icon: '📊' },
      { value: 'onchain_data',   label: 'On-chain Data',      icon: '🔍' },
      { value: 'regulatory',     label: 'Regulatory News',    icon: '⚖️' },
      { value: 'project_updates',label: 'Project Updates',    icon: '🛠️' },
    ],
  },
];

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  const s = sm ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <svg className={`animate-spin ${s}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Answers {
  interested_assets: string[];
  investor_type: string;
  content_types: string[];
}

export default function Onboarding() {
  const navigate = useNavigate();

  const [step, setStep]           = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [answers, setAnswers]     = useState<Answers>({ interested_assets: [], investor_type: '', content_types: [] });
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [checking, setChecking]   = useState(true);

  useEffect(() => {
    getPreferences()
      .then(({ data }) => {
        const complete = data.interested_assets.length > 0 && !!data.investor_type && data.content_types.length > 0;
        setHasExisting(complete);
        if (complete) setAnswers({ interested_assets: data.interested_assets, investor_type: data.investor_type!, content_types: data.content_types });
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // ─── Selection ────────────────────────────────────────────────────────────

  function toggleMulti(field: 'interested_assets' | 'content_types', value: string) {
    setAnswers(prev => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
    setError('');
  }

  function selectSingle(value: string) {
    setAnswers(prev => ({ ...prev, investor_type: value }));
    setError('');
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  function validate() {
    if (step === 0 && answers.interested_assets.length === 0) { setError('Select at least one asset to continue'); return false; }
    if (step === 1 && !answers.investor_type) { setError('Choose your investor type to continue'); return false; }
    if (step === 2 && answers.content_types.length === 0) { setError('Select at least one content type to continue'); return false; }
    return true;
  }

  function goNext() {
    if (!validate()) return;
    setDirection('forward'); setError(''); setStep(s => s + 1);
  }
  function goBack() {
    setDirection('back'); setError(''); setStep(s => s - 1);
  }

  async function handleFinish() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await savePreferences({ interested_assets: answers.interested_assets, investor_type: answers.investor_type, content_types: answers.content_types });
      navigate('/dashboard');
    } catch {
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  if (checking) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500"><Spinner /><span className="text-sm">Loading…</span></div>
    </div>
  );

  const currentStep = STEPS[step];

  function isSelected(opt: Option) {
    if (currentStep.type === 'multi') return answers[currentStep.key as 'interested_assets' | 'content_types'].includes(opt.value);
    return answers.investor_type === opt.value;
  }

  // Group assets by their group label
  const groups = currentStep.options.reduce<Record<string, Option[]>>((acc, opt) => {
    const g = opt.group ?? '';
    acc[g] = acc[g] ? [...acc[g], opt] : [opt];
    return acc;
  }, {});
  const hasGroups = Object.keys(groups).some(k => k !== '');

  const selBase    = 'transition-all duration-150 border';
  const selActive  = 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88] shadow-[0_0_14px_rgba(0,255,136,0.12)]';
  const selInactive= 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-300 hover:border-[#3a3a3a] hover:bg-[#1f1f1f] hover:text-white';

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">

      {/* Header */}
      <header className="px-6 pt-6 pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#00ff88]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-white text-sm font-semibold">AI Crypto Advisor</span>
            </div>
            {hasExisting && (
              <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                Skip →
              </button>
            )}
          </div>

          {/* Progress segments */}
          <div className="flex items-center gap-2 mb-1.5">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex-1 h-1 rounded-full bg-[#2a2a2a] overflow-hidden">
                <div
                  className="h-full bg-[#00ff88] rounded-full transition-all duration-500 ease-out"
                  style={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <p className="text-gray-600 text-xs">Step {step + 1} of {STEPS.length}</p>
            <p className="text-gray-600 text-xs">
              {step === 0 ? `${answers.interested_assets.length} selected` :
               step === 2 ? `${answers.content_types.length} selected` : ''}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 pt-9 pb-8">
        <div className="w-full max-w-2xl">

          {/* Animated slide */}
          <div key={step} className={direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>
            <h2 className="text-white text-2xl font-bold mb-1.5 tracking-tight">{currentStep.question}</h2>
            <p className="text-gray-500 text-sm mb-7">{currentStep.subtitle}</p>

            {/* ── Multi-select with group labels ─────────────────────────── */}
            {currentStep.type === 'multi' && (
              <div className="space-y-5">
                {hasGroups
                  ? Object.entries(groups).map(([group, opts]) => (
                      <div key={group}>
                        {group && <p className="text-gray-600 text-xs font-medium uppercase tracking-wider mb-2.5">{group}</p>}
                        <div className="flex flex-wrap gap-2">
                          {opts.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => toggleMulti(currentStep.key as 'interested_assets' | 'content_types', opt.value)}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${selBase} ${isSelected(opt) ? selActive : selInactive}`}
                            >
                              <span className="text-base leading-none">{opt.icon}</span>
                              {opt.label}
                              {isSelected(opt) && (
                                <span className="ml-0.5 w-4 h-4 rounded-full bg-[#00ff88] flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-[#0d0d0d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  : (
                    <div className="grid grid-cols-2 gap-3">
                      {currentStep.options.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => toggleMulti(currentStep.key as 'interested_assets' | 'content_types', opt.value)}
                          className={`flex items-center gap-3 p-4 rounded-xl text-left ${selBase} ${isSelected(opt) ? selActive : selInactive}`}
                        >
                          <span className="text-xl leading-none shrink-0">{opt.icon}</span>
                          <span className={`font-medium text-sm ${isSelected(opt) ? 'text-[#00ff88]' : 'text-white'}`}>{opt.label}</span>
                          {isSelected(opt) && (
                            <div className="ml-auto shrink-0 w-4 h-4 rounded-full bg-[#00ff88] flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-[#0d0d0d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ── Single-select cards ────────────────────────────────────── */}
            {currentStep.type === 'single' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentStep.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => selectSingle(opt.value)}
                    className={`flex items-start gap-4 p-4 rounded-xl text-left ${selBase} ${isSelected(opt) ? selActive : selInactive}`}
                  >
                    <span className="text-2xl leading-none mt-0.5 shrink-0">{opt.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm mb-0.5 ${isSelected(opt) ? 'text-[#00ff88]' : 'text-white'}`}>{opt.label}</p>
                      {opt.desc && <p className={`text-xs leading-relaxed ${isSelected(opt) ? 'text-[#00ff88]/65' : 'text-gray-500'}`}>{opt.desc}</p>}
                    </div>
                    {isSelected(opt) && (
                      <div className="shrink-0 w-5 h-5 rounded-full bg-[#00ff88] flex items-center justify-center mt-0.5">
                        <svg className="w-3 h-3 text-[#0d0d0d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          <div className="h-6 mt-5">
            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                {error}
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goBack}
              disabled={step === 0}
              className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors disabled:opacity-0 disabled:pointer-events-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                className="flex items-center gap-2 bg-[#00ff88] text-[#0d0d0d] font-semibold px-6 py-2.5 rounded-xl hover:bg-[#00cc6a] transition-colors text-sm"
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={submitting}
                className="flex items-center gap-2 bg-[#00ff88] text-[#0d0d0d] font-semibold px-6 py-2.5 rounded-xl hover:bg-[#00cc6a] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && <Spinner sm />}
                {submitting ? 'Saving…' : 'Finish & go to dashboard'}
                {!submitting && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
