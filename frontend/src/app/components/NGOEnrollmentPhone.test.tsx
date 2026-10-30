// src/app/components/NGOEnrollmentPhone.test.tsx — el teléfono de la postulación, del lado de la ONG (§291).
//
// El backend lo manda solo con la postulación pendiente o aprobada (si no, null). Donde está el email del postulante
// (panel de la ONG y detalle del voluntariado) aparece el teléfono como link `tel:` (en el celular, llama directo),
// con un nombre accesible que dice a quién. Sin teléfono, no se dibuja nada.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, EnrollmentWithVolunteer, Project } from '../../lib/api';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'ONG', role: 'ngo' }, logout: vi.fn() }) }));
import { NGOProjectDetail } from './NGOProjectDetail';
import { NGODashboard } from './NGODashboard';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;
const enr = (id: string, volunteer_name: string, status: string, phone: string | null) =>
  ({ id, user_id: `u-${id}`, project_id: 'proj-1', project_title: 'Reforestación', status, volunteer_name,
    volunteer_email: `${id}@x.com`, phone, created_at: '2026-10-14 12:00:00' }) as unknown as EnrollmentWithVolunteer;

beforeEach(() => { vi.restoreAllMocks(); });

describe('Teléfono de la postulación para la ONG', () => {
  test('detalle del voluntariado: link tel: sin espacios, y nada si no hay', async () => {
    vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
    vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [
      enr('e1', 'Ana', 'pending', '+54 9 (351) 555-1234'), enr('e2', 'Beto', 'approved', null),
    ] });
    render(<MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
      <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
    </Routes></MemoryRouter>);
    const ana = (await screen.findByText('Ana')).closest('.p-4') as HTMLElement;
    const link = within(ana).getByRole('link', { name: 'Llamar a Ana: +54 9 (351) 555-1234' });
    expect(link).toHaveAttribute('href', 'tel:+549351555-1234');
    const beto = (await screen.findByText('Beto')).closest('.p-4') as HTMLElement;
    expect(within(beto).queryByRole('link', { name: /Llamar/ })).toBeNull();
  });

  test('panel de la ONG: las pendientes muestran el teléfono', async () => {
    vi.spyOn(api.ngos, 'me').mockResolvedValue({
      ngo: { id: 'ngo-1', name: 'Sustentando', followers: 0 }, projects: [],
      stats: { total_projects: 1, active_projects: 1, completed_projects: 0, total_volunteers: 0, total_funding: 0, pending_enrollments: 2 },
      pending_enrollments: [enr('e1', 'Juan Pérez', 'pending', '0351 4555555'), enr('e2', 'Luis Sosa', 'pending', null)],
    } as never);
    render(<MemoryRouter><NGODashboard /></MemoryRouter>);
    const juan = (await screen.findByText('Juan Pérez')).closest('li')!;
    expect(within(juan).getByRole('link', { name: 'Llamar a Juan Pérez: 0351 4555555' })).toHaveAttribute('href', 'tel:03514555555');
    const luis = (await screen.findByText('Luis Sosa')).closest('li')!;
    expect(within(luis).queryByRole('link', { name: /Llamar/ })).toBeNull();
  });
});
