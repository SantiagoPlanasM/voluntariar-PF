// src/app/components/NGODashboardLayout.test.tsx
//
// Panel de la ONG más ancho (§321). Antes llegaba a 1100 px: en una pantalla grande sobraba espacio a los costados y,
// en la grilla de abajo, la tabla de voluntariados cortaba "Recaudado" y las postulaciones apretaban los nombres.
// Desde 1280 px: a la izquierda el trabajo (voluntariados y embudo) y a la derecha una columna con lo pendiente
// (postulaciones sin responder) y los accesos. Más angosto, una sola columna con el orden de siempre.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'ONG', role: 'ngo' }, logout: vi.fn() }) }));
vi.mock('./NGOTeamCard', () => ({ NGOTeamCard: () => <a href="/ngo/equipo">Equipo</a> }));
vi.mock('./NGOValidation', () => ({ NGOValidationCard: () => <a href="/ngo/validacion">Validación</a> }));
vi.mock('./MercadoPagoAccount', () => ({ MercadoPagoBanner: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      notifications: { ...actual.api.notifications, list: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }) },
      ngos: {
        ...actual.api.ngos,
        me: vi.fn().mockResolvedValue({
          ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 },
          projects: [{ id: 'p1', title: 'Reforestación Urbana', current_volunteers: 3, volunteers_needed: 10, current_funding: 0 }],
          stats: { total_projects: 1, active_projects: 1, completed_projects: 0, total_volunteers: 3, total_funding: 0, pending_enrollments: 1 },
          pending_enrollments: [{
            id: 'e1', user_id: 'u-juan', project_id: 'p1', project_title: 'Reforestación Urbana', status: 'pending',
            created_at: '2026-10-14 12:00:00', volunteer_name: 'Juan Pérez', volunteer_email: 'juan@example.com',
          }],
          funnel: { applications: 4, interviewed: 1, approved: 2, with_hours: 0, rejected: 1 },
        }),
      },
    },
  };
});

import { NGODashboard } from './NGODashboard';

const real = window.matchMedia;
afterEach(() => { window.matchMedia = real; });
function setXl(xl: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q === '(min-width: 1280px)' ? xl : false,
    media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const panel = async () => {
  render(<MemoryRouter><NGODashboard /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: 'Sustentando' });
};
const heading = (name: RegExp) => screen.getByRole('heading', { level: 2, name });
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('Panel de la ONG: disposición', () => {
  test('llega a 1400 px de ancho (antes 1100)', async () => {
    setXl(true);
    await panel();
    const box = heading(/^Voluntariados/).closest('.max-w-\\[1400px\\]');
    expect(box).not.toBeNull();
  });

  test('desde 1280 px: columna derecha con lo pendiente y los accesos, en ese orden', async () => {
    setXl(true);
    await panel();
    const side = screen.getByRole('complementary', { name: 'Pendientes y accesos' });
    const pend = within(side).getByRole('heading', { name: /Postulaciones sin responder/ });
    const accesos = within(side).getByRole('navigation', { name: 'Accesos del panel' });
    expect(before(pend, accesos)).toBe(true);
    // Los accesos van de a uno por fila (la columna es angosta para la grilla de dos).
    expect(accesos.className).not.toContain('md:grid-cols-2');
    // Ni la primera ocupa dos columnas: en una grilla de una, md:col-span-2 crearía otra columna implícita.
    expect(accesos.querySelector('.md\\:col-span-2')).toBeNull();
    // Voluntariados y embudo, a la izquierda: fuera de la columna y en ese orden.
    expect(side).not.toContainElement(heading(/^Voluntariados/));
    expect(side).not.toContainElement(heading(/Embudo/));
    expect(before(heading(/^Voluntariados/), heading(/Embudo/))).toBe(true);
  });

  test('más angosto (o sin matchMedia): una sola columna con el orden de siempre', async () => {
    setXl(false);
    await panel();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    const accesos = screen.getByRole('navigation', { name: 'Accesos del panel' });
    expect(accesos.className).toContain('md:grid-cols-2');
    const order = [accesos, heading(/Embudo/), heading(/Postulaciones sin responder/), heading(/^Voluntariados/)];
    for (let i = 1; i < order.length; i++) expect(before(order[i - 1], order[i])).toBe(true);
  });

  test('sin matchMedia (navegador viejo): una sola columna, que anda en cualquier ancho', async () => {
    // @ts-expect-error: navegador sin matchMedia
    window.matchMedia = undefined;
    await panel();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Accesos del panel' }).className).toContain('md:grid-cols-2');
  });

  test('una sola columna: postulaciones y voluntariados apilados (lado a lado cortaban la tabla)', async () => {
    setXl(false);
    await panel();
    const grid = heading(/^Voluntariados/).closest('section')!.parentElement!;
    expect(grid.className).not.toMatch(/grid-cols/);
  });

  // En Chrome, a 390 px: la tabla medía 433 px en una caja de 339 y "Recaudado" quedaba cortado (un título largo la
  // estiraba). Con ancho fijo, el título se trunca y los números tienen su lugar.
  test('la tabla de voluntariados tiene ancho fijo y columnas de números con ancho propio', async () => {
    setXl(false);
    await panel();
    const table = heading(/^Voluntariados/).closest('section')!.querySelector('table')!;
    expect(table.className).toContain('table-fixed');
    expect(within(table).getByRole('columnheader', { name: 'Recaudado' }).className).toMatch(/\bw-\d+/);
    expect(within(table).getByRole('columnheader', { name: 'Voluntarios' }).className).toMatch(/\bw-\d+/);
  });

  test('cada componente se dibuja una sola vez en las dos disposiciones', async () => {
    for (const xl of [true, false]) {
      setXl(xl);
      const { unmount } = render(<MemoryRouter><NGODashboard /></MemoryRouter>);
      await screen.findByRole('heading', { level: 1, name: 'Sustentando' });
      expect(screen.getAllByRole('navigation', { name: 'Accesos del panel' })).toHaveLength(1);
      expect(screen.getAllByRole('heading', { name: /Postulaciones sin responder/ })).toHaveLength(1);
      unmount();
    }
  });
});
