// src/app/components/NGOProjectDetailTeam.test.tsx — la gestión de un voluntariado desde el equipo (§296).
//
// /equipo/:ngoId/project/:projectId reutiliza NGOProjectDetail con `team`: el coordinador ve las postulaciones y las
// decide (el backend lo deja desde §295), pero no lo que es solo del dueño: editar, KPIs ni cambiar el estado.
// "Mensaje" va al chat del voluntario (/messages), no al de la ONG (/ngo/messages).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, EnrollmentWithVolunteer, Project } from '../../lib/api';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;
const enrollments = [{ id: 'e1', user_id: 'u-ana', project_id: 'proj-1', status: 'pending', volunteer_name: 'Ana', volunteer_email: 'a@x.com' }] as unknown as EnrollmentWithVolunteer[];
const mount = (team: boolean) => render(
  <MemoryRouter initialEntries={[team ? '/equipo/ngo-1/project/proj-1' : '/ngo/dashboard/project/proj-1']}><Routes>
    <Route path="/equipo/:ngoId/project/:projectId" element={<NGOProjectDetail team />} />
    <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
    <Route path="/messages/:userId" element={<p>chat del voluntario</p>} />
    <Route path="/ngo/messages/:userId" element={<p>chat de la ONG</p>} />
  </Routes></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments });
});

describe('NGOProjectDetail desde el equipo', () => {
  test('sin editar, KPIs ni estado; con las postulaciones y Aprobar', async () => {
    const update = vi.spyOn(api.enrollments, 'updateStatus').mockResolvedValue({ message: 'ok' });
    mount(true);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /KPIs/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Estado del voluntariado' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Aprobar/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('e1', 'approved'));
  });

  test('"Mensaje" abre el chat del voluntario', async () => {
    mount(true);
    fireEvent.click(await screen.findByTitle('Mensaje a Ana'));
    expect(await screen.findByText('chat del voluntario')).toBeInTheDocument();
  });

  test('el dueño sigue viendo todo y su chat es el de la ONG', async () => {
    mount(false);
    expect(await screen.findByRole('button', { name: /Editar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /KPIs/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estado del voluntariado' })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Mensaje a Ana'));
    expect(await screen.findByText('chat de la ONG')).toBeInTheDocument();
  });
});
