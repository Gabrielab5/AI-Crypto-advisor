import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Login from '../pages/Login';

vi.mock('../api/auth', () => ({
  login:                vi.fn(),
  requestPasswordReset: vi.fn(),
}));
vi.mock('../api/preferences', () => ({
  getPreferences: vi.fn(),
}));

import * as authApi from '../api/auth';
import * as prefsApi from '../api/preferences';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

function Wrapper() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter><Login /></MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

// ─── Login form ────────────────────────────────────────────────────────────────

test('renders email and password fields', () => {
  render(<Wrapper />);
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
});

test('renders "Forgot password?" link', () => {
  render(<Wrapper />);
  expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
});

test('shows error when fields are empty', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(screen.getByText('Email is required')).toBeInTheDocument();
});

test('shows API error message on failed login', async () => {
  (authApi.login as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
    response: { data: { error: 'Invalid credentials' } },
  });
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
});

test('redirects to dashboard on successful login with prefs', async () => {
  (authApi.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { token: 'tok', user: { id:'1', name:'A', email:'a@b.com' } },
  });
  (prefsApi.getPreferences as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { interested_assets: ['BTC'], investor_type: 'hodler', content_types: [] },
  });
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
});

test('redirects to onboarding when no prefs', async () => {
  (authApi.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { token: 'tok', user: { id:'1', name:'A', email:'a@b.com' } },
  });
  (prefsApi.getPreferences as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { interested_assets: [], investor_type: null, content_types: [] },
  });
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'));
});

// ─── Forgot-password flow ──────────────────────────────────────────────────────

test('clicking "Forgot password?" switches to the reset view', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  expect(screen.getByText('Reset your password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
});

test('reset view pre-fills the email typed in the login form', async () => {
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  expect(screen.getByDisplayValue('user@example.com')).toBeInTheDocument();
});

test('"Back to sign in" restores the login form', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.queryByText('Reset your password')).not.toBeInTheDocument();
});

test('shows validation error when submitting with empty email', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  // clear any pre-filled value
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();
  expect(authApi.requestPasswordReset).not.toHaveBeenCalled();
});

test('shows validation error for invalid email format', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.type(emailField, 'not-an-email');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  expect(authApi.requestPasswordReset).not.toHaveBeenCalled();
});

test('shows "no account found" error when API returns 404', async () => {
  (authApi.requestPasswordReset as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
    response: { data: { error: 'No account found with that email address.' } },
  });
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.type(emailField, 'ghost@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  await waitFor(() =>
    expect(screen.getByText('No account found with that email address.')).toBeInTheDocument()
  );
});

test('shows "Create an account" link after "no account" error', async () => {
  (authApi.requestPasswordReset as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
    response: { data: { error: 'No account found with that email address.' } },
  });
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.type(emailField, 'ghost@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  await waitFor(() => expect(screen.getByText('Create an account →')).toBeInTheDocument());
});

test('calls requestPasswordReset with the entered email', async () => {
  (authApi.requestPasswordReset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { message: 'Reset link sent. Check your inbox.' },
  });
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.type(emailField, 'real@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  await waitFor(() =>
    expect(authApi.requestPasswordReset).toHaveBeenCalledWith('real@example.com')
  );
});

test('shows success confirmation after reset link is sent', async () => {
  (authApi.requestPasswordReset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { message: 'Reset link sent. Check your inbox.' },
  });
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.type(emailField, 'real@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  await waitFor(() => expect(screen.getByText('Reset link sent!')).toBeInTheDocument());
  expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
});

test('success banner shows the submitted email address', async () => {
  (authApi.requestPasswordReset as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { message: 'Reset link sent. Check your inbox.' },
  });
  render(<Wrapper />);
  await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
  const emailField = screen.getByPlaceholderText('you@example.com');
  await userEvent.clear(emailField);
  await userEvent.type(emailField, 'real@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  await waitFor(() => screen.getByText('Reset link sent!'));
  expect(screen.getByText('real@example.com')).toBeInTheDocument();
});
