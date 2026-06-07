import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import ResetPassword from '../pages/ResetPassword';

vi.mock('../api/auth', () => ({
  resetPassword: vi.fn(),
}));

import * as authApi from '../api/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

function renderWithToken(token: string | null = 'valid-token-abc') {
  const search = token ? `?token=${token}` : '';
  return render(
    <ThemeProvider><AuthProvider>
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider></ThemeProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers(); // always restore real timers, even on test failure
});

// ─── Missing token ─────────────────────────────────────────────────────────────

test('shows error message when token is missing from URL', () => {
  renderWithToken(null);
  expect(screen.getByText(/invalid or missing reset link/i)).toBeInTheDocument();
});

test('does not render password fields when token is missing', () => {
  renderWithToken(null);
  expect(screen.queryByPlaceholderText(/at least 8 characters/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
});

// ─── Form rendering ────────────────────────────────────────────────────────────

test('renders new password and confirm password fields', () => {
  renderWithToken();
  expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Re-enter your new password')).toBeInTheDocument();
});

test('renders save button', () => {
  renderWithToken();
  expect(screen.getByRole('button', { name: /save new password/i })).toBeInTheDocument();
});

test('renders page heading', () => {
  renderWithToken();
  expect(screen.getByText('Set new password')).toBeInTheDocument();
});

// ─── Validation ────────────────────────────────────────────────────────────────

test('shows mismatch error when passwords differ', async () => {
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'password123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'different!');
  expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
});

test('mismatch error disappears when passwords match', async () => {
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'password123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'password123');
  expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
});

test('shows error when password is shorter than 8 characters on submit', async () => {
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'short');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'short');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument());
  expect(authApi.resetPassword).not.toHaveBeenCalled();
});

test('shows error when passwords do not match on submit', async () => {
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'longenough1');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'longenough2');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(screen.getByText('Passwords do not match.')).toBeInTheDocument());
  expect(authApi.resetPassword).not.toHaveBeenCalled();
});

// ─── Successful submission ─────────────────────────────────────────────────────

test('calls resetPassword API with token and password on valid submit', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue({});
  renderWithToken('valid-token-abc');
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith('valid-token-abc', 'newpass123'));
});

test('shows success message after password is reset', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue({});
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument());
});

test('shows redirect hint in success state', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue({});
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(screen.getByText(/redirecting to your dashboard/i)).toBeInTheDocument());
});

test('redirects to /dashboard after 2.5 seconds on success', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue({});
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  // Real 2.5s timeout; extend waitFor to 4s to give it room
  await waitFor(
    () => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }),
    { timeout: 4000 },
  );
}, 6000);

test('hides form after successful reset (shows success banner instead)', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockResolvedValue({});
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => screen.getByText(/password updated successfully/i));
  expect(screen.queryByRole('button', { name: /save new password/i })).not.toBeInTheDocument();
});

// ─── API error ─────────────────────────────────────────────────────────────────

test('shows API error message when token is invalid or expired', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockRejectedValue({
    response: { data: { error: 'Invalid or expired reset token' } },
  });
  renderWithToken('bad-token');
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(screen.getByText('Invalid or expired reset token')).toBeInTheDocument());
});

test('shows generic error when API fails without error body', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
});

test('does NOT redirect to /dashboard on API error', async () => {
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockRejectedValue({
    response: { data: { error: 'Invalid or expired reset token' } },
  });
  renderWithToken('bad-token');
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  await waitFor(() => screen.getByText('Invalid or expired reset token'));
  expect(mockNavigate).not.toHaveBeenCalled();
});

// ─── Loading state ─────────────────────────────────────────────────────────────

test('shows spinner and disables button while submitting', async () => {
  let resolve!: () => void;
  (authApi.resetPassword as ReturnType<typeof vi.fn>).mockReturnValue(
    new Promise<void>(r => { resolve = r; })
  );
  renderWithToken();
  await userEvent.type(screen.getByPlaceholderText('At least 8 characters'),     'newpass123');
  await userEvent.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpass123');
  await userEvent.click(screen.getByRole('button', { name: /save new password/i }));

  await waitFor(() => expect(screen.getByText(/saving/i)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  resolve();
});
