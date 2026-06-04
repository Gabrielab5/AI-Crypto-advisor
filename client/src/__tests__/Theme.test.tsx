import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

vi.mock('../api/client', () => ({
  default: { patch: vi.fn().mockResolvedValue({}) },
}));

function ThemeFixture() {
  const { theme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light');
});

test('defaults to dark', () => {
  render(<ThemeProvider><ThemeFixture /></ThemeProvider>);
  expect(screen.getByTestId('theme').textContent).toBe('dark');
  expect(document.documentElement.classList.contains('light')).toBe(false);
});

test('toggle switches to light and adds class to html', async () => {
  render(<ThemeProvider><ThemeFixture /></ThemeProvider>);
  await userEvent.click(screen.getByText('toggle'));
  expect(screen.getByTestId('theme').textContent).toBe('light');
  expect(document.documentElement.classList.contains('light')).toBe(true);
  expect(localStorage.getItem('theme')).toBe('light');
});

test('toggle back to dark removes class', async () => {
  render(<ThemeProvider><ThemeFixture /></ThemeProvider>);
  await userEvent.click(screen.getByText('toggle'));
  await userEvent.click(screen.getByText('toggle'));
  expect(document.documentElement.classList.contains('light')).toBe(false);
  expect(localStorage.getItem('theme')).toBe('dark');
});

test('reads initial theme from localStorage', () => {
  localStorage.setItem('theme', 'light');
  render(<ThemeProvider><ThemeFixture /></ThemeProvider>);
  expect(screen.getByTestId('theme').textContent).toBe('light');
});
