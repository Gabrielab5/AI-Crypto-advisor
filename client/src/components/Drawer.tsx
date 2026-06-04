import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Moon, Sliders, Sun, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[var(--c-muted)] text-xs font-semibold uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-[var(--c-border)] my-6" />;
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
      <aside className="fixed right-0 top-0 h-full w-80 bg-[var(--c-surface)] border-l border-[var(--c-border)] z-50 flex flex-col animate-drawer-in overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] shrink-0">
          <h2 className="text-[var(--c-text)] font-semibold text-sm">Settings</h2>
          <button onClick={onClose} className="text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-6">

          {/* ── A. User info ──────────────────────────────────────────── */}
          <div>
            <SectionTitle>Account</SectionTitle>
            <div className="bg-[var(--c-s2)] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--c-accent)]/10 border border-[var(--c-accent)]/20 flex items-center justify-center text-[var(--c-accent)] font-bold">
                  {user?.name?.[0]?.toUpperCase() ?? <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[var(--c-text)] text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-[var(--c-muted)] text-xs truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Password reset */}
            <form onSubmit={handleResetPassword}>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--c-border)] text-[var(--c-text-2)] hover:border-[var(--c-s3)] hover:text-[var(--c-text)] text-sm transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[var(--c-muted)]" />
                  Change Password
                </span>
                {resetLoading
                  ? <svg className="animate-spin w-4 h-4 text-[var(--c-muted)]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg className="w-3.5 h-3.5 text-[var(--c-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                }
              </button>
              {resetMsg && <p className="text-[var(--c-accent)] text-xs mt-2 pl-1">{resetMsg}</p>}
              {resetErr && <p className="text-red-400 text-xs mt-2 pl-1">{resetErr}</p>}
            </form>
          </div>

          <Divider />

          {/* ── B. Theme toggle ────────────────────────────────────────── */}
          <div>
            <SectionTitle>Appearance</SectionTitle>
            <button
              onClick={toggle}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--c-border)] text-sm text-[var(--c-text-2)] hover:border-[var(--c-s3)] hover:text-[var(--c-text)] transition-colors"
            >
              <span className="flex items-center gap-2">
                {theme === 'dark'
                  ? <Moon className="w-4 h-4 text-[var(--c-muted)]" />
                  : <Sun className="w-4 h-4 text-yellow-400" />
                }
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
              {/* Toggle pill */}
              <div className={`w-11 h-6 rounded-full transition-colors relative ${theme === 'light' ? 'bg-[var(--c-accent)]' : 'bg-[var(--c-border)]'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </button>
          </div>

          <Divider />

          {/* ── C. Preferences ─────────────────────────────────────────── */}
          <div>
            <SectionTitle>Content Preferences</SectionTitle>
            <button
              onClick={() => { navigate('/onboarding'); onClose(); }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--c-border)] text-sm text-[var(--c-text-2)] hover:border-[var(--c-s3)] hover:text-[var(--c-text)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--c-muted)]" />
                Edit Preferences
              </span>
              <svg className="w-3.5 h-3.5 text-[var(--c-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--c-border)] shrink-0">
          <p className="text-[var(--c-muted)] text-xs text-center">AI Crypto Advisor · v1.0</p>
        </div>
      </aside>
    </>
  );
}
