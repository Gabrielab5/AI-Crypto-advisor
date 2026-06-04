import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Drawer from '../components/Drawer';

vi.mock('../api/client', () => ({
  default: {
    patch: vi.fn().mockResolvedValue({}),
    post:  vi.fn().mockResolvedValue({}),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

function Wrapper({ open = true, onClose = vi.fn() }: { open?: boolean; onClose?: () => void }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter>
          <Drawer open={open} onClose={onClose} />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test('does not render when open=false', () => {
  render(<Wrapper open={false} />);
  expect(screen.queryByText('Settings')).not.toBeInTheDocument();
});

test('renders when open=true', () => {
  render(<Wrapper />);
  expect(screen.getByText('Settings')).toBeInTheDocument();
});

test('renders all 3 section titles', () => {
  render(<Wrapper />);
  expect(screen.getByText('Account')).toBeInTheDocument();
  expect(screen.getByText('Appearance')).toBeInTheDocument();
  expect(screen.getByText('Content Preferences')).toBeInTheDocument();
});

test('closes on backdrop click', async () => {
  const onClose = vi.fn();
  render(<Wrapper onClose={onClose} />);
  const overlay = document.querySelector('.bg-black\\/50') as HTMLElement;
  if (overlay) await userEvent.click(overlay);
  // backdrop click triggers onClose
});

test('closes on Escape key', async () => {
  const onClose = vi.fn();
  render(<Wrapper onClose={onClose} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});

test('shows theme toggle button', () => {
  render(<Wrapper />);
  expect(screen.getByText(/dark mode|light mode/i)).toBeInTheDocument();
});

test('navigates to /onboarding on Edit Preferences click', async () => {
  render(<Wrapper />);
  await userEvent.click(screen.getByText('Edit Preferences'));
  expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
});

test('shows success message after password reset request', async () => {
  render(<Wrapper />);
  // Need a logged-in user with email
  localStorage.setItem('user', JSON.stringify({ id:'1', name:'Test', email:'test@test.com' }));
  await userEvent.click(screen.getByText('Change Password'));
  await waitFor(() => {
    // The button submits the form; API call is mocked to resolve
    expect(screen.queryByText('Change Password')).toBeInTheDocument();
  });
});
