// src/app/components/NGOProjectDetailInterview.test.tsx — entrevistas desde el panel de la ONG (§262, PLAN_ENTREVISTAS.md).
//
// Criterio: en una postulación PENDIENTE sin entrevista programada, "Agendar entrevista" abre un formulario (fecha,
// hora, link, lugar, nota) que manda solo lo cargado y, al guardar, la fila muestra la entrevista; si el backend la
// rechaza, se ve su mensaje y el formulario sigue abierto. Con una programada: el resumen, "Reprogramar" (formulario
// precargado, manda los cambios por el PATCH), "Cancelar entrevista" (con confirmación) y "Marcar realizada" solo si
// ya pasó. Una postulación aprobada o rechazada no ofrece agendar.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, EnrollmentWithVolunteer, Interview, Project } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0, cost_per_person: 0,
} as Project;
const enrollment = (over: Partial<EnrollmentWithVolunteer> = {}): EnrollmentWithVolunteer => ({
  id: 'enr-1', user_id: 'u-1', project_id: 'proj-1', status: 'pending', created_at: '2026-10-01T10:00:00Z',
  volunteer_name: 'Ana Gómez', volunteer_email: 'ana@x.com', interview: null, ...over,
});
const interview = (over: Partial<Interview> = {}): Interview => ({
  id: 'int-1', enrollment_id: 'enr-1', date: '2030-03-10', time: '18:00', link: 'https://meet.google.com/abc',
  place: null, note: null, status: 'scheduled', ...over,
});

const mount = (e: EnrollmentWithVolunteer) => {
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [e] });
  return render(
    <UiProvider><MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
      <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
    </Routes></MemoryRouter></UiProvider>);
};
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fila = () => screen.getByRole('region', { name: 'Entrevista con Ana Gómez' });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
});

// §279: el link "Entrevista" del panel trae ?postulacion=<id>: la fila queda a la vista y, si se puede agendar, el
// formulario ya abierto.
describe('Llegar desde el panel con la postulación marcada', () => {
  const mountWith = (e: EnrollmentWithVolunteer, search: string) => {
    vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [e] });
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <UiProvider><MemoryRouter initialEntries={[`/ngo/dashboard/project/proj-1${search}`]}><Routes>
        <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
      </Routes></MemoryRouter></UiProvider>);
    return scroll;
  };

  test('pendiente sin entrevista: la fila a la vista y el formulario de agendar abierto', async () => {
    const scroll = mountWith(enrollment(), '?postulacion=enr-1');
    expect(await screen.findByLabelText('Fecha de la entrevista')).toBeInTheDocument();
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('postulacion-enr-1'));
  });

  test('con una programada: la fila a la vista con el resumen, sin abrir el formulario', async () => {
    const scroll = mountWith(enrollment({ interview: interview() }), '?postulacion=enr-1');
    expect(await within(await screen.findByRole('region', { name: 'Entrevista con Ana Gómez' })).findByText(/10 de mar.*18:00/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de la entrevista')).toBeNull();
    await waitFor(() => expect(scroll).toHaveBeenCalled());
  });

  test('sin el parámetro, el formulario arranca cerrado', async () => {
    mountWith(enrollment(), '');
    expect(await screen.findByRole('button', { name: 'Agendar entrevista' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de la entrevista')).toBeNull();
  });
});

describe('Panel de la ONG: agendar una entrevista', () => {
  test('pendiente sin entrevista: agendar manda solo lo cargado y la fila muestra la entrevista', async () => {
    const schedule = vi.spyOn(api.enrollments, 'scheduleInterview').mockResolvedValue({ interview: interview({ place: 'Sede' }) });
    mount(enrollment());
    fireEvent.click(await screen.findByRole('button', { name: 'Agendar entrevista' }));
    fill('Fecha de la entrevista', '2030-03-10');
    fill('Hora de la entrevista', '18:00');
    fill('Link de la videollamada', 'https://meet.google.com/abc');
    fill('Lugar de la entrevista', 'Sede');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrevista' }));
    await waitFor(() => expect(schedule).toHaveBeenCalledWith('enr-1',
      { date: '2030-03-10', time: '18:00', link: 'https://meet.google.com/abc', place: 'Sede' }));
    expect(await within(fila()).findByText(/10 de mar.*18:00/)).toBeInTheDocument();
    expect(within(fila()).getByText(/Sede/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar entrevista' })).not.toBeInTheDocument();
  });

  test('si el backend la rechaza, se ve su mensaje y el formulario sigue abierto', async () => {
    vi.spyOn(api.enrollments, 'scheduleInterview').mockRejectedValue(new ApiError('La entrevista tiene que ser en el futuro', 400));
    mount(enrollment());
    fireEvent.click(await screen.findByRole('button', { name: 'Agendar entrevista' }));
    fill('Fecha de la entrevista', '2020-01-01');
    fill('Hora de la entrevista', '10:00');
    fill('Lugar de la entrevista', 'Sede');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrevista' }));
    expect(await within(fila()).findByRole('alert')).toHaveTextContent('La entrevista tiene que ser en el futuro');
    expect(screen.getByRole('button', { name: 'Guardar entrevista' })).toBeInTheDocument();
  });

  test('aprobada sin entrevista: no hay sección de entrevista', async () => {
    mount(enrollment({ status: 'approved' }));
    await screen.findByText('Ana Gómez');
    expect(screen.queryByRole('region', { name: 'Entrevista con Ana Gómez' })).not.toBeInTheDocument();
  });

  test('aprobada con la entrevista realizada: la muestra, sin ofrecer agendar otra', async () => {
    mount(enrollment({ status: 'approved', interview: interview({ date: '2021-05-05', status: 'done' }) }));
    expect(await within(await screen.findByRole('region', { name: 'Entrevista con Ana Gómez' })).findByText('Entrevista realizada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar entrevista' })).not.toBeInTheDocument();
  });
});

describe('Panel de la ONG: una entrevista programada', () => {
  test('muestra el resumen con el link; "Marcar realizada" no aparece antes de la fecha', async () => {
    mount(enrollment({ interview: interview() }));
    expect(await screen.findByText(/10 de mar.*18:00/)).toBeInTheDocument();
    expect(within(fila()).getByRole('link', { name: 'Abrir el link de la entrevista' })).toHaveAttribute('href', 'https://meet.google.com/abc');
    expect(within(fila()).queryByRole('button', { name: 'Marcar realizada' })).not.toBeInTheDocument();
    expect(within(fila()).queryByRole('button', { name: 'Agendar entrevista' })).not.toBeInTheDocument();
  });

  test('agregar al calendario (§271): Google Calendar con el nombre de quien se postuló, y el .ics', async () => {
    mount(enrollment({ interview: interview() }));
    const google = await within(await screen.findByRole('region', { name: 'Entrevista con Ana Gómez' })).findByRole('link', { name: 'Agregar a Google Calendar' });
    const q = new URL(google.getAttribute('href')!).searchParams;
    expect([q.get('text'), q.get('dates')]).toEqual(['Entrevista con Ana Gómez', '20300310T210000Z/20300310T220000Z']);
    expect(within(fila()).getByRole('link', { name: 'Descargar .ics' })).toHaveAttribute('download', 'entrevista.ics');
  });

  test('pasada la fecha, "Marcar realizada" manda done', async () => {
    const update = vi.spyOn(api.enrollments, 'updateInterview').mockResolvedValue({ interview: interview({ date: '2021-05-05', status: 'done' }) });
    mount(enrollment({ interview: interview({ date: '2021-05-05' }) }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar realizada' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('enr-1', { status: 'done' }));
    expect(await within(fila()).findByText('Entrevista realizada')).toBeInTheDocument();
  });

  test('reprogramar abre el formulario precargado y manda los datos por el PATCH', async () => {
    const update = vi.spyOn(api.enrollments, 'updateInterview').mockResolvedValue({ interview: interview({ time: '19:30' }) });
    mount(enrollment({ interview: interview() }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }));
    expect(screen.getByLabelText('Fecha de la entrevista')).toHaveValue('2030-03-10');
    expect(screen.getByLabelText('Link de la videollamada')).toHaveValue('https://meet.google.com/abc');
    fill('Hora de la entrevista', '19:30');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrevista' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('enr-1',
      { date: '2030-03-10', time: '19:30', link: 'https://meet.google.com/abc' }));
    expect(await within(fila()).findByText(/10 de mar.*19:30/)).toBeInTheDocument();
  });

  test('cancelar pide confirmación; al confirmar manda cancelled y vuelve a ofrecer agendar', async () => {
    const update = vi.spyOn(api.enrollments, 'updateInterview').mockResolvedValue({ interview: interview({ status: 'cancelled' }) });
    mount(enrollment({ interview: interview() }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar entrevista' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar entrevista' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('enr-1', { status: 'cancelled' }));
    expect(await within(fila()).findByRole('button', { name: 'Agendar entrevista' })).toBeInTheDocument();
  });

  test('si en la confirmación elige Volver, no cancela nada', async () => {
    const update = vi.spyOn(api.enrollments, 'updateInterview');
    mount(enrollment({ interview: interview() }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar entrevista' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(update).not.toHaveBeenCalled();
    expect(within(fila()).getByText(/10 de mar.*18:00/)).toBeInTheDocument();
  });
});
