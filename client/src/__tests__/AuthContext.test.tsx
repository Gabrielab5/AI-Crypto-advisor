import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

function Fixture() {
  const { user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? 'none'}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <button onClick={() => login('tok123', { id:'1', name:'A', email:'a@b.com' })}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

test('starts empty', () => {
  localStorage.clear();
  render(<AuthProvider><Fixture /></AuthProvider>);
  expect(screen.getByTestId('token').textContent).toBe('none');
});

test('login stores token and user', async () => {
  localStorage.clear();
  render(<AuthProvider><Fixture /></AuthProvider>);
  await userEvent.click(screen.getByText('login'));
  expect(screen.getByTestId('token').textContent).toBe('tok123');
  expect(screen.getByTestId('user').textContent).toBe('a@b.com');
  expect(localStorage.getItem('token')).toBe('tok123');
});

test('logout clears token', async () => {
  localStorage.clear();
  render(<AuthProvider><Fixture /></AuthProvider>);
  await userEvent.click(screen.getByText('login'));
  await userEvent.click(screen.getByText('logout'));
  expect(screen.getByTestId('token').textContent).toBe('none');
  expect(localStorage.getItem('token')).toBeNull();
});
