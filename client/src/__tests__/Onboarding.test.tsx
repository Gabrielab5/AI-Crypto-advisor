import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Onboarding from '../pages/Onboarding';

vi.mock('../api/preferences', () => ({
  getPreferences:  vi.fn(),
  savePreferences: vi.fn(),
}));
import * as prefsApi from '../api/preferences';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual as object, useNavigate: () => mockNavigate };
});

function Wrapper() {
  return (
    <ThemeProvider><AuthProvider><MemoryRouter><Onboarding /></MemoryRouter></AuthProvider></ThemeProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  (prefsApi.getPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { interested_assets: [], investor_type: null, content_types: [] },
  });
});

test('renders step 1 heading', async () => {
  render(<Wrapper />);
  await waitFor(() => expect(screen.getByText(/which crypto assets/i)).toBeInTheDocument());
});

test('shows validation error when advancing without selection', async () => {
  render(<Wrapper />);
  await waitFor(() => screen.getByText(/which crypto assets/i));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText(/select at least one asset/i)).toBeInTheDocument();
});

test('advances to step 2 when an asset is selected', async () => {
  render(<Wrapper />);
  await waitFor(() => screen.getByText(/which crypto assets/i));
  await userEvent.click(screen.getByText('Bitcoin'));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  await waitFor(() => expect(screen.getByText(/what type of investor/i)).toBeInTheDocument());
});

test('saves prefs and navigates to dashboard on finish', async () => {
  (prefsApi.savePreferences as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });
  render(<Wrapper />);
  await waitFor(() => screen.getByText(/which crypto assets/i));
  // Step 1
  await userEvent.click(screen.getByText('Bitcoin'));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  // Step 2
  await waitFor(() => screen.getByText(/what type of investor/i));
  await userEvent.click(screen.getByText('HODLer'));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  // Step 3
  await waitFor(() => screen.getByText(/what content/i));
  await userEvent.click(screen.getByText('Market News'));
  await userEvent.click(screen.getByRole('button', { name: /finish/i }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  expect(prefsApi.savePreferences).toHaveBeenCalledWith(expect.objectContaining({ investor_type: 'hodler' }));
});
