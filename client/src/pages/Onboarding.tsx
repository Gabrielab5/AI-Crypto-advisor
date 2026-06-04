import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPreferences, savePreferences } from '../api/preferences';

// ─── Step data ────────────────────────────────────────────────────────────────

interface Option {
  value: string;
  label: string;
  icon: string;
  desc?: string;
}

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
    subtitle: 'Select all that apply',
    type: 'multi',
    options: [
      { value: 'BTC',      label: 'Bitcoin',   icon: '₿' },
      { value: 'ETH',      label: 'Ethereum',  icon: 'Ξ' },
      { value: 'SOL',      label: 'Solana',    icon: '◎' },
      { value: 'BNB',      label: 'BNB',       icon: '⬡' },
      { value: 'XRP',      label: 'XRP',       icon: '✕' },
      { value: 'NFTs',     label: 'NFTs',      icon: '🎨' },
      { value: 'Altcoins', label: 'Altcoins',  icon: '🪙' },
    ],
  },
  {
    key: 'investor_type',
    question: 'What type of investor are you?',
    subtitle: 'Choose one',
    type: 'single',
    options: [
      { value: 'hodler',        label: 'HODLer',           icon: '💎', desc: 'Long-term holder, diamond hands' },
      { value: 'day_trader',    label: 'Day Trader',        icon: '⚡', desc: 'Active trading, short-term gains' },
      { value: 'nft_collector', label: 'NFT Collector',     icon: '🎨', desc: 'Digital art and collectibles' },
      { value: 'beginner',      label: 'Curious Beginner',  icon: '🌱', desc: "Just starting to explore crypto" },
    ],
  },
  {
    key: 'content_types',
    question: 'What content do you want to see?',
    subtitle: 'Select all that apply',
    type: 'multi',
    options: [
      { value: 'market_news',  label: 'Market News',  icon: '📰' },
      { value: 'coin_prices',  label: 'Coin Prices',  icon: '📈' },
      { value: 'ai_insights',  label: 'AI Insights',  icon: '🤖' },
      { value: 'fun_memes',    label: 'Fun Memes',    icon: '😂' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Answers {
  interested_assets: string[];
  investor_type: string;
  content_types: string[];
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [answers, setAnswers] = useState<Answers>({
    interested_assets: [],
    investor_type: '',
    content_types: [],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Pre-fill and detect if already completed
  useEffect(() => {
    getPreferences()
      .then(({ data }) => {
        const complete =
          data.interested_assets.length > 0 &&
          !!data.investor_type &&
          data.content_types.length > 0;
        setHasExisting(complete);
        if (complete) {
          setAnswers({
            interested_assets: data.interested_assets,
            investor_type: data.investor_type!,
            content_types: data.content_types,
          });
        }
      })
      .catch(() => {/* no prefs yet — that's fine */})
      .finally(() => setChecking(false));
  }, []);

  // ─── Selection handlers ─────────────────────────────────────────────────────

  function toggleMulti(field: 'interested_assets' | 'content_types', value: string) {
    setAnswers(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
    setError('');
  }

  function selectSingle(value: string) {
    setAnswers(prev => ({ ...prev, investor_type: value }));
    setError('');
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    if (step === 0 && answers.interested_assets.length === 0) {
      setError('Select at least one asset to continue');
      return false;
    }
    if (step === 1 && !answers.investor_type) {
      setError('Choose your investor type to continue');
      return false;
    }
    if (step === 2 && answers.content_types.length === 0) {
      setError('Select at least one content type to continue');
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validate()) return;
    setDirection('forward');
    setError('');
    setStep(s => s + 1);
  }

  function goBack() {
    setDirection('back');
    setError('');
    setStep(s => s - 1);
  }

  async function handleFinish() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await savePreferences({
        interested_assets: answers.interested_assets,
        investor_type: answers.investor_type,
        content_types: answers.content_types,
      });
      navigate('/dashboard');
    } catch {
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Spinner />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const currentStep = STEPS[step];
  const progress = ((step) / STEPS.length) * 100;

  function isSelected(option: Option): boolean {
    if (currentStep.type === 'multi') {
      const field = currentStep.key as 'interested_assets' | 'content_types';
      return answers[field].includes(option.value);
    }
    return answers.investor_type === option.value;
  }

  const selectedClass =
    'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.15)]';
  const unselectedClass =
    'bg-[#1a1a1a] border-[#2a2a2a] text-gray-300 hover:border-[#3a3a3a] hover:text-white';

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="px-6 pt-6 pb-0">
        <div className="max-w-2xl mx-auto">
          {/* Brand + skip */}
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
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                Skip →
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex-1 h-1 rounded-full bg-[#2a2a2a] overflow-hidden">
                <div
                  className="h-full bg-[#00ff88] rounded-full transition-all duration-500 ease-out"
                  style={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }}
                />
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs text-right">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
      </header>

      {/* ── Step content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 pt-10 pb-8">
        <div className="w-full max-w-2xl">

          {/* Animated container — key change triggers remount + animation */}
          <div
            key={step}
            className={direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}
          >
            <h2 className="text-white text-2xl font-bold mb-1.5 tracking-tight">
              {currentStep.question}
            </h2>
            <p className="text-gray-500 text-sm mb-7">{currentStep.subtitle}</p>

            {/* ── Asset pills (step 0) ─────────────────────────────────────── */}
            {currentStep.type === 'multi' && currentStep.key === 'interested_assets' && (
              <div className="flex flex-wrap gap-3">
                {currentStep.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleMulti('interested_assets', opt.value)}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-full border text-sm font-medium transition-all duration-150 ${
                      isSelected(opt) ? selectedClass : unselectedClass
                    }`}
                  >
                    <span className="text-base leading-none">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Investor type cards (step 1) ─────────────────────────────── */}
            {currentStep.type === 'single' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentStep.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => selectSingle(opt.value)}
                    className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-150 ${
                      isSelected(opt) ? selectedClass : unselectedClass
                    }`}
                  >
                    <span className="text-2xl leading-none mt-0.5">{opt.icon}</span>
                    <div>
                      <p className={`font-semibold text-sm mb-0.5 ${isSelected(opt) ? 'text-[#00ff88]' : 'text-white'}`}>
                        {opt.label}
                      </p>
                      {opt.desc && (
                        <p className={`text-xs leading-relaxed ${isSelected(opt) ? 'text-[#00ff88]/70' : 'text-gray-500'}`}>
                          {opt.desc}
                        </p>
                      )}
                    </div>
                    {isSelected(opt) && (
                      <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-[#00ff88] flex items-center justify-center">
                        <svg className="w-3 h-3 text-[#0d0d0d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Content type cards (step 2) ──────────────────────────────── */}
            {currentStep.type === 'multi' && currentStep.key === 'content_types' && (
              <div className="grid grid-cols-2 gap-3">
                {currentStep.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleMulti('content_types', opt.value)}
                    className={`flex items-center gap-3 p-5 rounded-xl border text-left transition-all duration-150 ${
                      isSelected(opt) ? selectedClass : unselectedClass
                    }`}
                  >
                    <span className="text-2xl leading-none">{opt.icon}</span>
                    <span className={`font-medium text-sm ${isSelected(opt) ? 'text-[#00ff88]' : 'text-white'}`}>
                      {opt.label}
                    </span>
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
            )}
          </div>

          {/* ── Error ───────────────────────────────────────────────────────── */}
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

          {/* ── Navigation ──────────────────────────────────────────────────── */}
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
                className="flex items-center gap-2 bg-[#00ff88] text-[#0d0d0d] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#00cc6a] transition-colors text-sm"
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
                className="flex items-center gap-2 bg-[#00ff88] text-[#0d0d0d] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#00cc6a] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && <Spinner />}
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
