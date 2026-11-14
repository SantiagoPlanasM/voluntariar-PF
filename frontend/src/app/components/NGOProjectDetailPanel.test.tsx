// src/app/components/NGOProjectDetailPanel.test.tsx — T7 de la revisión contra DESIGN.md (§339).
//
// El detalle del voluntariado de la ONG con las reglas de los paneles y los componentes comunes: la doble meta
// (`DualGoal`) en vez de dos cajitas propias, `Avatar` en vez de una inicial sobre color, "Impacto" en vez de "KPIs",
// el tipo con mayúscula, y los errores como avisos de la app (`useToast`) en vez de `alert()`.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, EnrollmentWithVolunteer, Project } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';

vi.mock('./MomentsFeed', () => ({ MomentsFeed: () => null }));
import { NGOProjectDetail } from './NGOProjectDetail';

const project = {
  id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 2, funding_goal: 20000, current_funding: 8500, cost_per_person: 0,
} as Project;
const pending = { id: 'e1', user_id: 'u-ana', project_id: 'proj-1', status: 'pending', volunteer_name: 'Ana Gómez', volunteer_email: 'a@x.com' } as unknown as EnrollmentWithVolunteer;
const approved = { id: 'e2', user_id: 'u-beto', project_id: 'proj-1', status: 'approved', volunteer_name: 'Beto Ruiz', volunteer_email: 'b@x.com', hours_logged: 0 } as unknown as EnrollmentWithVolunteer;

const mount = () => render(
  <UiProvider><MemoryRouter initialEntries={['/ngo/dashboard/project/proj-1']}><Routes>
    <Route path="/ngo/dashboard/project/:projectId" element={<NGOProjectDetail />} />
    <Route path="/ngo/kpis/:projectId" element={<p>pantalla de impacto</p>} />
  </Routes></MemoryRouter></UiProvider>);

let alertSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api.projects, 'get').mockResolvedValue({ project } as never);
  vi.spyOn(api.enrollments, 'byProject').mockResolvedValue({ enrollments: [pending, approved] });
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Detalle del voluntariado de la ONG: la forma del panel', () => {
  test('el tipo va con mayúscula al lado de la categoría', async () => {
    mount();
    expect(await screen.findByText('Medio Ambiente · Fugaz')).toBeInTheDocument();
  });

  test('un tipo que no se conoce se muestra tal cual, sin romper', async () => {
    vi.spyOn(api.projects, 'get').mockResolvedValue({ project: { ...project, type: 'otro' } } as never);
    mount();
    expect(await screen.findByText('Medio Ambiente · otro')).toBeInTheDocument();
  });

  test('la doble meta: dinero y personas con su barra y su texto', async () => {
    mount();
    expect(await screen.findByText('$ 8.500')).toBeInTheDocument();
    expect(screen.getByText('de $ 20.000')).toBeInTheDocument();
    expect(screen.getByText('de 10 lugares')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Financiamiento' })).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('progressbar', { name: 'Voluntarios' })).toHaveAttribute('aria-valuenow', '20');
  });

  test('"Impacto" (antes "KPIs") lleva a los indicadores del voluntariado', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Impacto' }));
    expect(await screen.findByText('pantalla de impacto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /KPIs/ })).toBeNull();
  });

  test('cada inscripto va con su avatar: iniciales redondas si no tiene foto', async () => {
    const { container } = mount();
    await screen.findByText('Ana Gómez');
    const initials = [...container.querySelectorAll<HTMLElement>('[data-initial]')];
    expect(initials.map(el => el.textContent)).toEqual(['AG', 'BR']);
    expect(initials.every(el => el.style.borderRadius === '9999px')).toBe(true);
  });

  test('el botón de mensaje tiene nombre accesible, no solo `title`', async () => {
    mount();
    expect(await screen.findByRole('button', { name: 'Mensaje a Ana Gómez' })).toBeInTheDocument();
  });

  test('el filtro elegido se marca con aria-pressed', async () => {
    mount();
    const todos = await screen.findByRole('button', { name: 'Todos (2)' });
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    const pendientes = screen.getByRole('button', { name: 'Pendientes (1)' });
    expect(pendientes).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pendientes);
    expect(pendientes).toHaveAttribute('aria-pressed', 'true');
    expect(todos).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Beto Ruiz')).toBeNull();
  });
});

describe('Detalle del voluntariado de la ONG: los errores son avisos de la app, no alert()', () => {
  test('si aprobar falla, avisa con el mensaje del servidor', async () => {
    vi.spyOn(api.enrollments, 'updateStatus').mockRejectedValue(new Error('No quedan cupos'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Aprobar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No quedan cupos');
    expect(alertSpy).not.toHaveBeenCalled();
    // El botón vuelve a estar activo para reintentar.
    await waitFor(() => expect(screen.getByRole('button', { name: /Aprobar/ })).toBeEnabled());
  });

  test('sin conexión al rechazar: el aviso no muestra el error en inglés del navegador', async () => {
    vi.spyOn(api.enrollments, 'updateStatus').mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Rechazar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar tu decisión. Revisá tu conexión y probá de nuevo.');
  });

  test('mientras se guarda la decisión, "Aprobar" y "Rechazar" de esa fila quedan deshabilitados', async () => {
    vi.spyOn(api.enrollments, 'updateStatus').mockReturnValue(new Promise(() => {}));
    mount();
    const aprobar = await screen.findByRole('button', { name: /Aprobar/ });
    fireEvent.click(aprobar);
    await waitFor(() => expect(aprobar).toBeDisabled());
    expect(aprobar).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Rechazar/ })).toBeDisabled();
  });

  test('"Guardar" las horas está deshabilitado hasta que se escribe algo', async () => {
    mount();
    const horas = await screen.findByRole('spinbutton', { name: 'Horas de Beto Ruiz' });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(horas, { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  test('horas negativas: avisa y no manda nada', async () => {
    const log = vi.spyOn(api.enrollments, 'logHours').mockResolvedValue({} as never);
    mount();
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Horas de Beto Ruiz' }), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un número de horas válido');
    expect(log).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('si guardar las horas falla, avisa; si anda, manda el número', async () => {
    const log = vi.spyOn(api.enrollments, 'logHours').mockRejectedValueOnce(new Error('No autorizado')).mockResolvedValue({} as never);
    mount();
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Horas de Beto Ruiz' }), { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado');
    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(log).toHaveBeenCalledTimes(2));
    expect(log).toHaveBeenLastCalledWith('e2', 3.5);
  });
});
