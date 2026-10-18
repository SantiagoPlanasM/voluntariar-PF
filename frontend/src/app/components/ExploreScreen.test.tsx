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

// TP de Calidad, cobertura del frontend (§210). Criterio de aceptación (escrito antes de los casos):
//  - la cruz del buscador lo vacía;
//  - los filtros se aplican desde el modal: cada filtro activo es una pastilla con su cruz, el botón muestra cuántos
//    hay, "Para vos" se esconde mientras haya filtros y la lista muestra solo lo que pasa el filtro;
//  - cada cruz quita solo su filtro; "Limpiar todo" y "Limpiar filtros" (en el modal) los quitan todos;
//  - "Ver todos" de "Para vos" despliega la lista con hasta 3 etiquetas; "Ver todos" del catálogo cambia a la lista;
//  - las flechas del carrusel desplazan (mínimo 260 px) solo cuando hay para dónde.
describe('ExploreScreen: búsqueda y filtros', () => {
  const catalogo = () => [
    project('p1', 'Huerta comunitaria', { category: 'Educación', type: 'sostenido', modality: 'remoto' }),
    project('p2', 'Colecta de ropa', { category: 'Ambiente', type: 'fugaz', modality: 'presencial', cost_per_person: 500 }),
  ];
  const aplicarTodos = async () => {
    fireEvent.click(screen.getByTitle('Abrir filtros de búsqueda'));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^Educación/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /Sostenido/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /Remoto/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /100% Gratis/ }));
    fireEvent.click(within(modal).getByRole('button', { name: /Mostrar 1 voluntariados/ }));
  };

  beforeEach(() => {
    vi.mocked(api.projects.list).mockResolvedValue({ projects: catalogo() } as never);
  });

  test('la cruz del buscador lo vacía', async () => {
    mount();
    await screen.findByText('Huerta comunitaria');
    const input = screen.getByRole('textbox', { name: 'Buscar voluntariados' });
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'huerta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(input).toHaveValue('');
  });

  test('aplicar desde el modal: una pastilla por filtro, el contador, sin "Para vos" y solo lo filtrado', async () => {
    // Arrange
    mount();
    await screen.findByText('Colecta de ropa');
    expect(screen.getByRole('region', { name: 'Para vos' })).toBeInTheDocument();
    // Act
    await aplicarTodos();
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    for (const t of ['Quitar filtro Educación', 'Quitar filtro de tipo', 'Quitar filtro de modalidad', 'Quitar filtro de costo']) {
      expect(screen.getByTitle(t)).toBeInTheDocument();
    }
    expect(screen.getByTitle('Abrir filtros de búsqueda')).toHaveTextContent('4');
    expect(screen.getByText('Sostenido')).toBeInTheDocument();
    expect(screen.getByText('Remoto')).toBeInTheDocument();
    expect(screen.getByText('Gratis')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Para vos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Colecta de ropa')).not.toBeInTheDocument();
    expect(screen.getAllByText('Huerta comunitaria').length).toBeGreaterThan(0);
  });

  test('cada cruz quita solo su filtro, y sin filtros vuelve "Para vos"', async () => {
    mount();
    await screen.findByText('Colecta de ropa');
    await aplicarTodos();
    await screen.findByTitle('Quitar filtro Educación');
    fireEvent.click(screen.getByTitle('Quitar filtro Educación'));
    expect(screen.queryByTitle('Quitar filtro Educación')).not.toBeInTheDocument();
    expect(screen.getByTitle('Abrir filtros de búsqueda')).toHaveTextContent('3');
    fireEvent.click(screen.getByTitle('Quitar filtro de tipo'));
    expect(screen.queryByTitle('Quitar filtro de tipo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Quitar filtro de modalidad'));
    expect(screen.queryByTitle('Quitar filtro de modalidad')).not.toBeInTheDocument();
    expect(screen.getByTitle('Quitar filtro de costo')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Quitar filtro de costo'));
    expect(screen.queryByTitle('Quitar filtro de costo')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Para vos' })).toBeInTheDocument();
    expect(screen.getAllByText('Colecta de ropa').length).toBeGreaterThan(0);
  });

  test('"Limpiar todo" quita los filtros y la búsqueda', async () => {
    mount();
    await screen.findByText('Colecta de ropa');
    await aplicarTodos();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar voluntariados' }), { target: { value: 'huerta' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Limpiar todo' }));
    expect(screen.queryByTitle(/Quitar filtro/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Buscar voluntariados' })).toHaveValue('');
  });

  test('el modal: la cruz lo cierra sin aplicar y "Limpiar filtros" quita los aplicados', async () => {
    mount();
    await screen.findByText('Colecta de ropa');
    fireEvent.click(screen.getByTitle('Abrir filtros de búsqueda'));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /Sostenido/ }));
    fireEvent.click(within(modal).getByTitle('Cerrar (Esc)'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByTitle('Quitar filtro de tipo')).not.toBeInTheDocument();
    // Con un filtro aplicado, "Limpiar filtros" del modal lo quita
    await aplicarTodos();
    await screen.findByTitle('Quitar filtro de tipo');
    fireEvent.click(screen.getByTitle('Abrir filtros de búsqueda'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Limpiar filtros/ }));
    await waitFor(() => expect(screen.queryByTitle(/Quitar filtro/)).not.toBeInTheDocument());
  });
});

describe('ExploreScreen: "Para vos" y el catálogo desplegados', () => {
  test('con más de 4, "Ver todos" de "Para vos" despliega la lista con hasta 3 etiquetas y vuelve con "Ver menos"', async () => {
    vi.mocked(api.projects.recommended).mockResolvedValue({
      recommendations: [
        { ...project('r1', 'Apoyo escolar'), recommendation_tags: ['Educación', 'Cerca', 'Tercera', 'Cuarta'] },
        ...['r2', 'r3', 'r4', 'r5'].map((id) => project(id, 'Rec ' + id)),
      ],
      based_on_history: true,
    } as never);
    mount();
    const recs = screen.getByRole('region', { name: 'Para vos' });
    await within(recs).findAllByText('Apoyo escolar');
    expect(within(recs).queryByText('Tercera')).not.toBeInTheDocument();   // el carrusel muestra 2
    fireEvent.click(within(recs).getByRole('button', { name: /Ver todos/ }));
    expect(within(recs).getByText('Cerca')).toBeInTheDocument();
    expect(within(recs).getByText('Tercera')).toBeInTheDocument();
    expect(within(recs).queryByText('Cuarta')).not.toBeInTheDocument();
    fireEvent.click(within(recs).getByRole('button', { name: /Ver menos/ }));
    expect(within(recs).getByRole('button', { name: /Ver todos/ })).toBeInTheDocument();
  });

  test('"Ver todos" del catálogo pasa a la lista y "Ver carrusel" vuelve', async () => {
    auth.user = null;
    mount();
    await screen.findByText('Huerta comunitaria');
    fireEvent.click(screen.getByRole('button', { name: /Ver todos/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ver carrusel/ }));
    expect(screen.getByRole('button', { name: /Ver todos/ })).toBeInTheDocument();
  });
});

describe('ExploreScreen: flechas de los carruseles', () => {
  const props = ['scrollWidth', 'clientWidth', 'scrollLeft'] as const;
  const originales = props.map((p) => [p, Object.getOwnPropertyDescriptor(Element.prototype, p)] as const);
  const scrollBy = vi.fn();
  beforeEach(() => {
    scrollBy.mockReset();
    // jsdom no tiene layout (todo mide 0): se simula un carrusel de 1000 px visto en 300 px, al principio
    Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    Object.defineProperty(Element.prototype, 'scrollLeft', { configurable: true, get: () => 0 });
    (Element.prototype as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
  });
  afterEach(() => {
    for (const [p, d] of originales) {
      if (d) Object.defineProperty(Element.prototype, p, d);
    }
    delete (Element.prototype as unknown as { scrollBy?: unknown }).scrollBy;
  });

  test('al principio solo hay "Siguiente", y desplaza 260 px (el mínimo) hacia la derecha', async () => {
    auth.user = null;
    mount();
    await screen.findByText('Huerta comunitaria');
    const siguiente = await screen.findByRole('button', { name: 'Siguiente' });
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    fireEvent.click(siguiente);
    expect(scrollBy).toHaveBeenCalledWith({ left: 260, behavior: 'smooth' });
  });

  test('"Para vos" también: "Siguiente" desplaza hacia la derecha', async () => {
    vi.mocked(api.projects.recommended).mockResolvedValue({
      recommendations: [project('r1', 'Apoyo escolar')], based_on_history: true,
    } as never);
    mount();
    const recs = screen.getByRole('region', { name: 'Para vos' });
    await within(recs).findAllByText('Apoyo escolar');
    fireEvent.click(await within(recs).findByRole('button', { name: 'Siguiente' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 260, behavior: 'smooth' });
  });
});
