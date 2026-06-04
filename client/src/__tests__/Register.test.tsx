import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Register from '../pages/Register';

vi.mock('../api/auth', () => ({ register: vi.fn() }));
import * as authApi from '../api/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

function Wrapper() {
  return (
    <ThemeProvider><AuthProvider><MemoryRouter><Register /></MemoryRouter></AuthProvider></ThemeProvider>
  );
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test('renders name, email, password fields', () => {
  render(<Wrapper />);
  expect(screen.getByPlaceholderText(/satoshi/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
});

test('validates min password length', async () => {
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText(/satoshi/i), 'Test');
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
  await userEvent.type(screen.getByPlaceholderText(/min\. 8/i), 'short');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  expect(screen.getByText(/at least 8/i)).toBeInTheDocument();
});

test('shows duplicate email error from API', async () => {
  (authApi.register as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
    response: { data: { error: 'Email already in use' } },
  });
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText(/satoshi/i), 'Test');
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'dup@b.com');
  await userEvent.type(screen.getByPlaceholderText(/min\. 8/i), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  await waitFor(() => expect(screen.getByText('Email already in use')).toBeInTheDocument());
});

test('navigates to /onboarding on success', async () => {
  (authApi.register as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    data: { token: 'tok', user: { id:'1', name:'Test', email:'t@t.com' } },
  });
  render(<Wrapper />);
  await userEvent.type(screen.getByPlaceholderText(/satoshi/i), 'Test');
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 't@t.com');
  await userEvent.type(screen.getByPlaceholderText(/min\. 8/i), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'));
});
