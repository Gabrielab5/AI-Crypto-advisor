import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { getPreferences } from '../api/preferences';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.token) navigate('/dashboard', { replace: true });
  }, [auth.token, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    if (Object.keys(next).length) { setErrors(next); return; }

    setLoading(true);
    try {
      const res = await loginApi({ email: email.trim(), password });
      auth.login(res.data.token, res.data.user);
      // Token is now in localStorage; axios interceptor will use it immediately.
      // Route to onboarding if the user hasn't set preferences yet.
      try {
        const { data: prefs } = await getPreferences();
        const onboarded = prefs.interested_assets.length > 0 && !!prefs.investor_type;
        navigate(onboarded ? '/dashboard' : '/onboarding');
      } catch {
        navigate('/onboarding');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? 'Something went wrong. Please try again.';
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    'w-full bg-[#242424] border text-white rounded-lg px-4 py-3 text-sm outline-none transition-colors placeholder-gray-600 focus:border-[#00ff88]';

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-4">
      <BrandLogo />

      <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-8">
        <h2 className="text-white font-semibold text-lg mb-1">Sign in</h2>
        <p className="text-gray-500 text-sm mb-6">Welcome back</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={`${inputBase} ${errors.email ? 'border-red-500' : 'border-[#2a2a2a]'}`}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`${inputBase} ${errors.password ? 'border-red-500' : 'border-[#2a2a2a]'}`}
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full bg-[#00ff88] text-[#0d0d0d] font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#00cc6a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Spinner />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-6">
          No account?{' '}
          <Link
            to="/register"
            className="text-[#00ff88] hover:text-[#00cc6a] font-medium transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
