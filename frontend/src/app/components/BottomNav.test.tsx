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

  test('ONG: Panel, Crear, Sponsors, Explorar, Mensajes, Mi ONG', () => {
    as('ngo');
    renderAt(<BottomNav />, '/explore');
    expect(items()).toEqual([
      ['Panel', '/ngo/dashboard'], ['Crear', '/ngo/create'], ['Sponsors', '/ngo/patrocinios'],
      ['Explorar', '/explore'], ['Mensajes', '/ngo/messages'], ['Mi ONG', '/ngo/profile'],
    ]);
  });

  // Decisión del usuario (§121): una sola lista para la ONG, la de su panel, que suma "Explorar"
  // (era su único acceso a /explore en el celular) y se llama "Panel" como en la de empresa.
  test('ONG: la barra pública y la de panel tienen exactamente los mismos ítems', () => {
    as('ngo');
    const { unmount } = renderAt(<BottomNav />, '/explore');
    const publicItems = items();
    unmount();
    renderAt(<NGOBottomNav />, '/ngo/dashboard');
    expect(items()).toEqual(publicItems);
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

  test('ONG: el badge de mensajes sin leer también aparece en su barra pública', () => {
    as('ngo');
    chat.unreadTotal = 3;
    renderAt(<BottomNav />, '/explore');
    expect(within(screen.getByRole('link', { name: /Mensajes/ })).getByText('3')).toBeInTheDocument();
  });
});

describe('barras de panel', () => {
  test('CompanyBottomNav: Panel, Mi Empresa, Explorar, Mensajes y Salir', () => {
    as('company');
    renderAt(<CompanyBottomNav />, '/company/dashboard');
    expect(items().map(i => i[0])).toEqual(['Panel', 'Mi Empresa', 'Explorar', 'Mensajes']);
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  test('NGOBottomNav: Panel, Crear, Sponsors, Explorar, Mensajes, Mi ONG y Salir', () => {
    as('ngo');
    renderAt(<NGOBottomNav />, '/ngo/dashboard');
    expect(items().map(i => i[0])).toEqual(['Panel', 'Crear', 'Sponsors', 'Explorar', 'Mensajes', 'Mi ONG']);
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('href', '/ngo/dashboard');
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', '/explore');
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  test('NGOBottomNav: "Crear" sigue con su botón destacado y Panel se resalta en el panel', () => {
    as('ngo');
    renderAt(<NGOBottomNav />, '/ngo/dashboard/project/p1');
    expect(within(screen.getByRole('link', { name: 'Panel' })).getByText('Panel').className).toContain('text-blue-600');
    expect(screen.getByRole('link', { name: 'Crear' }).querySelector('.rounded-2xl')).not.toBeNull();
  });
});
