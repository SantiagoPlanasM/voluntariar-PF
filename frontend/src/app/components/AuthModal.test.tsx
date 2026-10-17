// src/app/components/AuthModal.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider, useAuth } from '../../lib/AuthContext';
import { AuthModal } from './AuthModal';
import { useEffect, useRef } from 'react';

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
// TestTrigger reabre el modal en cada render (openAuthModal no está memoizado): para probar el cierre
// hace falta uno que lo abra una sola vez.
function OpenOnce() {
  const { openAuthModal } = useAuth();
  const done = useRef(false);
  useEffect(() => { if (!done.current) { done.current = true; openAuthModal('test', 'login'); } }, [openAuthModal]);
  return null;
}

describe('<AuthModal /> accesible (REVISION F12)', () => {
  test('es un diálogo con nombre según la pestaña, el foco entra y Escape lo cierra', async () => {
    render(<MemoryRouter><AuthProvider><OpenOnce /><AuthModal /></AuthProvider></MemoryRouter>);
    const d = await screen.findByRole('dialog', { name: 'Iniciar sesión' });
    expect(d.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[0]);
    expect(screen.getByRole('dialog', { name: 'Crear cuenta' })).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

// bcryptjs usa solo los primeros 72 bytes: el backend rechaza una contraseña más larga al registrarse y el
// formulario lo valida igual, con el mismo mensaje (AI_RULES 3).
describe('<AuthModal /> registro: contraseña de hasta 72 bytes', () => {
  const MSG = 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)';
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(api.auth.register).mockReset();
    vi.mocked(api.auth.register).mockResolvedValue({
      token: 'jwt-v', user: { id: 'v1', name: 'Ana Prueba', email: 'ana@test.com', role: 'volunteer' },
    } as any);
  });

  async function submitRegister(password: string) {
    render(<MemoryRouter><AuthProvider><OpenOnce /><AuthModal /></AuthProvider></MemoryRouter>);
    await screen.findByRole('dialog', { name: 'Iniciar sesión' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[0]);
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana Prueba' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@test.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }));
  }

  test('73 caracteres → el mensaje del límite y no se llama al servidor', async () => {
    await submitRegister('Password1' + 'x'.repeat(64));
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(api.auth.register).not.toHaveBeenCalled();
  });

  test('cuenta bytes, no caracteres: 38 caracteres con ñ (74 bytes) también se rechaza', async () => {
    await submitRegister('A1' + 'ñ'.repeat(36));
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(api.auth.register).not.toHaveBeenCalled();
  });

  test('72 bytes justos (con ñ) → se registra', async () => {
    const password = 'A1' + 'ñ'.repeat(35);
    await submitRegister(password);
    await waitFor(() => expect(api.auth.register).toHaveBeenCalledWith(
      { name: 'Ana Prueba', email: 'ana@test.com', password, role: 'volunteer' }));
    expect(screen.queryByText(MSG)).not.toBeInTheDocument();
  });

  test('si el servidor igual lo rechaza, se ve su mensaje', async () => {
    vi.mocked(api.auth.register).mockRejectedValue(new Error(MSG));
    await submitRegister('Password1');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
  });
});

// §179: al registrarse se acepta la página de privacidad y términos (se abre en otra pestaña para no perder el formulario).
describe('<AuthModal /> registro: link a privacidad y términos', () => {
  test('en "Crear cuenta" aparece el aviso con el link; en "Iniciar sesión", no', async () => {
    render(<MemoryRouter><AuthProvider><OpenOnce /><AuthModal /></AuthProvider></MemoryRouter>);
    await screen.findByRole('dialog', { name: 'Iniciar sesión' });
    expect(screen.queryByRole('link', { name: 'la política de privacidad y los términos de uso' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[0]);
    const link = screen.getByRole('link', { name: 'la política de privacidad y los términos de uso' });
    expect(link).toHaveAttribute('href', '/privacidad');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.closest('p')).toHaveTextContent('Al crear tu cuenta aceptás la política de privacidad y los términos de uso.');
  });
});
