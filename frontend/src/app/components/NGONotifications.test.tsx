// src/app/components/NGONotifications.test.tsx
//
// §173: el panel de la ONG no tenía pantalla de notificaciones. La única ruta (`/notifications`) está bajo el layout
// del voluntario y ni la barra lateral ni la inferior de la ONG tenían un link: las notificaciones que el backend le
// crea a una ONG ("Nueva solicitud de inscripción" y, desde §170, "Recibiste una donación") no se veían en ningún lado.
// Ahora: `/ngo/notifications` (la misma NotificationsScreen, sin el margen del layout del voluntario), "Notificaciones"
// con contador en la barra lateral y una campanita con contador en el encabezado del panel (la barra inferior ya tiene 7
// botones, §121).
// Rediseño: la barra lateral es la de AppShell (su contador se prueba en layout/AppShell.test.tsx); acá queda la
// campanita del encabezado del panel (en el celular la barra inferior de la ONG no tiene Notificaciones) y la pantalla.
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
  test('encabezado del panel: campanita con las no leídas en el nombre, lleva a /ngo/notifications', async () => {
    render(<MemoryRouter initialEntries={['/ngo/dashboard']}><Routes>
      <Route path="/ngo/dashboard" element={<NGODashboard />} />
      <Route path="/ngo/notifications" element={<p>pantalla de notificaciones</p>} />
    </Routes></MemoryRouter>);
    const bell = await screen.findByRole('link', { name: 'Notificaciones (3 sin leer)' });
    fireEvent.click(bell);
    expect(screen.getByText('pantalla de notificaciones')).toBeInTheDocument();
  });

  test('encabezado: sin no leídas el nombre es solo "Notificaciones"', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [], unread: 0 } as never);
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Notificaciones' })).toHaveAttribute('href', '/ngo/notifications');
  });

  test('la pantalla dentro del panel lista la notificación de la donación', async () => {
    render(<MemoryRouter><NotificationsScreen inPanel /></MemoryRouter>);
    expect(await screen.findByText('Recibiste una donación')).toBeInTheDocument();
  });
});

// §270: un aviso del acuerdo de patrocinio lleva a la pantalla del acuerdo de la ONG (la pantalla le pasa el rol).
test('un mensaje del acuerdo lleva al acuerdo, en el panel de la ONG', async () => {
  vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [{ ...donationNotice, id: 'n2', type: 'sponsorship_message',
    title: 'Mensaje sobre "Lago"', data: JSON.stringify({ project_id: 'p1', empresa_id: 'e1' }) }], unread: 1 } as never);
  render(<MemoryRouter><NotificationsScreen inPanel /></MemoryRouter>);
  const link = (await screen.findByText('Mensaje sobre "Lago"')).closest('a');
  expect(link).toHaveAttribute('href', '/ngo/patrocinios/e1/p1');
  // §271: ícono propio (apretón de manos), no la campana genérica
  expect(link!.querySelector('.lucide-handshake')).not.toBeNull();
});
