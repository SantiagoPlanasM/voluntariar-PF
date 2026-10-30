// src/app/components/NGOFunnel.test.tsx — el embudo de postulaciones del panel de la ONG (§284).
//
// Criterio: con postulaciones, una sección "Embudo de postulaciones" con cada etapa, su cantidad y el porcentaje sobre
// el total (redondeado): postulaciones → con entrevista → aprobadas → con horas certificadas, y las rechazadas aparte.
// Sin postulaciones (o si el backend no lo manda), no se muestra. El panel la toma de GET /ngos/me.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NGOFunnel } from './NGOFunnel';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'ONG', role: 'ngo' }, logout: vi.fn() }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: {
        ...actual.api.ngos,
        me: vi.fn().mockResolvedValue({
          ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 }, projects: [], pending_enrollments: [],
          stats: { total_projects: 1, active_projects: 1, completed_projects: 0, total_volunteers: 3, total_funding: 0, pending_enrollments: 0 },
          funnel: { applications: 7, interviewed: 4, approved: 3, with_hours: 2, rejected: 1 },
        }),
      },
    },
  };
});
import { NGODashboard } from './NGODashboard';

const fila = (region: HTMLElement, etapa: string) => within(region).getByText(etapa).closest('li')!;

describe('Embudo de postulaciones', () => {
  test('cada etapa con su cantidad y su porcentaje sobre las postulaciones', () => {
    render(<NGOFunnel funnel={{ applications: 7, interviewed: 4, approved: 3, with_hours: 2, rejected: 1 }} />);
    const region = screen.getByRole('region', { name: 'Embudo de postulaciones' });
    expect(fila(region, 'Postulaciones')).toHaveTextContent(/7\s*100 %/);
    expect(fila(region, 'Con entrevista')).toHaveTextContent(/4\s*57 %/);
    expect(fila(region, 'Aprobadas')).toHaveTextContent(/3\s*43 %/);
    expect(fila(region, 'Con horas certificadas')).toHaveTextContent(/2\s*29 %/);
    expect(fila(region, 'Rechazadas')).toHaveTextContent(/1\s*14 %/);
    const etapas = within(region).getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent);
    expect(etapas).toEqual(['Postulaciones', 'Con entrevista', 'Aprobadas', 'Con horas certificadas', 'Rechazadas']);
  });

  test('sin postulaciones, o sin datos, no se muestra', () => {
    const { rerender } = render(<NGOFunnel funnel={{ applications: 0, interviewed: 0, approved: 0, with_hours: 0, rejected: 0 }} />);
    expect(screen.queryByRole('region', { name: 'Embudo de postulaciones' })).toBeNull();
    rerender(<NGOFunnel funnel={undefined} />);
    expect(screen.queryByRole('region', { name: 'Embudo de postulaciones' })).toBeNull();
  });

  test('el panel de la ONG lo muestra con los datos de GET /ngos/me', async () => {
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const region = await screen.findByRole('region', { name: 'Embudo de postulaciones' });
    expect(fila(region, 'Aprobadas')).toHaveTextContent(/3\s*43 %/);
  });
});
