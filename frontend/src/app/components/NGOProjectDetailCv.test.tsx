// src/app/components/NGOProjectDetailCv.test.tsx
//
// "Ver CV" en las inscripciones del panel de la ONG (PLAN_FALTANTE.md, Etapa 5, §166). El backend deja ver el CV
// con una inscripción pendiente o aprobada (decisión C1). Desde §168 la lista trae `has_cv` (true solo en esos casos y
// si hay CV) y el botón aparece solo con has_cv: antes aparecía siempre y, sin CV, se abría y cerraba una pestaña
// vacía. Si el CV se borró después de cargar la lista, el backend responde 404 y la fila lo explica (sin `alert`).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, EnrollmentWithVolunteer, Project } from '../../lib/api';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
vi.mock('../../lib/cv', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cv')>('../../lib/cv');
  return { ...actual, openCv: vi.fn() };
});
import { openCv } from '../../lib/cv';
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;
const enr = (id: string, user_id: string, volunteer_name: string, status: string, has_cv: boolean) =>
  ({ id, user_id, project_id: 'proj-1', status, volunteer_name, volunteer_email: `${user_id}@x.com`, has_cv }) as unknown as EnrollmentWithVolunteer;
const enrollments = [
  enr('e1', 'u-ana', 'Ana', 'pending', true),
  enr('e2', 'u-beto', 'Beto', 'approved', true),
  enr('e3', 'u-caro', 'Caro', 'rejected', false),
  enr('e4', 'u-dani', 'Dani', 'pending', false),
];

const mount = () => render(
  <MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
    <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
  </Routes></MemoryRouter>);
const row = async (name: string) => (await screen.findByText(name)).closest('.p-4') as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments });
  vi.mocked(openCv).mockReset().mockResolvedValue(undefined);
});

describe('"Ver CV" en las inscripciones de un proyecto', () => {
  test('aparece solo con has_cv (pendiente o aprobada con CV); no sin CV ni en las rechazadas', async () => {
    mount();
    expect(within(await row('Ana')).getByRole('button', { name: 'Ver CV de Ana' })).toBeInTheDocument();
    expect(within(await row('Beto')).getByRole('button', { name: 'Ver CV de Beto' })).toBeInTheDocument();
    expect(within(await row('Caro')).queryByRole('button', { name: /Ver CV/ })).toBeNull();
    expect(within(await row('Dani')).queryByRole('button', { name: /Ver CV/ })).toBeNull();
  });

  test('el estado solo no alcanza: una pendiente con has_cv false no tiene botón', async () => {
    vi.mocked(api.enrollments.byProject).mockResolvedValue({ enrollments: [enr('e9', 'u-eva', 'Eva', 'approved', false)] });
    mount();
    expect(within(await row('Eva')).queryByRole('button', { name: /Ver CV/ })).toBeNull();
  });

  test('abre el CV de ESE voluntario', async () => {
    mount();
    fireEvent.click(within(await row('Beto')).getByRole('button', { name: 'Ver CV de Beto' }));
    expect(openCv).toHaveBeenCalledWith('u-beto');
  });

  test('si el CV se borró después de cargar la lista (404): la fila dice que no lo cargó; las demás no muestran nada', async () => {
    vi.mocked(openCv).mockRejectedValue(new ApiError('CV no disponible', 404));
    const alertSpy = vi.spyOn(window, 'alert');
    mount();
    fireEvent.click(within(await row('Ana')).getByRole('button', { name: 'Ver CV de Ana' }));
    expect(await within(await row('Ana')).findByRole('alert')).toHaveTextContent('Ana no cargó su CV.');
    expect(within(await row('Beto')).queryByRole('alert')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('un intento que sale bien saca el aviso anterior de la fila', async () => {
    vi.mocked(openCv).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(undefined);
    mount();
    const ana = await row('Ana');
    fireEvent.click(within(ana).getByRole('button', { name: 'Ver CV de Ana' }));
    expect(await within(ana).findByRole('alert')).toBeInTheDocument();
    fireEvent.click(within(ana).getByRole('button', { name: 'Ver CV de Ana' }));
    await vi.waitFor(() => expect(openCv).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(within(ana).queryByRole('alert')).toBeNull());
  });

  test('otro error: su mensaje (o uno de conexión)', async () => {
    vi.mocked(openCv).mockRejectedValueOnce(new ApiError('La descarga de archivos no está disponible por el momento', 503))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mount();
    const ana = await row('Ana');
    fireEvent.click(within(ana).getByRole('button', { name: 'Ver CV de Ana' }));
    expect(await within(ana).findByRole('alert')).toHaveTextContent('La descarga de archivos no está disponible por el momento');
    fireEvent.click(within(ana).getByRole('button', { name: 'Ver CV de Ana' }));
    expect(await within(ana).findByRole('alert')).toHaveTextContent(/conexión/i);
  });
});
