import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Login from '../pages/Login';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
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

test('renders email and password fields', () => {
  render(<Wrapper />);
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
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
