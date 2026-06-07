import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import BrandLogo from '../components/BrandLogo';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  useEffect(() => { document.title = 'Reset Password | AI Crypto Advisor'; }, []);

  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] flex flex-col items-center justify-center px-4">
        <BrandLogo />
        <div className="w-full max-w-sm bg-[var(--c-surface)] rounded-2xl border border-[var(--c-border)] p-8 text-center">
          <p className="text-red-400 text-sm">Invalid or missing reset link. Please request a new one.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    'w-full bg-[var(--c-s2)] border text-[var(--c-text)] rounded-lg px-4 py-3 text-sm outline-none transition-colors placeholder-[var(--c-muted)] focus:border-[var(--c-accent)]';

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col items-center justify-center px-4">
      <BrandLogo />

      <div className="w-full max-w-sm bg-[var(--c-surface)] rounded-2xl border border-[var(--c-border)] p-8">
        <h2 className="text-[var(--c-text)] font-semibold text-lg mb-1">Set new password</h2>
        <p className="text-[var(--c-muted)] text-sm mb-6">Enter and confirm your new password below.</p>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-4 text-center">
            <p className="text-green-400 font-medium text-sm">Password updated successfully!</p>
            <p className="text-[var(--c-muted)] text-xs mt-1">Redirecting to your dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className={`${inputBase} border-[var(--c-border)]`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                className={`${inputBase} ${confirm && confirm !== password ? 'border-red-500' : 'border-[var(--c-border)]'}`}
              />
              {confirm && confirm !== password && (
                <p className="text-red-400 text-xs mt-1.5">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full bg-[var(--c-accent)] text-[var(--c-bg)] font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--c-accent-2)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Spinner />}
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
