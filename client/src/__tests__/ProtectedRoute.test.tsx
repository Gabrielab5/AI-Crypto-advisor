import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

function wrap(token: string | null, path = '/dashboard') {
  if (token) localStorage.setItem('token', token);
  else       localStorage.removeItem('token');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login"    element={<div>LoginPage</div>} />
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

test('shows protected content when authenticated', () => {
  wrap('valid-token');
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
});

test('redirects to /login when not authenticated', () => {
  wrap(null);
  expect(screen.getByText('LoginPage')).toBeInTheDocument();
});
