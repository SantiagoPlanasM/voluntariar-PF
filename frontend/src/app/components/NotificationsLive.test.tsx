// src/app/components/NotificationsLive.test.tsx — la lista de notificaciones se actualiza sola (§336).
//
// Con la pantalla abierta, una notificación nueva no aparecía hasta salir y volver a entrar. Ahora, cuando el
// servidor avisa por el WebSocket (`notificationTick` de ChatContext), la lista se pide de nuevo, sin volver a
// mostrar el esqueleto de carga (la lista que ya está no parpadea).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth, chat } = vi.hoisted(() => ({
  auth: { user: { id: 'u1', name: 'María', email: 'm@example.com', role: 'volunteer' } },
  chat: { notificationTick: 0 } as { notificationTick: number } | null,
}));
const state = { chat };
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/ChatContext', () => ({ useChatOptional: () => state.chat }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, notifications: { ...actual.api.notifications, list: vi.fn() } } };
});

import { api } from '../../lib/api';
import { NotificationsScreen } from './NotificationsScreen';

const notif = (id: string) => ({
  id, user_id: 'u1', type: 'new_project', title: `Aviso ${id}`, body: '', read: false, created_at: '2026-10-14T12:00:00Z',
});
const tree = () => <MemoryRouter><NotificationsScreen /></MemoryRouter>;

describe('NotificationsScreen: aviso por el WebSocket', () => {
  beforeEach(() => {
    state.chat = { notificationTick: 0 };
    vi.mocked(api.notifications.list).mockReset();
  });

  test('llega un aviso → aparece la notificación nueva y el contador, sin esqueleto de carga', async () => {
    let answer!: (r: { notifications: ReturnType<typeof notif>[]; unread: number }) => void;
    vi.mocked(api.notifications.list)
      .mockResolvedValueOnce({ notifications: [notif('a')], unread: 1 })
      .mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    const { rerender } = render(tree());
    expect(await screen.findByText('Aviso a')).toBeInTheDocument();

    state.chat = { notificationTick: 1 };
    rerender(tree());
    await waitFor(() => expect(api.notifications.list).toHaveBeenCalledTimes(2));
    // Mientras llega la respuesta, la lista anterior sigue en pantalla.
    expect(screen.queryByRole('status', { name: 'Cargando notificaciones' })).not.toBeInTheDocument();
    expect(screen.getByText('Aviso a')).toBeInTheDocument();
    answer({ notifications: [notif('b'), notif('a')], unread: 2 });
    expect(await screen.findByText('Aviso b')).toBeInTheDocument();
    expect(screen.getByText('2 sin leer')).toBeInTheDocument();
  });

  test('si el pedido del aviso falla, queda la lista que había (sin mensaje de error)', async () => {
    vi.mocked(api.notifications.list)
      .mockResolvedValueOnce({ notifications: [notif('a')], unread: 1 })
      .mockRejectedValueOnce(new Error('red'));
    const { rerender } = render(tree());
    await screen.findByText('Aviso a');
    state.chat = { notificationTick: 1 };
    rerender(tree());
    await waitFor(() => expect(api.notifications.list).toHaveBeenCalledTimes(2));
    await new Promise(r => setTimeout(r, 20));
    expect(screen.getByText('Aviso a')).toBeInTheDocument();
    expect(screen.getByText('1 sin leer')).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar/)).not.toBeInTheDocument();
  });

  test('si la primera carga había fallado, el aviso trae la lista y saca el mensaje de error', async () => {
    vi.mocked(api.notifications.list)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ notifications: [notif('a')], unread: 1 });
    const { rerender } = render(tree());
    expect(await screen.findByText(/No pudimos cargar/)).toBeInTheDocument();
    state.chat = { notificationTick: 1 };
    rerender(tree());
    expect(await screen.findByText('Aviso a')).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar/)).not.toBeInTheDocument();
  });

  test('al abrir la pantalla se pide una sola vez, con aviso previo o sin proveedor de chat', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [notif('a')], unread: 1 });
    state.chat = { notificationTick: 7 };   // avisos de antes de abrir la pantalla
    const first = render(tree());
    await screen.findByText('Aviso a');
    await new Promise(r => setTimeout(r, 20));
    expect(api.notifications.list).toHaveBeenCalledTimes(1);
    first.unmount();
    state.chat = null;
    render(tree());
    await screen.findByText('Aviso a');
    expect(api.notifications.list).toHaveBeenCalledTimes(2);
  });
});
