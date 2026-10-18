// src/app/components/CompanySidebarNav.test.tsx — el menú lateral de la empresa (TP de Calidad, cobertura del frontend, §210).
// Criterio de aceptación (antes de escribir los casos; el componente estaba en 0 %):
//  - los cuatro links (Panel, Mi Empresa, Explorar, Mensajes) van a su ruta; el de la pantalla actual (o una subruta)
//    queda resaltado y los demás no;
//  - Mensajes muestra los no leídos (sin contador en 0, "9+" desde 10);
//  - abajo, la foto o la inicial, el nombre y el email; "Cerrar sesión" cierra la sesión y vuelve al inicio.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { state, logout, navigate } = vi.hoisted(() => ({
  state: { user: null as null | Record<string, unknown>, unreadTotal: 0 },
  logout: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: state.user, logout }) }));
vi.mock('../../lib/ChatContext', () => ({ useChat: () => ({ unreadTotal: state.unreadTotal }) }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));

import { CompanySidebarNav } from './CompanySidebarNav';

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><CompanySidebarNav /></MemoryRouter>);

beforeEach(() => {
  logout.mockReset();
  navigate.mockReset();
  state.user = { id: 'c1', name: 'Acme SA', email: 'rrhh@acme.com', role: 'company', avatar: null };
  state.unreadTotal = 0;
});

describe('CompanySidebarNav: links', () => {
  test('cada link va a su ruta', () => {
    renderAt('/company/dashboard');
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('href', '/company/dashboard');
    expect(screen.getByRole('link', { name: 'Mi Empresa' })).toHaveAttribute('href', '/company/profile');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/explore');
    expect(screen.getByRole('link', { name: 'Mensajes' })).toHaveAttribute('href', '/company/messages');
  });

  test('en una subruta queda resaltado su link y no los demás', () => {
    // Arrange / Act: dentro de un hilo de mensajes
    renderAt('/company/messages/u1');
    // Assert
    expect(screen.getByRole('link', { name: 'Mensajes' }).className).toContain('bg-violet-50');
    expect(screen.getByRole('link', { name: 'Panel' }).className).not.toContain('bg-violet-50');
  });

  test('una ruta que solo empieza igual no resalta (/company/profilex no es /company/profile)', () => {
    renderAt('/company/profilex');
    expect(screen.getByRole('link', { name: 'Mi Empresa' }).className).not.toContain('bg-violet-50');
  });
});

describe('CompanySidebarNav: no leídos', () => {
  test.each([
    [0, null],
    [3, '3'],
    [9, '9'],
    [10, '9+'],
  ])('con %i no leídos el contador muestra %s', (n, texto) => {
    state.unreadTotal = n;
    renderAt('/company/dashboard');
    const link = screen.getByRole('link', { name: /Mensajes/ });
    if (texto === null) expect(link).toHaveTextContent(/^Mensajes$/);
    else expect(within(link).getByText(texto)).toBeInTheDocument();
  });
});

describe('CompanySidebarNav: usuario y salida', () => {
  test('sin foto: la inicial, el nombre y el email', () => {
    renderAt('/company/dashboard');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Acme SA')).toBeInTheDocument();
    expect(screen.getByText('rrhh@acme.com')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('con foto: la imagen con el nombre como texto alternativo', () => {
    state.user = { ...state.user, avatar: 'https://x/acme.png' };
    renderAt('/company/dashboard');
    expect(screen.getByRole('img', { name: 'Acme SA' })).toHaveAttribute('src', 'https://x/acme.png');
  });

  test('sin usuario no se dibuja el bloque de la cuenta', () => {
    state.user = null;
    renderAt('/company/dashboard');
    expect(screen.queryByText('rrhh@acme.com')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/ })).toBeInTheDocument();
  });

  test('"Cerrar sesión" cierra la sesión y vuelve al inicio', () => {
    renderAt('/company/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
