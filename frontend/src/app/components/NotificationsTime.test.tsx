// src/app/components/NotificationsTime.test.tsx
//
// REVISION.md F11: NotificationsScreen tenía su propia copia de timeAgo con `new Date(fecha)`. El formato
// de SQLite ("YYYY-MM-DD HH:MM:SS", UTC sin zona) se interpretaba como hora LOCAL: en Córdoba (UTC-3) una
// notificación de hace 5 minutos quedaba 3 horas "en el futuro" y se mostraba "ahora". Ahora usa el
// timeAgo compartido de lib/format.ts (parseBackendDate).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const auth = { user: { id: 'u1', name: 'María', email: 'm@example.com', role: 'volunteer' } };
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, notifications: { ...actual.api.notifications, list: vi.fn(), markAllRead: vi.fn() } } };
});

import { api } from '../../lib/api';
import { NotificationsScreen } from './NotificationsScreen';

describe('NotificationsScreen: "hace cuánto" con timestamps de SQLite y de Postgres', () => {
  let prevTZ: string | undefined;
  beforeEach(() => {
    prevTZ = process.env.TZ;
    process.env.TZ = 'America/Argentina/Cordoba';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T12:05:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ;
  });

  const withNotif = async (created_at: string) => {
    vi.mocked(api.notifications.list).mockResolvedValue({
      notifications: [{ id: 'n1', user_id: 'u1', type: 'enrollment_approved', title: 'Te aprobaron', body: '', read: true, created_at }],
    } as never);
    render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Te aprobaron')).toBeInTheDocument());
  };

  test('formato SQLite (UTC sin zona) de hace 5 minutos → "5 min", no "ahora"', async () => {
    await withNotif('2026-10-14 12:00:00');
    expect(screen.getByText('5 min')).toBeInTheDocument();
  });

  test('ISO con Z (Postgres) de hace 3 horas → "3 h"', async () => {
    await withNotif('2026-10-14T09:05:00.000Z');
    expect(screen.getByText('3 h')).toBeInTheDocument();
  });
});
