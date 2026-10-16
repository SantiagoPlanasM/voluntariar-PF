// src/app/components/NGONotifications.test.tsx
//
// §173: el panel de la ONG no tenía pantalla de notificaciones. La única ruta (`/notifications`) está bajo el layout
// del voluntario y ni la barra lateral ni la inferior de la ONG tenían un link: las notificaciones que el backend le
// crea a una ONG ("Nueva solicitud de inscripción" y, desde §170, "Recibiste una donación") no se veían en ningún lado.
// Ahora: `/ngo/notifications` (la misma NotificationsScreen, sin el margen del layout del voluntario), "Notificaciones"
// con contador en la barra lateral y una campanita con contador en el encabezado del panel (la barra inferior ya tiene 7
// botones, §121).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Sustentando', email: 's@x.org', role: 'ngo' }, logout: vi.fn() }) }));
vi.mock('../../lib/ChatContext', () => ({ useChat: () => ({ unreadTotal: 0 }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      notifications: { ...actual.api.notifications, list: vi.fn() },
      ngos: {
        ...actual.api.ngos,
        me: vi.fn().mockResolvedValue({
          ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 }, projects: [],
          stats: { total_projects: 0, active_projects: 0, completed_projects: 0, total_volunteers: 0, total_funding: 0, pending_enrollments: 0 },
          pending_enrollments: [],
        }),
      },
    },
  };
});
import { api, AppNotification } from '../../lib/api';
import { NGOSidebarNav } from './NGOSidebarNav';
import { NGODashboard } from './NGODashboard';
import { NotificationsScreen } from './NotificationsScreen';

const donationNotice: AppNotification = {
  id: 'n1', user_id: 'u1', type: 'donation_received', title: 'Recibiste una donación',
  body: 'Donaron $500 a "Jornada de limpieza en el Lago"', read: false, data: null, created_at: '2026-10-16T20:00:00.000Z',
} as AppNotification;

beforeEach(() => {
  vi.mocked(api.notifications.list).mockReset().mockResolvedValue({ notifications: [donationNotice], unread: 3 } as never);
});

describe('notificaciones en el panel de la ONG', () => {
  test('barra lateral: "Notificaciones" va a /ngo/notifications y muestra las no leídas', async () => {
    render(<MemoryRouter initialEntries={['/ngo/dashboard']}><NGOSidebarNav /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /Notificaciones/ });
    expect(link).toHaveAttribute('href', '/ngo/notifications');
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  test('barra lateral: resaltado estando en /ngo/notifications', () => {
    render(<MemoryRouter initialEntries={['/ngo/notifications']}><NGOSidebarNav /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Notificaciones/ }).className).toContain('bg-blue-50');
  });

  test('barra lateral: si falla el pedido, no muestra contador ni rompe', async () => {
    vi.mocked(api.notifications.list).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<MemoryRouter initialEntries={['/ngo/dashboard']}><NGOSidebarNav /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Notificaciones/ })).toBeInTheDocument();
    await vi.waitFor(() => expect(api.notifications.list).toHaveBeenCalled());
    expect(screen.queryByText('3')).toBeNull();
  });

  test('encabezado del panel: campanita con las no leídas en el nombre, lleva a /ngo/notifications', async () => {
    render(<MemoryRouter initialEntries={['/ngo/dashboard']}><Routes>
      <Route path="/ngo/dashboard" element={<NGODashboard />} />
      <Route path="/ngo/notifications" element={<p>pantalla de notificaciones</p>} />
    </Routes></MemoryRouter>);
    const bell = await screen.findByRole('button', { name: 'Notificaciones (3 sin leer)' });
    fireEvent.click(bell);
    expect(screen.getByText('pantalla de notificaciones')).toBeInTheDocument();
  });

  test('encabezado: sin no leídas el nombre es solo "Notificaciones"', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [], unread: 0 } as never);
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  test('la pantalla dentro del panel (inPanel) no lleva el margen del layout del voluntario y lista la de la donación', async () => {
    const { container } = render(<MemoryRouter><NotificationsScreen inPanel /></MemoryRouter>);
    expect(await screen.findByText('Recibiste una donación')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('md:ml-60');
  });

  test('sin inPanel (layout del voluntario) conserva el margen', async () => {
    const { container } = render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    await screen.findByText('Recibiste una donación');
    expect(container.innerHTML).toContain('md:ml-60');
  });
});
