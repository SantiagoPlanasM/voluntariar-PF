// src/app/components/ExploreScreen.test.tsx
//
// REVISION S1 (Explorar): si la carga de los proyectos fallaba, el error se tragaba y se veía el catálogo vacío
// ("No encontramos voluntariados con esos filtros"), como si no hubiera proyectos. Ahora se ve el error con
// "Reintentar". Las recomendaciones ("Para vos") son secundarias: si fallan, avisan en su sección y el
// catálogo se muestra igual.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
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
const buscador = () => screen.getByRole('searchbox', { name: 'Buscar voluntariados' });

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
    // Rediseño: el mapa se abre con el botón flotante "Mapa" (y "Lista" vuelve).
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('mapa')).toHaveTextContent('1 pines');
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument();
  });

  test('mientras hay error no está el botón del mapa', async () => {
    vi.mocked(api.projects.list).mockReset().mockImplementation(fail500 as never);
    mount();
    await screen.findByText('Error al obtener proyectos');
    expect(screen.queryByRole('button', { name: 'Mapa' })).not.toBeInTheDocument();
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
    fireEvent.change(buscador(), { target: { value: 'huerta' } });
    // Rediseño: con error no se dibuja la sección de resultados (ni su contador).
    expect(screen.queryByRole('heading', { name: 'Resultados' })).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
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
  // Dibujan ~500 tarjetas en jsdom: 0,7 s solos, pero más de 5 s con la suite entera en paralelo (§258).
  const LENTO = { timeout: 20_000 };

  test('pide hasta el tope del backend (500), no 200', async () => {
    mount();
    await waitFor(() => expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument());
    expect(api.projects.list).toHaveBeenCalledWith(expect.objectContaining({ limit: '500' }));
  });

  test('si la respuesta viene llena (500), avisa que puede haber más', LENTO, async () => {
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: many(500) } as never);
    mount();
    await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument());
  });

  test('con menos que el tope no hay aviso', LENTO, async () => {
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
    fireEvent.change(buscador(), { target: { value: 'huerta' } });
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
    fireEvent.change(buscador(), { target: { value: 'xyz-no-existe' } });
    expect(await screen.findByText('No encontramos voluntariados con esos filtros')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay voluntariados publicados')).not.toBeInTheDocument();
    // "Limpiar filtros" está arriba (junto a las pastillas) y en el mensaje vacío: los dos limpian todo.
    const limpiar = screen.getAllByRole('button', { name: 'Limpiar filtros' });
    expect(limpiar).toHaveLength(2);
    fireEvent.click(limpiar[1]);
    expect(await screen.findByText('Huerta comunitaria')).toBeInTheDocument();
  });
});

// D22 (Issue #23, sesión exploratoria §245): "Para vos" muestra hasta 6 recomendaciones, pero la lista general sacaba
// las 8 que devuelve la API: con los datos de prueba, 2 voluntariados no aparecían en ningún lado sin filtros.
// Criterio: sin búsqueda ni filtros, cada voluntariado del catálogo aparece exactamente una vez.
describe('ExploreScreen: más recomendaciones de las que entran en "Para vos"', () => {
  test('con 8 recomendaciones y 12 voluntariados, se ven los 12 y ninguno repetido', async () => {
    // Arrange: 12 en el catálogo; la API recomienda 8 (Para vos muestra 6)
    const catalogo = Array.from({ length: 12 }, (_, i) => project(`p${i}`, `Voluntariado ${i}`));
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: catalogo } as never);
    vi.mocked(api.projects.recommended).mockReset().mockResolvedValue({
      recommendations: catalogo.slice(0, 8).map(p => ({ ...p, score: 5, recommendation_reasons: ['Te puede gustar'] })),
      based_on_history: true,
    } as never);

    // Act
    mount();
    await screen.findByRole('region', { name: 'Para vos' });
    await screen.findAllByText('Te puede gustar');

    // Assert: "Para vos" sigue mostrando 6, y cada voluntariado está una sola vez en la pantalla
    expect(within(screen.getByRole('region', { name: 'Para vos' })).getAllByText('Te puede gustar')).toHaveLength(6);
    for (const p of catalogo) expect(screen.getAllByText(p.title)).toHaveLength(1);
  });
});

// §203 (SonarCloud S6848): las tarjetas de Explorar eran <div onClick={navigate}>: con el teclado no se podían enfocar
// ni abrir. Criterio: cada tarjeta (catálogo, destacados y "Para vos", en móvil y escritorio) es un LINK a su
// proyecto, así que se enfoca con Tab y se abre con Enter (y también se puede abrir en otra pestaña).
describe('ExploreScreen: las tarjetas de proyecto son links (teclado)', () => {
  test('catálogo y recomendaciones: cada tarjeta es un link a /project/:id', async () => {
    // Arrange: un proyecto en el catálogo y otro en "Para vos"
    vi.mocked(api.projects.recommended).mockResolvedValue({
      recommendations: [project('p2', 'Taller de lectura')], based_on_history: true,
    } as never);
    // Act
    mount();
    await screen.findAllByText('Taller de lectura');
    await screen.findAllByText('Huerta comunitaria');
    // Assert
    const catalogo = screen.getAllByRole('link', { name: /Huerta comunitaria/ });
    const paraVos = screen.getAllByRole('link', { name: /Taller de lectura/ });
    expect(catalogo.length).toBeGreaterThan(0);
    expect(paraVos.length).toBeGreaterThan(0);
    for (const a of catalogo) expect(a).toHaveAttribute('href', '/project/p1');
    for (const a of paraVos) expect(a).toHaveAttribute('href', '/project/p2');
  });
});

// TP de Calidad, cobertura del frontend (§210); actualizado en el rediseño (§240): ya no hay carruseles ni
// "Ver todos" (la grilla muestra todo) y el botón de filtros se llama "Filtros". Criterio de aceptación:
//  - la cruz del buscador lo vacía;
//  - los filtros se aplican desde el modal: cada filtro activo es una pastilla con su cruz, el botón dice cuántos
//    hay, "Para vos" se esconde mientras haya filtros y la lista muestra solo lo que pasa el filtro;
//  - cada cruz quita solo su filtro; "Limpiar filtros" (arriba o en el modal) los quita todos;
//  - los chips de categoría filtran y "Todos" los quita;
//  - "Para vos" muestra hasta 6 recomendaciones, con la razón de cada una.
describe('ExploreScreen: búsqueda y filtros', () => {
  const catalogo = () => [
    project('p1', 'Huerta comunitaria', { category: 'Educación', type: 'sostenido', modality: 'remoto' }),
    project('p2', 'Colecta de ropa', { category: 'Ambiente', type: 'fugaz', modality: 'presencial', cost_per_person: 500 }),
  ];
  const filtros = () => screen.getByRole('button', { name: /^Filtros/ });
  const pastilla = (name: string) => screen.getByRole('button', { name });
  const aplicarTodos = async () => {
    fireEvent.click(filtros());
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^Educación/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /Sostenido/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /Remoto/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /100% Gratis/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /Mostrar 1 voluntariados/ }));
  };

  beforeEach(() => {
    vi.mocked(api.projects.list).mockResolvedValue({ projects: catalogo() } as never);
    vi.mocked(api.projects.recommended).mockResolvedValue({ recommendations: [project('r1', 'Apoyo escolar')], based_on_history: true } as never);
  });

  test('la cruz del buscador lo vacía', async () => {
    mount();
    await screen.findByText('Huerta comunitaria');
    const input = buscador();
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'huerta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(input).toHaveValue('');
  });

  test('aplicar desde el modal: una pastilla por filtro, el contador, sin "Para vos" y solo lo filtrado', async () => {
    // Arrange
    mount();
    await screen.findByText('Colecta de ropa');
    expect(await screen.findByRole('region', { name: 'Para vos' })).toBeInTheDocument();
    expect(filtros()).toHaveAccessibleName('Filtros');
    // Act
    await aplicarTodos();
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(pastilla('Quitar filtro Educación')).toHaveTextContent('Educación');
    expect(pastilla('Quitar filtro de tipo')).toHaveTextContent('Sostenido');
    expect(pastilla('Quitar filtro de modalidad')).toHaveTextContent('Remoto');
    expect(pastilla('Quitar filtro de costo')).toHaveTextContent('Gratis');
    expect(filtros()).toHaveAccessibleName('Filtros, 4 activos');
    expect(filtros()).toHaveTextContent('4');
    expect(screen.queryByRole('region', { name: 'Para vos' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.queryByText('Colecta de ropa')).not.toBeInTheDocument();
    expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument();
  });

  // §283: carga horaria desde el modal: su pastilla, el contador y solo lo que entra (los fugaces siempre).
  test('carga horaria: "Hasta 2 h por semana" deja los de hasta 2 h y los fugaces, con su pastilla', async () => {
    vi.mocked(api.projects.list).mockResolvedValue({ projects: [
      project('h2', 'Apoyo escolar', { type: 'sostenido', hours_per_week: 2 }),
      project('h6', 'Tutorías intensivas', { type: 'sostenido', hours_per_week: 6 }),
      project('f1', 'Colecta de abrigo', { type: 'fugaz' }),
    ] } as never);
    mount();
    await screen.findByText('Tutorías intensivas');
    fireEvent.click(filtros());
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /Hasta 2 h por semana/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /^Mostrar/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(pastilla('Quitar filtro de carga horaria')).toHaveTextContent('Hasta 2 h/semana');
    expect(filtros()).toHaveAccessibleName('Filtros, 1 activos');
    expect(screen.getByText('Apoyo escolar')).toBeInTheDocument();
    expect(screen.getByText('Colecta de abrigo')).toBeInTheDocument();
    expect(screen.queryByText('Tutorías intensivas')).not.toBeInTheDocument();
    fireEvent.click(pastilla('Quitar filtro de carga horaria'));
    expect(screen.getByText('Tutorías intensivas')).toBeInTheDocument();
    expect(filtros()).toHaveAccessibleName('Filtros');
  });

  test('cada cruz quita solo su filtro, y sin filtros vuelve "Para vos"', async () => {
    mount();
    await screen.findByText('Colecta de ropa');
    await aplicarTodos();
    await screen.findByRole('button', { name: 'Quitar filtro Educación' });
    fireEvent.click(pastilla('Quitar filtro Educación'));
    expect(screen.queryByRole('button', { name: 'Quitar filtro Educación' })).not.toBeInTheDocument();
    expect(filtros()).toHaveAccessibleName('Filtros, 3 activos');
    fireEvent.click(pastilla('Quitar filtro de tipo'));
    expect(screen.queryByRole('button', { name: 'Quitar filtro de tipo' })).not.toBeInTheDocument();
    fireEvent.click(pastilla('Quitar filtro de modalidad'));
    expect(screen.queryByRole('button', { name: 'Quitar filtro de modalidad' })).not.toBeInTheDocument();
    expect(pastilla('Quitar filtro de costo')).toBeInTheDocument();
    fireEvent.click(pastilla('Quitar filtro de costo'));
    expect(screen.queryByRole('button', { name: 'Quitar filtro de costo' })).not.toBeInTheDocument();
    expect(filtros()).toHaveAccessibleName('Filtros');
    expect(screen.getByRole('region', { name: 'Para vos' })).toBeInTheDocument();
    expect(screen.getByText('Colecta de ropa')).toBeInTheDocument();
  });

  test('"Limpiar filtros" quita los filtros y la búsqueda', async () => {
    mount();
    await screen.findByText('Colecta de ropa');
    await aplicarTodos();
    fireEvent.change(buscador(), { target: { value: 'huerta' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.queryByRole('button', { name: /Quitar filtro/ })).not.toBeInTheDocument();
    expect(buscador()).toHaveValue('');
  });

  test('el modal: la cruz lo cierra sin aplicar y "Limpiar filtros" quita los aplicados', async () => {
    mount();
    await screen.findByText('Colecta de ropa');
    fireEvent.click(filtros());
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /Sostenido/ }));
    fireEvent.click(within(modal).getByTitle('Cerrar (Esc)'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Quitar filtro de tipo' })).not.toBeInTheDocument();
    // Con un filtro aplicado, "Limpiar filtros" del modal lo quita
    await aplicarTodos();
    await screen.findByRole('button', { name: 'Quitar filtro de tipo' });
    fireEvent.click(filtros());
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Limpiar filtros/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Quitar filtro/ })).not.toBeInTheDocument());
  });

  test('los chips de categoría filtran (de a varias) y "Todos" vuelve a mostrar todo', async () => {
    auth.user = null;
    mount();
    await screen.findByText('Colecta de ropa');
    const chips = screen.getByRole('group', { name: 'Categorías' });
    expect(within(chips).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(chips).getByRole('button', { name: 'Ambiente' }));
    expect(within(chips).getByRole('button', { name: 'Ambiente' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Huerta comunitaria')).not.toBeInTheDocument();
    fireEvent.click(within(chips).getByRole('button', { name: 'Educación' }));
    expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument();
    fireEvent.click(within(chips).getByRole('button', { name: 'Educación' }));   // un segundo toque la saca
    expect(screen.queryByText('Huerta comunitaria')).not.toBeInTheDocument();
    fireEvent.click(within(chips).getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('Huerta comunitaria')).toBeInTheDocument();
    expect(screen.getByText('Colecta de ropa')).toBeInTheDocument();
  });
});

describe('ExploreScreen: "Para vos" y la carga', () => {
  test('"Para vos" muestra hasta 6, con la razón de cada una, y no se repiten en el catálogo', async () => {
    vi.mocked(api.projects.list).mockResolvedValue({ projects: [project('r1', 'Apoyo escolar'), project('p1', 'Huerta comunitaria')] } as never);
    vi.mocked(api.projects.recommended).mockResolvedValue({
      recommendations: [
        { ...project('r1', 'Apoyo escolar'), recommendation_reasons: ['Cerca tuyo', 'Otra razón'] },
        ...['r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map((id) => project(id, 'Rec ' + id)),
      ],
      based_on_history: true,
    } as never);
    mount();
    const recs = await screen.findByRole('region', { name: 'Para vos' });
    await within(recs).findByText('Apoyo escolar');
    expect(within(recs).getByText('Cerca tuyo')).toBeInTheDocument();
    expect(within(recs).queryByText('Otra razón')).not.toBeInTheDocument();
    expect(within(recs).getByText('Rec r6')).toBeInTheDocument();
    expect(within(recs).queryByText('Rec r7')).not.toBeInTheDocument();
    const todos = screen.getByRole('region', { name: 'Todos los voluntariados' });
    expect(within(todos).queryByText('Apoyo escolar')).not.toBeInTheDocument();
    expect(within(todos).getByText('Huerta comunitaria')).toBeInTheDocument();
  });

  test('mientras carga el catálogo hay un esqueleto y no el botón del mapa', async () => {
    vi.mocked(api.projects.list).mockReset().mockReturnValue(new Promise(() => {}) as never);
    mount();
    expect(screen.getByRole('status', { name: 'Cargando voluntariados' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mapa' })).not.toBeInTheDocument();
  });

  test('mientras cargan las recomendaciones, "Para vos" muestra su propio esqueleto', async () => {
    vi.mocked(api.projects.recommended).mockReset().mockReturnValue(new Promise(() => {}) as never);
    mount();
    await screen.findByText('Huerta comunitaria');
    const recs = screen.getByRole('region', { name: 'Para vos' });
    expect(within(recs).getByRole('status', { name: 'Cargando recomendaciones' })).toBeInTheDocument();
  });
});
