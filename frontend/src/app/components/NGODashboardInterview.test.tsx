// src/app/components/NGODashboardInterview.test.tsx — la entrevista desde el panel de la ONG (§279).
//
// Pedido del usuario: para ver o agendar una entrevista había que entrar al voluntariado y buscar la postulación.
// Criterio: cada postulación sin responder tiene, junto a Aceptar y Rechazar, un link "Entrevista" que lleva al
// detalle del voluntariado con esa postulación marcada (?postulacion=<id>). Si hay una entrevista programada, la fila
// muestra cuándo; una cancelada no se muestra.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'ONG', role: 'ngo' }, logout: vi.fn() }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const pending = (id: string, name: string, project_id: string, project_title: string, interview: unknown) => ({
    id, user_id: `u-${id}`, project_id, project_title, status: 'pending', created_at: '2026-10-14 12:00:00',
    volunteer_name: name, volunteer_email: `${id}@example.com`, interview,
  });
  const iv = (status: string) => ({ id: 'iv', enrollment_id: 'x', date: '2030-03-10', time: '18:30', link: null, place: 'Sede', note: null, status });
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: {
        ...actual.api.ngos,
        me: vi.fn().mockResolvedValue({
          ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 }, projects: [],
          stats: { total_projects: 2, active_projects: 2, completed_projects: 0, total_volunteers: 0, total_funding: 0, pending_enrollments: 3 },
          pending_enrollments: [
            pending('e1', 'Juan Pérez', 'proj-1', 'Reforestación Urbana', null),
            pending('e2', 'Ana Gómez', 'proj-2', 'Huerta Comunitaria', iv('scheduled')),
            pending('e3', 'Luis Sosa', 'proj-2', 'Huerta Comunitaria', iv('cancelled')),
          ],
        }),
      },
    },
  };
});

import { NGODashboard } from './NGODashboard';

const fila = async (nombre: string) => (await screen.findByText(nombre)).closest('li')!;

describe('Panel de la ONG: la entrevista de cada postulación', () => {
  test('cada postulación tiene "Entrevista", que lleva al detalle con la postulación marcada', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const link = within(await fila('Juan Pérez')).getByRole('link', { name: 'Entrevista con Juan Pérez en Reforestación Urbana' });
    expect(link).toHaveAttribute('href', '/ngo/dashboard/project/proj-1?postulacion=e1');
    expect(within(await fila('Ana Gómez')).getByRole('link', { name: 'Entrevista con Ana Gómez en Huerta Comunitaria' }))
      .toHaveAttribute('href', '/ngo/dashboard/project/proj-2?postulacion=e2');
  });

  test('con una entrevista programada, la fila dice cuándo; sin entrevista o cancelada, no', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    expect(within(await fila('Ana Gómez')).getByText(/Entrevista: .*10 de mar.*18:30/)).toBeInTheDocument();
    expect(within(await fila('Juan Pérez')).queryByText(/Entrevista:/)).toBeNull();
    expect(within(await fila('Luis Sosa')).queryByText(/Entrevista:/)).toBeNull();
  });
});
