// src/app/components/ProjectDetailsRating.test.tsx
//
// El formulario de calificación de ProjectDetails (pestaña Reseñas) arrancaba siempre en 5 ★ y vacío, aunque
// la persona ya hubiera calificado. El backend hace upsert: mandar sin mirar pisaba la reseña anterior (y,
// sin comentario, la borraba). Mismo arreglo que ReviewsModal en §112 (S4): se precarga la reseña propia.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' } as Record<string, unknown> | null, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn(), rate: vi.fn(), comment: vi.fn() },
      follows: { ...actual.api.follows, projectStatus: vi.fn().mockResolvedValue({ following: false }) },
      posts: { ...actual.api.posts, list: vi.fn().mockResolvedValue({ posts: [] }) },
    },
  };
});

import { api } from '../../lib/api';
import { ProjectDetails } from './ProjectDetails';

const maria = { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' };
const juan = { id: 'r1', user_id: 'u-juan', user_name: 'Juan Pérez', rating: 5, comment: 'Excelente', created_at: '2026-10-10 12:00:00' };
// La de María (u-vol), como la devuelve GET /api/projects/:id (con user_id).
const mia = { id: 'r2', user_id: 'u-vol', user_name: 'María', rating: 3, comment: 'Faltó organización', created_at: '2026-10-11 12:00:00' };

const project = (id: string, ratings: unknown[], extra: Record<string, unknown> = {}) => ({
  project: {
    id, ngo_id: 'ngo-1', title: `Proyecto ${id}`, status: 'active', type: 'fugaz', comments: [], kpis: [],
    ratings, avg_rating: 0, my_enrollment: { id: `e-${id}`, status: 'approved' }, ...extra,
  },
});

// Botones para navegar de un proyecto a otro sin desmontar ProjectDetails (como un link en la página).
function Nav() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/project/proj-2')}>ir a proj-2</button>;
}

const mount = (path = '/project/proj-1') => render(
  <MemoryRouter initialEntries={[path]}>
    <Nav />
    <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
  </MemoryRouter>,
);

const openRatingsTab = async () => fireEvent.click(await screen.findByRole('button', { name: /^Reseñas \(/ }));
const stars = (n: number) => screen.getByRole('button', { name: n === 1 ? '1 estrella' : `${n} estrellas` });
const textarea = () => screen.getByRole('textbox', { name: 'Tu reseña' }) as HTMLTextAreaElement;
const AVISO = 'Ya calificaste este voluntariado. Podés editar tu reseña.';

beforeEach(() => {
  vi.mocked(api.projects.get).mockReset();
  vi.mocked(api.projects.rate).mockReset();
  vi.mocked(api.projects.comment).mockReset();
  auth.user = { ...maria };
});

describe('ProjectDetails: la reseña propia se precarga', () => {
  test('si ya calificó: aviso, "Actualizar reseña", sus estrellas y su comentario; mandar sin tocar no la pisa', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan, mia]) as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    mount();
    await openRatingsTab();

    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(stars(3)).toHaveAttribute('aria-pressed', 'true');
    expect(stars(5)).toHaveAttribute('aria-pressed', 'false');
    expect(textarea().value).toBe('Faltó organización');

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar reseña' }));
    await waitFor(() => expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 3, 'Faltó organización'));
  });

  test('si no calificó (solo hay reseñas de otros): 5 ★, vacío, "Guardar reseña" y sin aviso', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan]) as never);
    mount();
    await openRatingsTab();

    expect(screen.getByText(/Dejá tu reseña/)).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
    expect(stars(5)).toHaveAttribute('aria-pressed', 'true');
    expect(textarea().value).toBe('');
    expect(screen.getByRole('button', { name: 'Guardar reseña' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar reseña' })).not.toBeInTheDocument();
  });

  test('después de guardar y recargar, el formulario muestra lo que guardó el servidor (no queda vacío)', async () => {
    // El servidor: antes de calificar, solo la de Juan; después, también la de María (recortada).
    vi.mocked(api.projects.get).mockImplementation(async () => (vi.mocked(api.projects.rate).mock.calls.length
      ? project('proj-1', [juan, { ...mia, rating: 4, comment: 'Mejoró' }])
      : project('proj-1', [juan])) as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    mount();
    await openRatingsTab();

    fireEvent.click(stars(4));
    fireEvent.change(textarea(), { target: { value: '  Mejoró  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reseña' }));

    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 4, 'Mejoró');
    expect(textarea().value).toBe('Mejoró');
    expect(stars(4)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Actualizar reseña' })).toBeInTheDocument();
    expect(screen.getByText('¡Calificación guardada con éxito!')).toBeInTheDocument();
  });

  test('si el proyecto se recarga por otra razón (un comentario), no pisa lo que estaba escribiendo', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan, mia]) as never);
    vi.mocked(api.projects.comment).mockResolvedValue({} as never);
    mount();
    await openRatingsTab();
    expect(textarea().value).toBe('Faltó organización');

    fireEvent.click(stars(2));
    fireEvent.change(textarea(), { target: { value: 'Borrador a medio escribir' } });

    // Comenta en la otra pestaña: handleComment recarga el proyecto (load).
    fireEvent.click(screen.getByRole('button', { name: /^Comentarios \(/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario' }), { target: { value: 'Muy lindo todo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    await waitFor(() => expect(api.projects.get).toHaveBeenCalledTimes(2));

    await openRatingsTab();
    expect(textarea().value).toBe('Borrador a medio escribir');
    expect(stars(2)).toHaveAttribute('aria-pressed', 'true');
  });

  test('si la sesión se confirma después de cargar el proyecto, se precarga igual', async () => {
    auth.user = null; // AuthContext todavía verificando el token
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan, mia]) as never);
    const { rerender } = mount();
    await openRatingsTab();
    expect(textarea().value).toBe('');
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();

    auth.user = { ...maria };
    rerender(
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Nav />
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(textarea().value).toBe('Faltó organización'));
    expect(stars(3)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(AVISO)).toBeInTheDocument();
  });

  test('si escribió antes de que se confirme la sesión, no se lo pisa', async () => {
    auth.user = null;
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan, mia]) as never);
    const { rerender } = mount();
    await openRatingsTab();
    fireEvent.change(textarea(), { target: { value: 'Lo que estaba escribiendo' } });

    auth.user = { ...maria };
    rerender(
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Nav />
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>,
    );
    // Aviso y botón sí (se derivan de la lista), pero el texto queda.
    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(textarea().value).toBe('Lo que estaba escribiendo');
  });

  test('si solo tocó las estrellas antes de que se confirme la sesión, tampoco se las pisa', async () => {
    auth.user = null;
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan, mia]) as never);
    const { rerender } = mount();
    await openRatingsTab();
    fireEvent.click(stars(1));

    auth.user = { ...maria };
    rerender(
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Nav />
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(stars(1)).toHaveAttribute('aria-pressed', 'true');
    expect(textarea().value).toBe('');
  });

  test('una reseña propia sin comentario se precarga con el texto vacío y se puede actualizar', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project('proj-1', [juan, { ...mia, rating: 4, comment: null }]) as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    mount();
    await openRatingsTab();
    expect(stars(4)).toHaveAttribute('aria-pressed', 'true');
    expect(textarea().value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar reseña' }));
    await waitFor(() => expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 4, undefined));
  });

  test('al pasar a otro proyecto no queda el mensaje de éxito del anterior', async () => {
    vi.mocked(api.projects.get).mockImplementation(async (pid: string) => (pid === 'proj-1'
      ? project('proj-1', [juan])
      : project('proj-2', [juan])) as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    mount();
    await openRatingsTab();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reseña' }));
    expect(await screen.findByText('¡Calificación guardada con éxito!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ir a proj-2' }));
    expect(await screen.findByText('Proyecto proj-2')).toBeInTheDocument();
    expect(screen.queryByText('¡Calificación guardada con éxito!')).not.toBeInTheDocument();
  });

  test('al pasar a otro proyecto no queda el error de calificación del anterior', async () => {
    vi.mocked(api.projects.get).mockImplementation(async (pid: string) => (pid === 'proj-1'
      ? project('proj-1', [juan])
      : project('proj-2', [juan])) as never);
    vi.mocked(api.projects.rate).mockRejectedValue(new Error('El comentario contiene palabras no permitidas'));
    mount();
    await openRatingsTab();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reseña' }));
    expect(await screen.findByText('El comentario contiene palabras no permitidas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ir a proj-2' }));
    expect(await screen.findByText('Proyecto proj-2')).toBeInTheDocument();
    expect(screen.queryByText('El comentario contiene palabras no permitidas')).not.toBeInTheDocument();
  });

  test('al pasar a otro proyecto sin desmontar, el formulario es el del proyecto nuevo', async () => {
    vi.mocked(api.projects.get).mockImplementation(async (pid: string) => (pid === 'proj-1'
      ? project('proj-1', [juan, mia])
      : project('proj-2', [juan])) as never);
    mount();
    await openRatingsTab();
    expect(textarea().value).toBe('Faltó organización');

    fireEvent.click(screen.getByRole('button', { name: 'ir a proj-2' }));
    expect(await screen.findByText('Proyecto proj-2')).toBeInTheDocument();
    await openRatingsTab();
    expect(textarea().value).toBe('');
    expect(stars(5)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  test('se precarga una vez por proyecto: una recarga por otra razón no cambia el formulario', async () => {
    // Entre las dos cargas, la reseña cambió en otro lado (otra pestaña). La persona no tocó el formulario,
    // pero puede estar leyéndolo: la recarga por un comentario no se lo cambia de golpe.
    let calls = 0;
    vi.mocked(api.projects.get).mockImplementation(async () => (++calls === 1
      ? project('proj-1', [juan, mia])
      : project('proj-1', [juan, { ...mia, rating: 1, comment: 'Cambiada en otra pestaña' }])) as never);
    vi.mocked(api.projects.comment).mockResolvedValue({} as never);
    mount();
    await openRatingsTab();
    expect(textarea().value).toBe('Faltó organización');

    fireEvent.click(screen.getByRole('button', { name: /^Comentarios \(/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario' }), { target: { value: 'Muy lindo todo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    await waitFor(() => expect(api.projects.get).toHaveBeenCalledTimes(2));

    await openRatingsTab();
    expect(textarea().value).toBe('Faltó organización');
    expect(stars(3)).toHaveAttribute('aria-pressed', 'true');
  });

  test('si la sesión se confirma mientras carga otro proyecto, no se precarga la reseña del anterior', async () => {
    auth.user = null;
    let resolveSecond: (v: unknown) => void = () => {};
    vi.mocked(api.projects.get).mockImplementation((pid: string) => (pid === 'proj-1'
      ? Promise.resolve(project('proj-1', [juan, mia]))
      : new Promise(r => { resolveSecond = r; })) as never);
    const tree = () => (
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Nav />
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>
    );
    const { rerender } = render(tree());
    await openRatingsTab();

    fireEvent.click(screen.getByRole('button', { name: 'ir a proj-2' }));
    await waitFor(() => expect(api.projects.get).toHaveBeenCalledWith('proj-2'));
    auth.user = { ...maria };          // llega la sesión con proj-1 todavía en pantalla (cargando proj-2)
    rerender(tree());
    resolveSecond(project('proj-2', [juan]));

    expect(await screen.findByText('Proyecto proj-2')).toBeInTheDocument();
    expect(textarea().value).toBe('');
    expect(stars(5)).toHaveAttribute('aria-pressed', 'true');
  });

  test('al pasar de un proyecto sin reseña propia a otro con reseña propia, se precarga la del nuevo', async () => {
    vi.mocked(api.projects.get).mockImplementation(async (pid: string) => (pid === 'proj-1'
      ? project('proj-1', [juan])
      : project('proj-2', [juan, { ...mia, rating: 2, comment: 'Del segundo' }])) as never);
    mount();
    await openRatingsTab();
    expect(textarea().value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'ir a proj-2' }));
    expect(await screen.findByText('Proyecto proj-2')).toBeInTheDocument();
    await openRatingsTab();
    expect(textarea().value).toBe('Del segundo');
    expect(stars(2)).toHaveAttribute('aria-pressed', 'true');
  });
});
