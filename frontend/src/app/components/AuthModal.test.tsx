// src/app/components/AuthModal.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider, useAuth } from '../../lib/AuthContext';
import { AuthModal } from './AuthModal';
import { useEffect } from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        login: vi.fn(),
        register: vi.fn(),
        me: vi.fn().mockRejectedValue(new Error('no auth')),
      },
    },
  };
});

import { api } from '../../lib/api';

function TestTrigger() {
  const { openAuthModal } = useAuth();
  useEffect(() => {
    openAuthModal('test', 'login');
  }, [openAuthModal]);
  return <div>Trigger</div>;
}

function renderModal() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestTrigger />
        <AuthModal />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('<AuthModal /> Login Redirection', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(api.auth.login).mockReset();
  });

  test('redirecciona a /company/profile al iniciar sesión como empresa', async () => {
    vi.mocked(api.auth.login).mockResolvedValue({
      token: 'jwt-comp',
      user: { id: 'comp-1', name: 'TechCorp', email: 'admin@techcorp.com', role: 'company' },
    });

    renderModal();

    const emailInput = screen.getByPlaceholderText('Email');
    const passInput = screen.getByPlaceholderText('Contraseña');
    const submitBtn = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, { target: { value: 'admin@techcorp.com' } });
    fireEvent.change(passInput, { target: { value: 'Password1' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/company/profile');
    });
  });

  test('redirecciona a /ngo/dashboard al iniciar sesión como ONG', async () => {
    vi.mocked(api.auth.login).mockResolvedValue({
      token: 'jwt-ngo',
      user: { id: 'ngo-1', name: 'Sustentando', email: 'admin@sustentando.org', role: 'ngo' },
    });

    renderModal();

    const emailInput = screen.getByPlaceholderText('Email');
    const passInput = screen.getByPlaceholderText('Contraseña');
    const submitBtn = screen.getByRole('button', { name: /entrar/i });

    fireEvent.change(emailInput, { target: { value: 'admin@sustentando.org' } });
    fireEvent.change(passInput, { target: { value: 'Password1' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/ngo/dashboard');
    });
  });
});
