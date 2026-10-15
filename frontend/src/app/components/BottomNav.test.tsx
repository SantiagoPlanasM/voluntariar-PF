// src/app/components/BottomNav.test.tsx
//
// Barra inferior del lado público (Root) según el rol, y su relación con las barras de panel
// (REVISION S7): la empresa veía una lista distinta (sin "Panel") según la pantalla.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BottomNav } from './BottomNav';
import { CompanyBottomNav } from './CompanyBottomNav';
import { NGOBottomNav } from './NGOBottomNav';

const auth = vi.hoisted(() => ({ user: null as null | { id: string; name: string; email: string; role: string } }));
const chat = vi.hoisted(() => ({ unreadTotal: 0 }));

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));
vi.mock('../../lib/ChatContext', () => ({ useChat: () => ({ unreadTotal: chat.unreadTotal }) }));
vi.mock('../../lib/api', () => ({ api: { notifications: { list: vi.fn().mockResolvedValue({ unread: 0 }) } } }));

const as = (role: string) => { auth.user = { id: 'u', name: 'X', email: 'x@x.com', role }; };

const renderAt = (ui: React.ReactElement, path: string) =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

// [texto, href] de cada enlace, en orden.
const items = () => screen.getAllByRole('link').map(a => [a.textContent, a.getAttribute('href')]);

beforeEach(() => { auth.user = null; chat.unreadTotal = 0; });

describe('<BottomNav /> (lado público) por rol', () => {
  test('voluntario: Inicio, Explorar, Mis acciones, Mensajes, Perfil', () => {
    as('volunteer');
    renderAt(<BottomNav />, '/feed');
    expect(items()).toEqual([
      ['Inicio', '/feed'], ['Explorar', '/explore'], ['Mis acciones', '/participation'],
      ['Mensajes', '/messages'], ['Perfil', '/profile'],
    ]);
  });

  test('ONG: sigue con su lista propia, que incluye Explorar (S7 no la cambia, ver PROJECT_ANALYSIS)', () => {
    as('ngo');
    renderAt(<BottomNav />, '/explore');
    expect(items()).toEqual([
      ['Panel', '/ngo/dashboard'], ['Crear', '/ngo/create'], ['Sponsors', '/ngo/patrocinios'],
      ['Explorar', '/explore'], ['Mensajes', '/ngo/messages'], ['Mi ONG', '/ngo/profile'],
    ]);
  });

  test('empresa: misma lista que su barra de panel (gana "Panel")', () => {
    as('company');
    renderAt(<BottomNav />, '/explore');
    expect(items()).toEqual([
      ['Panel', '/company/dashboard'], ['Mi Empresa', '/company/profile'],
      ['Explorar', '/explore'], ['Mensajes', '/company/messages'],
    ]);
  });

  test('empresa: la barra pública y la de panel tienen exactamente los mismos ítems', () => {
    as('company');
    const { unmount } = renderAt(<BottomNav />, '/explore');
    const publicItems = items();
    unmount();
    renderAt(<CompanyBottomNav />, '/company/dashboard');
    expect(items()).toEqual(publicItems);
  });

  test('resalta el ítem activo con el color del rol', () => {
    as('company');
    renderAt(<BottomNav />, '/explore');
    const explorar = screen.getByRole('link', { name: 'Explorar' });
    expect(within(explorar).getByText('Explorar').className).toContain('text-violet-600');
    expect(within(screen.getByRole('link', { name: 'Mi Empresa' })).getByText('Mi Empresa').className).toContain('text-gray-400');
  });

  test('el badge de mensajes sin leer va solo en Mensajes (y 9+ si son más de 9)', () => {
    as('company');
    chat.unreadTotal = 12;
    renderAt(<BottomNav />, '/explore');
    expect(within(screen.getByRole('link', { name: /Mensajes/ })).getByText('9+')).toBeInTheDocument();
    expect(screen.getAllByText('9+')).toHaveLength(1);
  });
});

describe('barras de panel (sin cambios)', () => {
  test('CompanyBottomNav: Panel, Mi Empresa, Explorar, Mensajes y Salir', () => {
    as('company');
    renderAt(<CompanyBottomNav />, '/company/dashboard');
    expect(items().map(i => i[0])).toEqual(['Panel', 'Mi Empresa', 'Explorar', 'Mensajes']);
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  test('NGOBottomNav: Inicio, Crear, Sponsors, Mensajes, Mi ONG y Salir', () => {
    as('ngo');
    renderAt(<NGOBottomNav />, '/ngo/dashboard');
    expect(items().map(i => i[0])).toEqual(['Inicio', 'Crear', 'Sponsors', 'Mensajes', 'Mi ONG']);
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });
});
