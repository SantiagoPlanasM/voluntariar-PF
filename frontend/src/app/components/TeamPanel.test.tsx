// src/app/components/TeamPanel.test.tsx — el panel de un miembro del equipo de una ONG (/equipo/:ngoId, §296).
//
// Coordinador: las postulaciones sin responder (cada una lleva al voluntariado con esa postulación marcada) y los
// voluntariados con cuántas pendientes tienen, que abren su gestión en /equipo/:ngoId/project/:id.
// Comunicador: los voluntariados (al detalle público) y "Publicar un Momento". Sin acceso: el error del backend.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, TeamPanel as Panel } from '../../lib/api';
import { TeamPanel } from './TeamPanel';

const projects: Panel['projects'] = [
  { id: 'p1', title: 'Huerta', status: 'active', image: null, volunteers_needed: 10, current_volunteers: 3, pending: 2 },
  { id: 'p2', title: 'Colecta', status: 'completed', image: null, volunteers_needed: 5, current_volunteers: 5, pending: 0 },
];
const pending = [{
  id: 'e1', user_id: 'u9', project_id: 'p1', project_title: 'Huerta', status: 'pending', created_at: '2026-10-30 12:00:00',
  volunteer_name: 'Juana Paz', volunteer_email: 'j@x.com', phone: '351 555 0000', interview: null,
}] as unknown as Panel['pending_enrollments'];
const mount = () => render(
  <MemoryRouter initialEntries={['/equipo/ngo-1']}><Routes><Route path="/equipo/:ngoId" element={<TeamPanel />} /></Routes></MemoryRouter>);

beforeEach(() => { vi.restoreAllMocks(); });

describe('Panel del equipo', () => {
  test('coordinación: postulaciones sin responder y voluntariados que abren su gestión', async () => {
    vi.spyOn(api.team, 'panel').mockResolvedValue({ ngo: { id: 'ngo-1', name: 'Sustentando', logo: null }, role: 'coordinator', projects, pending_enrollments: pending });
    mount();
    expect(await screen.findByRole('heading', { name: 'Sustentando' })).toBeInTheDocument();
    expect(screen.getByText('Coordinación')).toBeInTheDocument();
    const sinResponder = screen.getByRole('region', { name: 'Postulaciones sin responder' });
    expect(within(sinResponder).getByRole('link', { name: /^Juana Paz/ })).toHaveAttribute('href', '/equipo/ngo-1/project/p1?postulacion=e1');
    expect(within(sinResponder).getByRole('link', { name: 'Llamar a Juana Paz: 351 555 0000' })).toBeInTheDocument();
    const vols = screen.getByRole('region', { name: 'Voluntariados' });
    expect(within(vols).getByRole('link', { name: /Huerta/ })).toHaveAttribute('href', '/equipo/ngo-1/project/p1');
    expect(within(vols).getByText('2 sin responder')).toBeInTheDocument();
    expect(within(vols).getByText(/^Activo · 3\/10 lugares/)).toBeInTheDocument();
    expect(within(vols).getByText(/^Finalizado · 5\/5 lugares/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Publicar un Momento' })).toBeInTheDocument();
  });

  test('"Volver" lleva a Equipos en el perfil (antes, a Configuración)', async () => {
    vi.spyOn(api.team, 'panel').mockResolvedValue({ ngo: { id: 'ngo-1', name: 'Sustentando', logo: null }, role: 'communicator', projects });
    mount();
    await screen.findByRole('heading', { name: 'Sustentando' });
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/profile#equipos');
  });

  test('comunicación: sin postulaciones; los voluntariados van al detalle público', async () => {
    vi.spyOn(api.team, 'panel').mockResolvedValue({ ngo: { id: 'ngo-1', name: 'Sustentando', logo: null }, role: 'communicator', projects });
    mount();
    expect(await screen.findByText('Comunicación')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Postulaciones sin responder' })).toBeNull();
    const vols = screen.getByRole('region', { name: 'Voluntariados' });
    expect(within(vols).getByRole('link', { name: /Huerta/ })).toHaveAttribute('href', '/project/p1');
    expect(within(vols).queryByText('2 sin responder')).toBeNull();
    expect(screen.getByRole('link', { name: 'Publicar un Momento' })).toHaveAttribute('href', '/momentos?crear=1');
  });

  test('coordinación sin pendientes: lo dice', async () => {
    vi.spyOn(api.team, 'panel').mockResolvedValue({ ngo: { id: 'ngo-1', name: 'Sustentando', logo: null }, role: 'coordinator', projects, pending_enrollments: [] });
    mount();
    expect(await screen.findByText('No hay postulaciones sin responder.')).toBeInTheDocument();
  });

  test('sin acceso: el mensaje del backend', async () => {
    vi.spyOn(api.team, 'panel').mockRejectedValue(new ApiError('No sos parte del equipo de esta ONG', 403));
    mount();
    expect(await screen.findByText('No sos parte del equipo de esta ONG')).toBeInTheDocument();
  });
});
