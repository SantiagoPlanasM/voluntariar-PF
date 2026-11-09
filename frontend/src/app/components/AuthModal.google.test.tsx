// src/app/components/AuthModal.google.test.tsx — "Continuar con Google" en el acceso (§314).
// El botón de Google se simula (lib/googleSignIn): un botón común que entrega una credencial al tocarlo.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../../lib/AuthContext';
import { AuthModal } from './AuthModal';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

let clientId = 'cliente.apps.googleusercontent.com';
vi.mock('../../lib/googleSignIn', () => ({
  googleClientId: () => clientId,
  renderGoogleButton: vi.fn(async (el: HTMLElement, onCredential: (c: string) => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Google simulado';
    b.onclick = () => onCredential('cred-google');
    el.appendChild(b);
    return true;
  }),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        login: vi.fn(), register: vi.fn(),
        me: vi.fn().mockRejectedValue(new Error('no auth')),
        google: vi.fn(), googleRegister: vi.fn(),
      },
    },
  };
});
import { api, ApiError } from '../../lib/api';

function Open({ tab = 'login' as 'login' | 'register' }) {
  const { openAuthModal } = useAuth();
  useEffect(() => { openAuthModal('', tab); }, [openAuthModal, tab]);
  return null;
}
function WhoAmI() {
  const { user } = useAuth();
  return <p data-testid="who">{user ? `${user.role}:${user.email}` : 'nadie'}</p>;
}
const renderModal = (tab: 'login' | 'register' = 'login') => render(
  <MemoryRouter><AuthProvider><Open tab={tab} /><WhoAmI /><AuthModal /></AuthProvider></MemoryRouter>,
);
const clickGoogle = async () => fireEvent.click(await screen.findByRole('button', { name: 'Google simulado' }));

describe('<AuthModal /> con Google', () => {
  beforeEach(() => {
    clientId = 'cliente.apps.googleusercontent.com';
    mockNavigate.mockReset();
    vi.mocked(api.auth.google).mockReset();
    vi.mocked(api.auth.googleRegister).mockReset();
  });

  test('el botón está en las dos pestañas; sin client id no aparece', async () => {
    renderModal('login');
    expect(await screen.findByRole('button', { name: 'Google simulado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('button', { name: 'Google simulado' })).toBeInTheDocument();
  });

  test('sin VITE_GOOGLE_CLIENT_ID no hay botón ni separador', async () => {
    clientId = '';
    renderModal();
    await screen.findByRole('button', { name: 'Ingresar' });
    expect(screen.queryByRole('button', { name: 'Google simulado' })).toBeNull();
    expect(screen.queryByText('o')).toBeNull();
  });

  test('cuenta existente: entra y va al panel según el rol', async () => {
    vi.mocked(api.auth.google).mockResolvedValue({ token: 'jwt', user: { id: 'n1', name: 'ONG', email: 'ong@gmail.com', role: 'ngo' } });
    renderModal();
    await clickGoogle();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/ngo/dashboard'));
    expect(api.auth.google).toHaveBeenCalledWith({ credential: 'cred-google' });
    expect(screen.getByTestId('who')).toHaveTextContent('ngo:ong@gmail.com');
  });

  test('sin cuenta: pantalla de rol con el nombre de Google; crea la cuenta con la MISMA credencial', async () => {
    vi.mocked(api.auth.google).mockResolvedValue({
      needs_registration: true, profile: { email: 'lucia@gmail.com', name: 'Lucía Gómez', given_name: 'Lucía', family_name: 'Gómez' },
    });
    vi.mocked(api.auth.googleRegister).mockResolvedValue({ token: 'jwt', user: { id: 'u9', name: 'Lucía Gómez', email: 'lucia@gmail.com', role: 'company' } });
    renderModal();
    await clickGoogle();
    expect(await screen.findByText(/lucia@gmail\.com/)).toBeInTheDocument();
    // Con voluntario (el rol por defecto), el campo es el nombre completo, con el de Google.
    expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('Lucía Gómez');
    fireEvent.click(screen.getByRole('radio', { name: /Empresa/ }));
    const orgName = screen.getByLabelText('Nombre de la empresa') as HTMLInputElement;
    fireEvent.change(orgName, { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(api.auth.googleRegister).toHaveBeenCalledWith({ credential: 'cred-google', role: 'company', name: 'Acme' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/company/profile'));
    expect(screen.getByTestId('who')).toHaveTextContent('company:lucia@gmail.com');
  });

  test('pantalla de rol: valida el nombre antes de mandar', async () => {
    vi.mocked(api.auth.google).mockResolvedValue({ needs_registration: true, profile: { email: 'x@gmail.com', name: null, given_name: null, family_name: null } });
    renderModal();
    await clickGoogle();
    fireEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Mínimo 2 caracteres')).toBeInTheDocument();
    expect(api.auth.googleRegister).not.toHaveBeenCalled();
  });

  test('pantalla de rol: "Volver" vuelve al acceso sin crear nada', async () => {
    vi.mocked(api.auth.google).mockResolvedValue({ needs_registration: true, profile: { email: 'x@gmail.com', name: 'Ana', given_name: 'Ana', family_name: null } });
    renderModal();
    await clickGoogle();
    fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(api.auth.googleRegister).not.toHaveBeenCalled();
  });

  test('cerrar el modal en la pantalla de rol y volver a abrirlo arranca en el acceso', async () => {
    vi.mocked(api.auth.google).mockResolvedValue({ needs_registration: true, profile: { email: 'x@gmail.com', name: 'Ana', given_name: 'Ana', family_name: null } });
    function Reopen() {
      const { openAuthModal, closeAuthModal } = useAuth();
      return <>
        <button type="button" onClick={closeAuthModal}>cerrar-test</button>
        <button type="button" onClick={() => openAuthModal('', 'login')}>abrir-test</button>
      </>;
    }
    render(<MemoryRouter><AuthProvider><Open /><Reopen /><AuthModal /></AuthProvider></MemoryRouter>);
    await clickGoogle();
    await screen.findByRole('heading', { name: 'Crear tu cuenta' });
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-test' }));
    fireEvent.click(screen.getByRole('button', { name: 'abrir-test' }));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crear tu cuenta' })).toBeNull();
  });

  test('un error de Google o del registro se muestra en el modal', async () => {
    vi.mocked(api.auth.google).mockRejectedValue(new ApiError('Esa cuenta ya está vinculada a otra cuenta de Google', 409));
    renderModal();
    await clickGoogle();
    expect(await screen.findByRole('alert')).toHaveTextContent('Esa cuenta ya está vinculada a otra cuenta de Google');

    vi.mocked(api.auth.google).mockResolvedValue({ needs_registration: true, profile: { email: 'x@gmail.com', name: 'Ana Paz', given_name: 'Ana', family_name: 'Paz' } });
    vi.mocked(api.auth.googleRegister).mockRejectedValue(new ApiError('Ya existe una cuenta con ese email', 409));
    await clickGoogle();
    fireEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese email');
  });
});
