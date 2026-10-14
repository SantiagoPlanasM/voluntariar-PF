// src/app/components/NGODashboard.test.tsx
//
// REVISION F14: GET /ngos/me manda `project_title` en cada solicitud pendiente, pero el tipo no lo declaraba y
// la pantalla no lo mostraba: con varios proyectos, la ONG no sabía a qué voluntariado se anotó cada persona.
// Y si la misma persona se anotaba en dos, sus dos filas (y sus botones aprobar/rechazar) eran idénticas.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'ONG', role: 'ngo' }, logout: vi.fn() }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const pending = (id: string, project_id: string, project_title: string) => ({
    id, user_id: 'u-juan', project_id, project_title, status: 'pending', created_at: '2026-10-14 12:00:00',
    volunteer_name: 'Juan Pérez', volunteer_email: 'juan@example.com',
  });
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: {
        ...actual.api.ngos,
        me: vi.fn().mockResolvedValue({
          ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 }, projects: [],
          stats: { total_projects: 2, active_projects: 2, completed_projects: 0, total_volunteers: 0, total_funding: 0, pending_enrollments: 2 },
          pending_enrollments: [pending('e1', 'proj-1', 'Reforestación Urbana'), pending('e2', 'proj-2', 'Huerta Comunitaria')],
        }),
      },
    },
  };
});

import { NGODashboard } from './NGODashboard';

describe('NGODashboard: solicitudes pendientes', () => {
  test('cada solicitud muestra a qué voluntariado es', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const heading = await screen.findByRole('heading', { name: /Solicitudes pendientes/ });
    const box = heading.closest('div')!.parentElement!;
    expect(within(box).getByText('Reforestación Urbana')).toBeInTheDocument();
    expect(within(box).getByText('Huerta Comunitaria')).toBeInTheDocument();
  });

  test('la misma persona en dos proyectos: los botones dicen cuál aprueban o rechazan', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Aprobar a Juan Pérez en Reforestación Urbana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar a Juan Pérez en Reforestación Urbana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar a Juan Pérez en Huerta Comunitaria' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar a Juan Pérez en Huerta Comunitaria' })).toBeInTheDocument();
  });
});
