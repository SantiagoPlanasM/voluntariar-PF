// src/app/components/CreateVoluntariadoSchedule.test.tsx — "¿Cuándo es?" en el formulario del voluntariado (§315).
// Fecha y hora de inicio y de fin, opcionales: se precargan al editar, se validan en el paso 2 y se manda solo lo que
// cambió (null para borrar).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-ngo', name: 'ONG', email: 'o@x.com', role: 'ngo' } }) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, geocodeAddress: vi.fn(), api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), update: vi.fn(), create: vi.fn() } } };
});
import { api } from '../../lib/api';
import { CreateVoluntariado } from './CreateVoluntariado';

const get = vi.mocked(api.projects.get);
const update = vi.mocked(api.projects.update);
window.scrollTo = vi.fn() as never;

const PROJECT = {
  id: 'p1', ngo_id: 'n1', title: 'Jornada de limpieza en el Lago', description: 'Limpiamos la costa de la laguna',
  full_description: '', category: 'Medio Ambiente', location: 'Mar Chiquita', modality: 'presencial',
  type: 'fugaz', duration: '1 jornada', hours_per_week: null, volunteers_needed: 10, current_volunteers: 2,
  funding_goal: 0, current_funding: 0, cost_per_person: 0, roles_needed: [], requirements: [],
  latitude: -30.9, longitude: -62.6, status: 'active', followers: 0, comments: [], ratings: [], kpis: [],
  avg_rating: 0, can_manage: true,
  start_date: '2026-12-05', end_date: null, start_time: '09:00', end_time: '13:00',
};

const mount = () => {
  get.mockResolvedValue({ project: PROJECT as never });
  render(
    <MemoryRouter initialEntries={['/ngo/dashboard/project/p1/editar']}><Routes>
      <Route path="/ngo/dashboard/project/:projectId/editar" element={<CreateVoluntariado />} />
      <Route path="/ngo/dashboard/project/:projectId" element={<p>Detalle del voluntariado</p>} />
    </Routes></MemoryRouter>,
  );
};
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const continuar = () => fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

beforeEach(() => {
  get.mockReset();
  update.mockReset().mockResolvedValue({ project: {} as never });
});

describe('¿Cuándo es? (§315)', () => {
  test('al editar, precarga las fechas y las horas', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('2026-12-05');
    expect(screen.getByLabelText('Fecha de fin')).toHaveValue('');
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('09:00');
    expect(screen.getByLabelText('Hora de fin')).toHaveValue('13:00');
  });

  test('una hora de fin anterior a la de inicio no deja seguir y muestra el error', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    fill('Hora de fin', '08:00');
    continuar();
    expect(screen.getByText('Tiene que ser después de la hora de inicio')).toBeInTheDocument();
    expect(screen.getByLabelText('Hora de fin')).toBeInTheDocument();   // sigue en el paso 2
  });

  test('agregar la fecha de fin y borrar la hora de fin manda solo eso (null para borrar)', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Editar voluntariado' });
    continuar();
    fill('Fecha de fin', '2026-12-06');
    fill('Hora de fin', '');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('p1', { end_date: '2026-12-06', end_time: null });
  });
});
