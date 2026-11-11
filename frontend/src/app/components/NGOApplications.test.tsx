// src/app/components/NGOApplications.test.tsx — la pantalla de postulaciones (/ngo/postulaciones y
// /equipo/:ngoId/postulaciones, §319).
// Criterio de aceptación (antes de escribir la pantalla):
//  - carga todas las de la ONG (la dueña sin ngo_id; el coordinador con el de la URL); arranca en "Pendientes";
//  - pestañas por estado con su cantidad; filtros por voluntariado (con sus cupos), entrevista, "solo con CV",
//    búsqueda y orden; sin resultados, lo dice y "Limpiar filtros" vuelve al principio;
//  - con muchas, muestra de a 50 con "Mostrar más" (y cuántas se ven de cuántas);
//  - elegir varias (o "todas las filtradas") abre la barra del lote; cambiar un filtro vacía la selección;
//  - "Aprobar N"/"Rechazar N" preguntan; confirmado, mandan las elegidas de la más vieja a la más nueva, en tandas de 500,
//    recargan y muestran el resumen ("12 aprobadas · 3 sin cupo…"); si falla, el mensaje y la selección sigue;
//  - cada pendiente se puede aprobar o rechazar sola (sin preguntar); "Ver CV" solo con CV; "Entrevista" lleva al detalle;
//  - error de carga: el mensaje y "Reintentar"; `truncated`: avisa que se ven las más nuevas.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, NgoEnrollment, NgoEnrollmentsPage } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';

vi.mock('../../lib/cv', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cv')>('../../lib/cv');
  return { ...actual, openCv: vi.fn() };
});
import { openCv } from '../../lib/cv';
import { NGOApplications } from './NGOApplications';

const app = (over: Partial<NgoEnrollment>): NgoEnrollment => ({
  id: 'e', user_id: 'u', project_id: 'p1', project_title: 'Huerta', status: 'pending', created_at: '2026-11-01 10:00:00',
  volunteer_name: 'Ana', volunteer_email: 'ana@x.com', interview: null, has_cv: false, phone: null, ...over,
} as NgoEnrollment);
const LIST = [
  app({ id: 'a', user_id: 'ua', volunteer_name: 'Ana Paz', created_at: '2026-11-03 10:00:00', has_cv: true, message: 'Tengo auto' }),
  app({ id: 'b', user_id: 'ub', volunteer_name: 'Bruno Díaz', created_at: '2026-11-01 10:00:00', project_id: 'p2', project_title: 'Comedor' }),
  app({ id: 'c', user_id: 'uc', volunteer_name: 'Carla Gómez', created_at: '2026-11-02 10:00:00', status: 'approved' }),
];
const page = (enrollments = LIST, extra: Partial<NgoEnrollmentsPage> = {}): NgoEnrollmentsPage => ({
  ngo: { id: 'ngo-1', name: 'Sustentando' },
  projects: [
    { id: 'p1', title: 'Huerta', status: 'active', volunteers_needed: 5, current_volunteers: 3 },
    { id: 'p2', title: 'Comedor', status: 'active', volunteers_needed: 2, current_volunteers: 0 },
  ],
  enrollments, truncated: false, ...extra,
});
const zero = { applied: 0, unchanged: 0, full: 0, stale: 0, not_found: 0 };
const loads = (p = page()) => vi.spyOn(api.enrollments, 'manage').mockResolvedValue(p);
const mount = (path = '/ngo/postulaciones') => render(
  <MemoryRouter initialEntries={[path]}><UiProvider><Routes>
    <Route path="/ngo/postulaciones" element={<NGOApplications />} />
    <Route path="/equipo/:ngoId/postulaciones" element={<NGOApplications team />} />
  </Routes></UiProvider></MemoryRouter>);
const rows = () => screen.queryAllByRole('article').map((a) => a.getAttribute('aria-label'));
const loaded = () => screen.findByRole('heading', { name: 'Postulaciones' }).then(() => waitFor(() => expect(screen.queryByLabelText('Cargando')).not.toBeInTheDocument()));
const tab = (name: RegExp) => screen.getByRole('tab', { name });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openCv).mockReset().mockResolvedValue(undefined);
});

describe('<NGOApplications />: carga y filtros', () => {
  test('la dueña: carga sin ngo_id, arranca en "Pendientes" y las pestañas dicen cuántas hay', async () => {
    const manage = loads();
    mount();
    await loaded();
    expect(manage).toHaveBeenCalledWith(undefined);
    expect(tab(/Pendientes/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Pendientes/)).toHaveTextContent('2');
    expect(tab(/Aprobadas/)).toHaveTextContent('1');
    expect(tab(/Rechazadas/)).toHaveTextContent('0');
    expect(tab(/Todas/)).toHaveTextContent('3');
    expect(rows()).toEqual(['Ana Paz', 'Bruno Díaz']);
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/ngo/dashboard');
  });

  // §322 (visto en Chrome): las pestañas bajan 1 px (-mb-px, para pisar la línea de abajo) dentro de un contenedor con
  // overflow-x-auto, que también corta en vertical: ese píxel de más dibujaba una barra de scroll con flechas.
  test('las pestañas solo hacen scroll de costado: sin barra vertical por el píxel que pisa la línea', async () => {
    loads();
    mount();
    await loaded();
    const list = screen.getByRole('tablist', { name: 'Estado' });
    expect(list.className).toContain('overflow-x-auto');
    expect(list.className).toContain('overflow-y-hidden');
  });

  test('el coordinador: carga con el ngo_id de la URL y "Volver" va a su panel', async () => {
    const manage = loads();
    mount('/equipo/ngo-1/postulaciones');
    await loaded();
    expect(manage).toHaveBeenCalledWith('ngo-1');
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/equipo/ngo-1');
  });

  test('cada fila: voluntariado, mensaje, link al perfil; "Ver CV" solo con CV; "Entrevista" al detalle', async () => {
    loads();
    mount();
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana Paz' });
    expect(ana).toHaveTextContent('Huerta');
    expect(ana).toHaveTextContent('Tengo auto');
    expect(within(ana).getByRole('link', { name: 'Ana Paz' })).toHaveAttribute('href', '/volunteer/ua');
    fireEvent.click(within(ana).getByRole('button', { name: 'Ver CV de Ana Paz' }));
    await waitFor(() => expect(openCv).toHaveBeenCalledWith('ua'));
    expect(within(ana).getByRole('link', { name: 'Entrevista con Ana Paz' })).toHaveAttribute('href', '/ngo/dashboard/project/p1?postulacion=a');
    expect(within(screen.getByRole('article', { name: 'Bruno Díaz' })).queryByRole('button', { name: /Ver CV/ })).not.toBeInTheDocument();
  });

  test('desde el equipo, "Entrevista" va al detalle del equipo', async () => {
    loads();
    mount('/equipo/ngo-1/postulaciones');
    await loaded();
    expect(within(screen.getByRole('article', { name: 'Ana Paz' })).getByRole('link', { name: 'Entrevista con Ana Paz' }))
      .toHaveAttribute('href', '/equipo/ngo-1/project/p1?postulacion=a');
  });

  test('el voluntariado se elige con sus cupos y las pestañas cuentan dentro de él', async () => {
    loads();
    mount();
    await loaded();
    const select = screen.getByLabelText('Voluntariado') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Todos', 'Huerta (3/5 cupos)', 'Comedor (0/2 cupos)']);
    fireEvent.change(select, { target: { value: 'p2' } });
    expect(rows()).toEqual(['Bruno Díaz']);
    expect(tab(/Pendientes/)).toHaveTextContent('1');
    expect(tab(/Todas/)).toHaveTextContent('1');
  });

  test('pestaña, búsqueda, "solo con CV", entrevista y orden', async () => {
    loads();
    mount();
    await loaded();
    fireEvent.click(tab(/Todas/));
    expect(rows()).toEqual(['Ana Paz', 'Carla Gómez', 'Bruno Díaz']);
    fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: 'oldest' } });
    expect(rows()).toEqual(['Bruno Díaz', 'Carla Gómez', 'Ana Paz']);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'gomez' } });
    expect(rows()).toEqual(['Carla Gómez']);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Solo con CV'));
    expect(rows()).toEqual(['Ana Paz']);
    fireEvent.click(screen.getByLabelText('Solo con CV'));
    fireEvent.change(screen.getByLabelText('Entrevista'), { target: { value: 'scheduled' } });
    expect(rows()).toEqual([]);
  });

  test('sin resultados: lo dice, y "Limpiar filtros" vuelve a Pendientes sin filtros', async () => {
    loads();
    mount();
    await loaded();
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'nadie' } });
    expect(screen.getByText('Ninguna postulación con estos filtros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
    expect(rows()).toEqual(['Ana Paz', 'Bruno Díaz']);
  });

  test('muchas: de a 50, con "Mostrar más" y cuántas se ven', async () => {
    // 60 alcanzan (con 120, bajo cobertura pasaba los 5 s de vitest).
    const many = Array.from({ length: 60 }, (_, i) => app({ id: `m${i}`, volunteer_name: `Persona ${i}`,
      created_at: `2026-10-01 10:00:${String(i).padStart(2, '0')}` }));
    loads(page(many));
    mount();
    await loaded();
    expect(rows()).toHaveLength(50);
    expect(screen.getByText('Mostrando 50 de 60')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar más' }));
    expect(rows()).toHaveLength(60);
    expect(screen.getByText('60 postulaciones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar más' })).not.toBeInTheDocument();
  });

  test('truncated: avisa que se ven las más nuevas', async () => {
    loads(page(LIST, { truncated: true }));
    mount();
    await loaded();
    expect(screen.getByText(/Se muestran las 2000 postulaciones más nuevas/)).toBeInTheDocument();
  });

  test('error de carga: el mensaje y "Reintentar"', async () => {
    const manage = vi.spyOn(api.enrollments, 'manage')
      .mockRejectedValueOnce(new ApiError('Sin permiso sobre las postulaciones de esta ONG', 403))
      .mockResolvedValueOnce(page());
    mount();
    expect(await screen.findByText('Sin permiso sobre las postulaciones de esta ONG')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(rows()).toEqual(['Ana Paz', 'Bruno Díaz']));
    expect(manage).toHaveBeenCalledTimes(2);
  });
});

describe('<NGOApplications />: decidir', () => {
  test('elegir varias abre la barra; "todas las filtradas" y "Quitar selección"; cambiar el filtro la vacía', async () => {
    loads();
    mount();
    await loaded();
    expect(screen.queryByRole('region', { name: 'Elegidas' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir a Ana Paz' }));
    const bar = screen.getByRole('region', { name: 'Elegidas' });
    expect(bar).toHaveTextContent('1 elegida');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir las 2 que se ven con estos filtros' }));
    expect(bar).toHaveTextContent('2 elegidas');
    fireEvent.click(within(bar).getByRole('button', { name: 'Quitar selección' }));
    expect(screen.queryByRole('region', { name: 'Elegidas' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir a Ana Paz' }));
    fireEvent.click(tab(/Todas/));
    expect(screen.queryByRole('region', { name: 'Elegidas' })).not.toBeInTheDocument();
  });

  test('"Aprobar 2" pregunta; confirmado, manda de la más vieja a la más nueva, recarga y muestra el resumen', async () => {
    const manage = loads();
    const bulk = vi.spyOn(api.enrollments, 'bulk').mockResolvedValue({
      results: [{ id: 'b', outcome: 'applied' }, { id: 'a', outcome: 'full' }], summary: { ...zero, applied: 1, full: 1 } });
    mount();
    await loaded();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir a Ana Paz' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir a Bruno Díaz' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Elegidas' })).getByRole('button', { name: 'Aprobar 2' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Aprobar 2 postulaciones?');
    expect(dialog).toHaveTextContent(/por orden de llegada/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(bulk).toHaveBeenCalledWith(['b', 'a'], 'approved'));
    expect(await screen.findByRole('status')).toHaveTextContent('1 aprobada · 1 sin cupo (sigue pendiente)');
    expect(manage).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('region', { name: 'Elegidas' })).not.toBeInTheDocument();
  });

  test('"Rechazar" pregunta; "Volver" no manda nada', async () => {
    loads();
    const bulk = vi.spyOn(api.enrollments, 'bulk');
    mount();
    await loaded();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir a Ana Paz' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Elegidas' })).getByRole('button', { name: 'Rechazar 1' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Rechazar 1 postulación?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bulk).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Elegidas' })).toBeInTheDocument();
  });

  test('más de 500 elegidas: van en tandas y los resúmenes se suman', async () => {
    const many = Array.from({ length: 501 }, (_, i) => app({ id: `m${i}`, volunteer_name: `P${i}`,
      created_at: `2026-10-${String(1 + Math.floor(i / 60)).padStart(2, '0')} 10:00:${String(i % 60).padStart(2, '0')}` }));
    loads(page(many));
    const bulk = vi.spyOn(api.enrollments, 'bulk')
      .mockResolvedValueOnce({ results: [], summary: { ...zero, applied: 500 } })
      .mockResolvedValueOnce({ results: [], summary: { ...zero, rejected: 0, applied: 1 } as never });
    mount();
    await loaded();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir las 501 que se ven con estos filtros' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Elegidas' })).getByRole('button', { name: 'Rechazar 501' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(bulk).toHaveBeenCalledTimes(2));
    expect(bulk.mock.calls[0][0]).toHaveLength(500);
    expect(bulk.mock.calls[1][0]).toHaveLength(1);
    expect(bulk.mock.calls[0][0][0]).toBe('m0');   // la más vieja primero
    expect(await screen.findByRole('status')).toHaveTextContent('501 rechazadas');
  });

  test('si el lote falla: el mensaje y la selección sigue', async () => {
    loads();
    vi.spyOn(api.enrollments, 'bulk').mockRejectedValue(new ApiError('Error al actualizar las postulaciones', 500));
    mount();
    await loaded();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir a Ana Paz' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Elegidas' })).getByRole('button', { name: 'Aprobar 1' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al actualizar las postulaciones');
    expect(screen.getByRole('region', { name: 'Elegidas' })).toHaveTextContent('1 elegida');
  });

  test('una sola: "Aprobar" y "Rechazar" en la fila, sin preguntar', async () => {
    const manage = loads();
    const bulk = vi.spyOn(api.enrollments, 'bulk').mockResolvedValue({ results: [{ id: 'a', outcome: 'full' }], summary: { ...zero, full: 1 } });
    mount();
    await loaded();
    const ana = screen.getByRole('article', { name: 'Ana Paz' });
    fireEvent.click(within(ana).getByRole('button', { name: 'Aprobar a Ana Paz' }));
    await waitFor(() => expect(bulk).toHaveBeenCalledWith(['a'], 'approved'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('1 sin cupo (sigue pendiente)');
    expect(manage).toHaveBeenCalledTimes(2);
    fireEvent.click(within(screen.getByRole('article', { name: 'Bruno Díaz' })).getByRole('button', { name: 'Rechazar a Bruno Díaz' }));
    await waitFor(() => expect(bulk).toHaveBeenLastCalledWith(['b'], 'rejected'));
  });

  test('si la recarga después de decidir falla: la lista y el resumen siguen (no se tapa con el error)', async () => {
    vi.spyOn(api.enrollments, 'manage').mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error('red'));
    vi.spyOn(api.enrollments, 'bulk').mockResolvedValue({ results: [{ id: 'a', outcome: 'applied' }], summary: { ...zero, applied: 1 } });
    mount();
    await loaded();
    fireEvent.click(within(screen.getByRole('article', { name: 'Ana Paz' })).getByRole('button', { name: 'Aprobar a Ana Paz' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 aprobada');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(rows()).toEqual(['Ana Paz', 'Bruno Díaz']);
  });

  test('las aprobadas no tienen "Aprobar" en la fila; sí "Rechazar"', async () => {
    loads();
    mount();
    await loaded();
    fireEvent.click(tab(/Aprobadas/));
    const carla = screen.getByRole('article', { name: 'Carla Gómez' });
    expect(within(carla).queryByRole('button', { name: /Aprobar a/ })).not.toBeInTheDocument();
    expect(within(carla).getByRole('button', { name: 'Rechazar a Carla Gómez' })).toBeInTheDocument();
  });
});
