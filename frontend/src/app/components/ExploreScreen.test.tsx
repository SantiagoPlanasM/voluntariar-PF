// src/app/components/ExploreScreen.test.tsx
//
// REVISION S1 (Explorar): si la carga de los proyectos fallaba, el error se tragaba y se veía el catálogo vacío
// ("No encontramos voluntariados con esos filtros"), como si no hubiera proyectos. Ahora se ve el error con
// "Reintentar". Las recomendaciones ("Para vos") son secundarias: si fallan, avisan en su sección y el
// catálogo se muestra igual.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 'u-vol', name: 'María', email: 'm@example.com', role: 'volunteer' } as Record<string, unknown> | null } }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ProjectMap', async () => {
  const actual = await vi.importActual<typeof import('./ProjectMap')>('./ProjectMap');
  return { ...actual, ProjectMap: ({ projects }: { projects: unknown[] }) => <div data-testid="mapa">{projects.length} pines</div> };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, projects: { ...actual.api.projects, list: vi.fn(), recommended: vi.fn() } } };
});

import { api, ApiError } from '../../lib/api';
import { ExploreScreen } from './ExploreScreen';

const project = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, ngo_id: 'ngo-1', title, description: '', category: 'Educación', location: 'Córdoba', type: 'fugaz',
  status: 'active', volunteers_needed: 5, current_volunteers: 0, funding_goal: 0, current_funding: 0,
  cost_per_person: 0, followers: 0, ngo_name: 'Sustentando', ...extra,
});
const fail500 = () => Promise.reject(new ApiError('Error al obtener proyectos', 500));
const mount = () => render(<MemoryRouter><ExploreScreen /></MemoryRouter>);

beforeEach(() => {
  auth.user = { id: 'u-vol', name: 'María', email: 'm@example.com', role: 'volunteer' };
  vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: [project('p1', 'Huerta comunitaria')] } as never);
  vi.mocked(api.projects.recommended).mockReset().mockResolvedValue({ recommendations: [], based_on_history: false } as never);
});

describe('ExploreScreen: error al cargar el catálogo', () => {
  test('se ve el error con "Reintentar", no el catálogo vacío; reintentar lo carga', async () => {
    vi.mocked(api.projects.list).mockReset()
      .mockImplementationOnce(fail500 as never)
      .mockResolvedValueOnce({ projects: [project('p1', 'Huerta comunitaria')] } as never);
    mount();
    await waitFor(() => expect(screen.getByText('Error al obtener proyectos')).toBeInTheDocument());
    expect(screen.queryByText(/No encontramos voluntariados/)).not.toBeInTheDocument();
    // El mapa vacío también diría "no hay nada": mientras haya error no se muestra.
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument());
    expect(screen.queryByText('Error al obtener proyectos')).not.toBeInTheDocument();
    expect(screen.getByTestId('mapa')).toHaveTextContent('1 pines');
  });

  test('sin red (TypeError de fetch): mensaje en español, no "Failed to fetch"', async () => {
    vi.mocked(api.projects.list).mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    await waitFor(() => expect(screen.getByText(/No pudimos cargar los voluntariados/)).toBeInTheDocument());
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  test('con una búsqueda escrita, el error no se acompaña de un contador "0" de encontrados', async () => {
    vi.mocked(api.projects.list).mockReset().mockImplementation(fail500 as never);
    mount();
    await waitFor(() => expect(screen.getByText('Error al obtener proyectos')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar voluntariados' }), { target: { value: 'huerta' } });
    const heading = screen.getByRole('heading', { name: /Proyectos encontrados/ });
    expect(heading.parentElement).not.toHaveTextContent('0');
    expect(screen.getByText('Error al obtener proyectos')).toBeInTheDocument();
  });

  test('sin sesión (no voluntario) también muestra el error', async () => {
    auth.user = null;
    vi.mocked(api.projects.list).mockReset().mockImplementation(fail500 as never);
    mount();
    await waitFor(() => expect(screen.getByText('Error al obtener proyectos')).toBeInTheDocument());
    expect(api.projects.recommended).not.toHaveBeenCalled();
  });
});

// REVISION S5: Explorar pedía `limit: 200` y con más proyectos los demás desaparecían sin aviso (de la lista,
// la búsqueda y el mapa). Ahora pide el tope del backend (500, §96) y, si la respuesta viene llena, lo dice.
describe('ExploreScreen: tope del catálogo', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => project(`p${i}`, `Proyecto ${i}`));
  const notice = /Se muestran los primeros 500 voluntariados/;

  test('pide hasta el tope del backend (500), no 200', async () => {
    mount();
    await waitFor(() => expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument());
    expect(api.projects.list).toHaveBeenCalledWith(expect.objectContaining({ limit: '500' }));
  });

  test('si la respuesta viene llena (500), avisa que puede haber más', async () => {
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: many(500) } as never);
    mount();
    await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument());
  });

  test('con menos que el tope no hay aviso', async () => {
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: many(499) } as never);
    mount();
    await waitFor(() => expect(screen.getByText('Proyecto 0')).toBeInTheDocument());
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });
});

describe('ExploreScreen: error al cargar las recomendaciones (secundario)', () => {
  test('el catálogo se muestra igual y "Para vos" avisa con su propio "Reintentar"', async () => {
    vi.mocked(api.projects.recommended).mockReset()
      .mockImplementationOnce((() => Promise.reject(new ApiError('Error al generar recomendaciones', 500))) as never)
      .mockResolvedValueOnce({ recommendations: [project('r1', 'Apoyo escolar')], based_on_history: true } as never);
    mount();
    await waitFor(() => expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument());
    const recs = screen.getByRole('region', { name: 'Para vos' });
    await waitFor(() => expect(within(recs).getByText('Error al generar recomendaciones')).toBeInTheDocument());
    fireEvent.click(within(recs).getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(within(recs).getByText('Apoyo escolar')).toBeInTheDocument());
    expect(within(recs).queryByText('Error al generar recomendaciones')).not.toBeInTheDocument();
    expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument();
  });
});

// §131: sin ningún proyecto (un deploy nuevo) y sin filtros, Explorar decía "No encontramos voluntariados con
// esos filtros" y ofrecía "Ver todos los proyectos", que no hacía nada. Ahora distingue los dos casos.
describe('ExploreScreen: catálogo vacío', () => {
  test('sin proyectos y sin filtros: "todavía no hay", sin hablar de filtros ni botón para limpiarlos', async () => {
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: [] } as never);
    mount();
    expect(await screen.findByText('Todavía no hay voluntariados publicados')).toBeInTheDocument();
    expect(screen.queryByText(/con esos filtros/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver todos los proyectos' })).not.toBeInTheDocument();
  });

  test('sin ningún proyecto, aunque haya una búsqueda escrita: "todavía no hay" (no culpa a los filtros)', async () => {
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: [] } as never);
    mount();
    await screen.findByText('Todavía no hay voluntariados publicados');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por título/), { target: { value: 'huerta' } });
    expect(await screen.findByText('Todavía no hay voluntariados publicados')).toBeInTheDocument();
    expect(screen.queryByText(/con esos filtros/)).not.toBeInTheDocument();
  });

  test('si todos los proyectos están en "Para vos", no dice que no hay ninguno', async () => {
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: [project('p1', 'Huerta comunitaria')] } as never);
    vi.mocked(api.projects.recommended).mockReset().mockResolvedValue({
      recommendations: [{ ...project('p1', 'Huerta comunitaria'), score: 9, reasons: ['Te puede gustar'] }], based_on_history: true,
    } as never);
    mount();
    await screen.findAllByText('Huerta comunitaria');
    await waitFor(() => expect(api.projects.recommended).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Todavía no hay voluntariados publicados')).not.toBeInTheDocument();
  });

  test('con una búsqueda que no encuentra nada: el mensaje de filtros y el botón para limpiarlos', async () => {
    mount();
    await screen.findByText('Huerta comunitaria');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por título/), { target: { value: 'xyz-no-existe' } });
    expect(await screen.findByText('No encontramos voluntariados con esos filtros')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay voluntariados publicados')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos los proyectos' }));
    expect(await screen.findByText('Huerta comunitaria')).toBeInTheDocument();
  });
});
