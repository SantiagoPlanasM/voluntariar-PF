// src/app/components/NGOProjectDetailManage.test.tsx — administrar el voluntariado desde el panel de la ONG (§255).
//
// Antes el detalle del panel solo mostraba las inscripciones: no había forma de editar el voluntariado.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, Project } from '../../lib/api';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;

const mount = () => render(
  <MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
    <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
    <Route path="/ngo/dashboard/project/:projectId/editar" element={<p>Formulario de edición</p>} />
  </Routes></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [] });
});

describe('Panel de la ONG: editar el voluntariado', () => {
  test('"Editar" abre el formulario de edición de ese voluntariado', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByText('Formulario de edición')).toBeInTheDocument();
  });
});
