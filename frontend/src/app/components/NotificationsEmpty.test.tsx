// D26 (Issue #27, sesión exploratoria §245): sin notificaciones, la ONG veía el texto del voluntario: "Cuando una ONG
// responda o alguien te siga, aparece acá". A la ONG no le responde una ONG, y seguir a una ONG no genera notificación.
// Criterio: el texto vacío dice qué avisos recibe cada rol (lo que crea el backend para cada uno).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const auth = vi.hoisted(() => ({ user: { id: 'u1', name: 'X', email: 'x@x.org', role: 'volunteer' } as { id: string; name: string; email: string; role: string } }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, notifications: { ...actual.api.notifications, list: vi.fn() } } };
});
import { api } from '../../lib/api';
import { NotificationsScreen } from './NotificationsScreen';

beforeEach(() => {
  vi.mocked(api.notifications.list).mockReset().mockResolvedValue({ notifications: [], unread: 0 } as never);
});

const emptyText = async (role: string) => {
  auth.user = { ...auth.user, role };
  render(<MemoryRouter><NotificationsScreen /></MemoryRouter>);
  await screen.findByText('No tenés notificaciones');
  return screen.getByText(/aparece acá/).textContent;
};

describe('Notificaciones vacías: el texto según el rol (D26)', () => {
  test('voluntario: el texto de DESIGN.md, sin cambios', async () => {
    expect(await emptyText('volunteer')).toBe('Cuando una ONG responda o alguien te siga, aparece acá.');
  });

  test('ONG: postulaciones, donaciones y propuestas de patrocinio; no menciona a "una ONG"', async () => {
    const text = await emptyText('ngo');
    expect(text).toBe('Cuando alguien se postule, done o una empresa te proponga un patrocinio, aparece acá.');
    expect(text).not.toMatch(/una ONG/);
  });

  test('empresa: las respuestas de las ONG a sus propuestas de patrocinio', async () => {
    expect(await emptyText('company')).toBe('Cuando una ONG responda a tus propuestas de patrocinio, aparece acá.');
  });
});
