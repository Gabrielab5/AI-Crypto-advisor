import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00ff88]/10 border border-[#00ff88]/20 mb-6">
          <svg className="w-8 h-8 text-[#00ff88]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.819m2.562-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>

        <h1 className="text-white text-3xl font-bold mb-3">
          Welcome, <span className="text-[#00ff88]">{user?.name?.split(' ')[0]}</span>
        </h1>
        <p className="text-gray-400 text-base mb-10 leading-relaxed">
          Your account is ready. In the next step you'll tell us which assets you follow,
          your risk profile, and the type of content you want — so we can personalize
          everything for you.
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {['Account', 'Preferences', 'Dashboard'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 text-xs font-medium ${i === 0 ? 'text-[#00ff88]' : 'text-gray-600'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border
                  ${i === 0
                    ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]'
                    : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-600'
                  }`}>
                  {i === 0 ? '✓' : i + 1}
                </div>
                <span>{step}</span>
              </div>
              {i < 2 && <div className="w-8 h-px bg-[#2a2a2a]" />}
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 bg-[#00ff88] text-[#0d0d0d] font-semibold px-8 py-3 rounded-lg hover:bg-[#00cc6a] transition-colors"
        >
          Continue to Dashboard
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>

        <p className="text-gray-600 text-xs mt-4">
          Preferences wizard coming in Stage 3
        </p>
      </div>
    </div>
  );
}
