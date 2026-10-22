// src/app/components/NotificationsUnread.test.tsx
//
// §152: NotificationsScreen mostraba "N sin leer" contando las no leídas de la lista que recibe, que el
// backend limita a 50. Con más de 50 sin leer decía 50 o menos (lo mismo pasaba con `unread` del backend,
// que filtraba esas 50 en JS). Ahora usa `unread` de GET /api/notifications, que es un COUNT sobre todas.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const auth = { user: { id: 'u1', name: 'María', email: 'm@example.com', role: 'volunteer' } };
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, notifications: { ...actual.api.notifications, list: vi.fn(), markAllRead: vi.fn() } } };
});

import { api } from '../../lib/api';
import { NotificationsScreen } from './NotificationsScreen';

const notif = (id: string, read: boolean) => ({
  id, user_id: 'u1', type: 'new_project', title: `Aviso ${id}`, body: '', read, created_at: '2026-10-14T12:00:00Z',
});

describe('NotificationsScreen: "N sin leer" sale del contador del backend', () => {
  beforeEach(() => { vi.mocked(api.notifications.list).mockReset(); vi.mocked(api.notifications.markAllRead).mockReset(); });

  test('la lista trae 1 no leída pero el backend cuenta 63 → "63 sin leer"', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [notif('a', false), notif('b', true)], unread: 63 });
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    expect(await screen.findByText('63 sin leer')).toBeInTheDocument();
    expect(screen.queryByText('1 sin leer')).not.toBeInTheDocument();
    expect(screen.getByText('Marcar todo leído')).toBeInTheDocument();
  });

  test('unread 0 → sin "sin leer" ni botón, aunque la lista traiga una con read=false', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [notif('a', false)], unread: 0 });
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    await screen.findByText('Aviso a');
    expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument();
    expect(screen.queryByText('Marcar todo leído')).not.toBeInTheDocument();
  });

  test('"Marcar todo leído" recarga y toma el contador nuevo del backend', async () => {
    vi.mocked(api.notifications.list)
      .mockResolvedValueOnce({ notifications: [notif('a', false)], unread: 70 })
      .mockResolvedValueOnce({ notifications: [notif('a', true)], unread: 0 });
    vi.mocked(api.notifications.markAllRead).mockResolvedValue(undefined as never);
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Marcar todo leído'));
    await waitFor(() => expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument());
    expect(api.notifications.list).toHaveBeenCalledTimes(2);
  });

  test('mientras carga no muestra ningún "sin leer"', async () => {
    vi.mocked(api.notifications.list).mockReturnValue(new Promise(() => {}));   // nunca responde
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
    expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument();
    expect(screen.queryByText('Marcar todo leído')).not.toBeInTheDocument();
  });

  test('si la carga falla, no queda un contador viejo', async () => {
    vi.mocked(api.notifications.list)
      .mockResolvedValueOnce({ notifications: [notif('a', false)], unread: 5 })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));   // sin conexión → mensaje genérico
    vi.mocked(api.notifications.markAllRead).mockResolvedValue(undefined as never);
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Marcar todo leído'));
    await screen.findByText(/No pudimos cargar tus notificaciones/);
    expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument();
  });
});
