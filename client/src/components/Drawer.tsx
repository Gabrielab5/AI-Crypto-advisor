import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">{children}</p>;
}

function Divider() {
  return <div className="border-t border-[#2a2a2a] my-5" />;
}

export default function Drawer({ open, onClose }: DrawerProps) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Password reset state
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg]         = useState('');
  const [resetErr, setResetErr]         = useState('');

  // Escape key closes drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setResetLoading(true); setResetMsg(''); setResetErr('');
    try {
      await api.post('/api/auth/request-password-reset', { email: user.email });
      setResetMsg('Check your inbox — reset link sent!');
    } catch {
      setResetErr('Failed to send reset email. Try again.');
    } finally {
      setResetLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-80 bg-[#1a1a1a] border-l border-[#2a2a2a] z-50 flex flex-col animate-drawer-in overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] shrink-0">
          <h2 className="text-white font-semibold text-sm">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-0">

          {/* ── A. User info ──────────────────────────────────────────── */}
          <SectionTitle>Account</SectionTitle>
          <div className="bg-[#242424] rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88] font-bold">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-gray-500 text-xs truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Password reset */}
          <form onSubmit={handleResetPassword} className="mb-1">
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full text-left flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#2a2a2a] text-gray-300 hover:border-[#3a3a3a] hover:text-white text-sm transition-colors disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
                Change Password
              </span>
              {resetLoading
                ? <svg className="animate-spin w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                : <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              }
            </button>
            {resetMsg && <p className="text-[#00ff88] text-xs mt-2 pl-1">{resetMsg}</p>}
            {resetErr && <p className="text-red-400 text-xs mt-2 pl-1">{resetErr}</p>}
          </form>

          <Divider />

          {/* ── B. Theme toggle ────────────────────────────────────────── */}
          <SectionTitle>Appearance</SectionTitle>
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#2a2a2a] text-sm text-gray-300 hover:border-[#3a3a3a] hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark'
                ? <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
                : <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>
              }
              {theme === 'dark' ? 'Dark mode' : 'Light mode'}
            </span>
            {/* Toggle pill */}
            <div className={`w-11 h-6 rounded-full transition-colors relative ${theme === 'light' ? 'bg-[#00ff88]' : 'bg-[#2a2a2a]'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>

          <Divider />

          {/* ── C. Preferences ─────────────────────────────────────────── */}
          <SectionTitle>Content Preferences</SectionTitle>
          <button
            onClick={() => { navigate('/onboarding'); onClose(); }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#2a2a2a] text-sm text-gray-300 hover:border-[#3a3a3a] hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Edit Preferences
            </span>
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2a2a2a] shrink-0">
          <p className="text-gray-700 text-xs text-center">AI Crypto Advisor · v1.0</p>
        </div>
      </aside>
    </>
  );
}
