// src/app/layout/LiveBadges.test.tsx — contadores al instante y postulaciones sin responder (§336).
//
// Los contadores de la barra se pedían solo al cambiar de pantalla: una postulación nueva se veía recién al navegar.
// Ahora el servidor avisa por el WebSocket (`{ type: 'notification' }`), ChatContext lo cuenta en `notificationTick`
// y la barra vuelve a pedir sus contadores. De paso, la ONG tiene el contador que faltaba (§320): las postulaciones
// sin responder, en "Postulaciones" (y en el grupo "Panel" cuando está cerrado o es un ícono).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const { auth, chat } = vi.hoisted(() => ({
  auth: { user: null as null | Record<string, unknown>, account: null, logout: vi.fn(), openAuthModal: vi.fn() },
  chat: { unreadTotal: 0, notificationTick: 0 },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/ChatContext', () => ({ useChatOptional: () => chat }));
vi.mock('../components/AuthModal', () => ({ AuthModal: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api,
    notifications: { ...actual.api.notifications, list: vi.fn() },
    team: { ...actual.api.team, mine: vi.fn() },
    enrollments: { ...actual.api.enrollments, pendingCount: vi.fn() } } };
});

import { api } from '../../lib/api';
import { AppShell } from './AppShell';

const as = (role: string) => { auth.user = { id: `u-${role}`, name: 'Ana Pérez', email: 'ana@x.com', role, avatar: null }; };
const tree = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route element={<AppShell />}><Route path="*" element={<p>Pantalla</p>} /></Route></Routes>
  </MemoryRouter>
);
const sideBar = () => screen.getAllByRole('navigation', { name: 'Principal' })[0];
const unread = (n: number) => ({ notifications: [], unread: n }) as never;

const realMatchMedia = window.matchMedia;
const narrow = () => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  as('ngo');
  chat.unreadTotal = 0;
  chat.notificationTick = 0;
  vi.mocked(api.notifications.list).mockReset().mockResolvedValue(unread(0));
  vi.mocked(api.team.mine).mockReset().mockResolvedValue({ memberships: [] });
  vi.mocked(api.enrollments.pendingCount).mockReset().mockResolvedValue({ pending: 0 });
});
afterEach(() => { window.matchMedia = realMatchMedia; });

describe('postulaciones sin responder en la barra de la ONG', () => {
  test('con el grupo Panel abierto: el número va en "Postulaciones", no en el grupo', async () => {
    vi.mocked(api.enrollments.pendingCount).mockResolvedValue({ pending: 3 });
    render(tree('/ngo/dashboard'));
    const link = within(sideBar()).getByRole('link', { name: 'Postulaciones' });
    await waitFor(() => expect(within(link).getByText('3')).toBeInTheDocument());
    expect(within(link).getByText('3')).toHaveAttribute('aria-hidden', 'true');
    expect(within(within(sideBar()).getByRole('button', { name: 'Panel' })).queryByText('3')).not.toBeInTheDocument();
    expect(within(within(sideBar()).getByRole('link', { name: 'Resumen' })).queryByText('3')).not.toBeInTheDocument();
  });

  test('con el grupo Panel cerrado: el número va en el grupo; al abrirlo pasa a "Postulaciones"', async () => {
    vi.mocked(api.enrollments.pendingCount).mockResolvedValue({ pending: 12 });
    render(tree('/ngo/messages'));
    const panel = within(sideBar()).getByRole('button', { name: 'Panel' });
    expect(panel).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(within(panel).getByText('9+')).toBeInTheDocument());
    fireEvent.click(panel);
    expect(within(panel).queryByText('9+')).not.toBeInTheDocument();
    expect(within(within(sideBar()).getByRole('link', { name: 'Postulaciones' })).getByText('9+')).toBeInTheDocument();
  });

  test('con solo íconos: el número va en el ícono del grupo y, al abrir el panel flotante, también en "Postulaciones"', async () => {
    narrow();
    vi.mocked(api.enrollments.pendingCount).mockResolvedValue({ pending: 2 });
    render(tree('/ngo/dashboard'));
    const panel = within(sideBar()).getByRole('button', { name: 'Panel' });
    await waitFor(() => expect(within(panel).getByText('2')).toBeInTheDocument());
    fireEvent.click(panel);
    const floating = screen.getByRole('group', { name: 'Panel' });
    expect(within(within(floating).getByRole('link', { name: 'Postulaciones' })).getByText('2')).toBeInTheDocument();
    expect(within(panel).getByText('2')).toBeInTheDocument();
  });

  test('sin pendientes, o si el pedido falla: sin número', async () => {
    const { unmount } = render(tree('/ngo/dashboard'));
    await waitFor(() => expect(api.enrollments.pendingCount).toHaveBeenCalledTimes(1));
    expect(within(sideBar()).getByRole('link', { name: 'Postulaciones' })).not.toHaveTextContent(/\d/);
    unmount();
    vi.mocked(api.enrollments.pendingCount).mockRejectedValue(new Error('red'));
    render(tree('/ngo/dashboard'));
    await waitFor(() => expect(api.enrollments.pendingCount).toHaveBeenCalledTimes(2));
    expect(within(sideBar()).getByRole('link', { name: 'Postulaciones' })).not.toHaveTextContent(/\d/);
  });

  test.each(['volunteer', 'company'])('%s: no pide el contador de postulaciones', async (role) => {
    as(role);
    render(tree('/explore'));
    await waitFor(() => expect(api.notifications.list).toHaveBeenCalled());
    expect(api.enrollments.pendingCount).not.toHaveBeenCalled();
  });
});

describe('aviso por el WebSocket: los contadores se piden de nuevo sin cambiar de pantalla', () => {
  test('ONG: llega un aviso → notificaciones y postulaciones se actualizan', async () => {
    vi.mocked(api.notifications.list).mockResolvedValueOnce(unread(1)).mockResolvedValue(unread(2));
    vi.mocked(api.enrollments.pendingCount).mockResolvedValueOnce({ pending: 4 }).mockResolvedValue({ pending: 5 });
    const { rerender } = render(tree('/ngo/dashboard'));
    const notifications = within(sideBar()).getByRole('link', { name: 'Notificaciones' });
    const applications = within(sideBar()).getByRole('link', { name: 'Postulaciones' });
    await waitFor(() => expect(within(applications).getByText('4')).toBeInTheDocument());
    expect(within(notifications).getAllByText('1').length).toBeGreaterThan(0);

    chat.notificationTick = 1;   // ChatContext recibió { type: 'notification' }
    rerender(tree('/ngo/dashboard'));
    await waitFor(() => expect(within(applications).getByText('5')).toBeInTheDocument());
    expect(within(notifications).getAllByText('2').length).toBeGreaterThan(0);
    expect(api.notifications.list).toHaveBeenCalledTimes(2);
    expect(api.enrollments.pendingCount).toHaveBeenCalledTimes(2);
  });

  test('voluntario: llega un aviso → notificaciones e invitaciones a equipos se piden de nuevo', async () => {
    as('volunteer');
    const { rerender } = render(tree('/explore'));
    await waitFor(() => expect(api.team.mine).toHaveBeenCalledTimes(1));
    chat.notificationTick = 1;
    rerender(tree('/explore'));
    await waitFor(() => expect(api.team.mine).toHaveBeenCalledTimes(2));
    expect(api.notifications.list).toHaveBeenCalledTimes(2);
  });

  test('sin aviso nuevo (otro render con el mismo número) no se pide nada', async () => {
    const { rerender } = render(tree('/ngo/dashboard'));
    await waitFor(() => expect(api.enrollments.pendingCount).toHaveBeenCalledTimes(1));
    rerender(tree('/ngo/dashboard'));
    await new Promise(r => setTimeout(r, 20));
    expect(api.notifications.list).toHaveBeenCalledTimes(1);
    expect(api.enrollments.pendingCount).toHaveBeenCalledTimes(1);
  });
});
