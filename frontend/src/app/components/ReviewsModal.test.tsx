// src/app/components/ReviewsModal.test.tsx
//
// REVISION S1 (segunda pasada): si la carga de las reseñas fallaba, el error se tragaba y el modal decía
// "Sin reseñas todavía", como si nadie hubiera calificado. Ahora se ve el error, con "Reintentar".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' } as Record<string, unknown> | null, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), rate: vi.fn() } } };
});

import { api, ApiError } from '../../lib/api';
import { ReviewsModal } from './ReviewsModal';
import { FeedPostCard } from './FeedPostCard';

const juan = { id: 'r1', user_id: 'u-juan', user_name: 'Juan Pérez', rating: 5, comment: 'Muy bueno', created_at: '2026-10-10 12:00:00' };

const open = () => render(
  <MemoryRouter>
    <ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación" />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.mocked(api.projects.get).mockReset();
  vi.mocked(api.projects.rate).mockReset();
  auth.user = { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' };
});

// La calificación propia de María (u-vol), como la devuelve GET /api/projects/:id (con user_id).
const mia = { id: 'r2', user_id: 'u-vol', user_name: 'María', rating: 3, comment: 'Faltó organización', created_at: '2026-10-11 12:00:00' };

describe('Feed: reabrir las reseñas después de calificar (S3)', () => {
  // Como llega en el feed (GET /follows/feed): la lista de reseñas sin user_id.
  const feedProject = {
    id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente',
    location: 'Córdoba', type: 'fugaz', status: 'active', modality: 'presencial', volunteers_needed: 10,
    current_volunteers: 1, cost_per_person: 0, ngo_name: 'Sustentando', image: '', avg_rating: 5, ratings_count: 1,
    ratings: [{ id: 'r1', user_name: 'Juan Pérez', rating: 5, comment: 'Muy bueno', created_at: '2026-10-10 12:00:00' }],
    my_enrollment_status: 'approved', recent_comments: [], comments_count: 0,
  };

  test('al cerrar y volver a abrir el modal se ve la lista con la reseña nueva, no la vieja del feed', async () => {
    // El servidor: antes de calificar, solo la de Juan; después, también la de María.
    vi.mocked(api.projects.get).mockImplementation(async () => (vi.mocked(api.projects.rate).mock.calls.length
      ? { project: { avg_rating: 4, ratings: [juan, mia] } }
      : { project: { avg_rating: 5, ratings: [juan] } }) as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    render(<MemoryRouter><FeedPostCard project={feedProject as never} /></MemoryRouter>);

    fireEvent.click(screen.getAllByTitle('Ver reseñas de la comunidad')[0]);
    let d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    await waitFor(() => expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeEnabled());
    fireEvent.click(within(d).getByRole('button', { name: '3 estrellas' }));
    fireEvent.change(within(d).getByRole('textbox', { name: 'Tu reseña' }), { target: { value: 'Faltó organización' } });
    fireEvent.click(within(d).getByRole('button', { name: /Publicar reseña/ }));
    await waitFor(() => expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 3, 'Faltó organización'));
    expect(await within(d).findByText('2 reseñas en total')).toBeInTheDocument();

    fireEvent.click(within(d).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('Ver reseñas de la comunidad')[0]);
    d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('2 reseñas en total')).toBeInTheDocument();
    expect(within(d).getByText('Faltó organización', { selector: 'p' })).toBeInTheDocument();
    // El promedio del modal sale de la lista actualizada (5 y 3), no de la vieja (solo el 5).
    expect(within(d).getByText('4.0')).toBeInTheDocument();
  });

  test('mientras recarga se sigue viendo la lista que vino del feed (no un spinner en blanco)', async () => {
    vi.mocked(api.projects.get).mockReturnValue(new Promise(() => {}) as never);
    render(<MemoryRouter><FeedPostCard project={feedProject as never} /></MemoryRouter>);
    fireEvent.click(screen.getAllByTitle('Ver reseñas de la comunidad')[0]);
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(within(d).getByText('Muy bueno')).toBeInTheDocument();
    expect(api.projects.get).toHaveBeenCalledWith('proj-1');
  });
});

describe('Volver a calificar: se precarga la reseña propia (S4)', () => {
  const openRating = () => render(
    <MemoryRouter>
      <ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación" canRate />
    </MemoryRouter>,
  );

  test('si ya calificó: estrellas y comentario propios, "Actualizar reseña" y aviso de que ya calificó', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [juan, mia] } } as never);
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByRole('button', { name: /Actualizar reseña/ })).toBeEnabled();
    expect(within(d).queryByRole('button', { name: /Publicar reseña/ })).not.toBeInTheDocument();
    expect(within(d).getByText(/Ya calificaste este voluntariado/)).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: '3 estrellas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByRole('button', { name: '5 estrellas' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(d).getByRole('textbox', { name: 'Tu reseña' })).toHaveValue('Faltó organización');
  });

  test('mandar sin tocar nada conserva la reseña (no la pisa con 5 ★ y sin comentario); el comentario queda', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [juan, mia] } } as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    fireEvent.click(await within(d).findByRole('button', { name: /Actualizar reseña/ }));
    await waitFor(() => expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 3, 'Faltó organización'));
    expect(await within(d).findByText(/se guardó/)).toBeInTheDocument();
    expect(within(d).getByRole('textbox', { name: 'Tu reseña' })).toHaveValue('Faltó organización');
  });

  test('si no calificó (solo hay reseñas de otros): 5 ★, vacío y "Publicar reseña", sin aviso', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [juan] } } as never);
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Muy bueno')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeEnabled();
    expect(within(d).queryByText(/Ya calificaste/)).not.toBeInTheDocument();
    expect(within(d).getByRole('button', { name: '5 estrellas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByRole('textbox', { name: 'Tu reseña' })).toHaveValue('');
  });

  test('sin sesión no se toma ninguna reseña como propia', async () => {
    auth.user = null;
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [mia] } } as never);
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Faltó organización')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeInTheDocument();
    expect(within(d).getByRole('textbox', { name: 'Tu reseña' })).toHaveValue('');
  });

  test('sin sesión, las reseñas del feed (sin user_id) no cuentan como propias mientras recarga', async () => {
    auth.user = null;
    vi.mocked(api.projects.get).mockReturnValue(new Promise(() => {}) as never);
    const deFeed = [{ id: 'r1', user_name: 'Juan Pérez', rating: 4, comment: 'Me encantó', created_at: '2026-10-10 12:00:00' }];
    render(<MemoryRouter><ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación"
      initialRatings={deFeed as never} canRate /></MemoryRouter>);
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(within(d).getByText('Me encantó')).toBeInTheDocument();
    expect(within(d).queryByText(/Ya calificaste/)).not.toBeInTheDocument();
    expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeInTheDocument();
  });

  test('después de guardar, el formulario muestra lo que guardó el servidor (comentario sin espacios de más)', async () => {
    vi.mocked(api.projects.get).mockImplementation(async () => (vi.mocked(api.projects.rate).mock.calls.length
      ? { project: { ratings: [{ ...mia, rating: 4, comment: 'Mejoró' }] } }
      : { project: { ratings: [] } }) as never);
    vi.mocked(api.projects.rate).mockResolvedValue({ message: 'ok' } as never);
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    await waitFor(() => expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeEnabled());
    fireEvent.click(within(d).getByRole('button', { name: '4 estrellas' }));
    fireEvent.change(within(d).getByRole('textbox', { name: 'Tu reseña' }), { target: { value: '  Mejoró  ' } });
    fireEvent.click(within(d).getByRole('button', { name: /Publicar reseña/ }));
    await waitFor(() => expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 4, 'Mejoró'));
    expect(await within(d).findByRole('button', { name: /Actualizar reseña/ })).toBeInTheDocument();
    expect(within(d).getByRole('textbox', { name: 'Tu reseña' })).toHaveValue('Mejoró');
  });

  test('si cambia el proyecto con el modal montado: lista y formulario del proyecto nuevo, no los del anterior', async () => {
    vi.mocked(api.projects.get).mockImplementation(async (id: string) => (id === 'proj-1'
      ? { project: { ratings: [juan, mia] } }
      : new Promise(() => {})) as never);
    const otra = { id: 'r9', user_id: 'u-ana', user_name: 'Ana', rating: 2, comment: 'Otra cosa', created_at: '2026-10-12 12:00:00' };
    const view = (projectId: string, initialRatings?: typeof otra[]) => (
      <MemoryRouter><ReviewsModal isOpen onClose={() => {}} projectId={projectId} projectTitle="X"
        initialRatings={initialRatings} canRate /></MemoryRouter>
    );
    const { rerender } = render(view('proj-1'));
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByRole('textbox', { name: 'Tu reseña' })).toHaveValue('Faltó organización');

    rerender(view('proj-2', [otra]));
    const d2 = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d2).findByText('Otra cosa')).toBeInTheDocument();
    expect(within(d2).queryByText('Muy bueno')).not.toBeInTheDocument();
    expect(within(d2).getByRole('button', { name: '5 estrellas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d2).getByRole('textbox', { name: 'Tu reseña' })).toHaveValue('');
  });

  test('el error al mandar la reseña se anuncia (role="alert"; S10)', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [] } } as never);
    vi.mocked(api.projects.rate).mockRejectedValue(new ApiError('El comentario contiene palabras no permitidas', 400));
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    await waitFor(() => expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeEnabled());
    expect(within(d).queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: /Publicar reseña/ }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('El comentario contiene palabras no permitidas');
  });

  test('mientras cargan las reseñas no se puede mandar (todavía no se sabe si ya calificó)', async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.projects.get).mockReturnValue(new Promise(r => { resolve = r; }) as never);
    openRating();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(within(d).getByRole('button', { name: /Publicar reseña/ })).toBeDisabled();
    resolve({ project: { ratings: [mia] } });
    expect(await within(d).findByRole('button', { name: /Actualizar reseña/ })).toBeEnabled();
  });
});

describe('ReviewsModal: error al cargar las reseñas (S1)', () => {
  test('un 500 muestra el error y "Reintentar", no "Sin reseñas todavía"; reintentar carga la lista', async () => {
    vi.mocked(api.projects.get)
      .mockRejectedValueOnce(new ApiError('Error al obtener el proyecto', 500))
      .mockResolvedValueOnce({ project: { ratings: [juan] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Error al obtener el proyecto')).toBeInTheDocument();
    // Se anuncia a los lectores de pantalla (S10).
    expect(within(d).getByRole('alert')).toHaveTextContent('Error al obtener el proyecto');
    expect(within(d).queryByText('Sin reseñas todavía')).not.toBeInTheDocument();
    expect(within(d).queryByText(/0 reseñas en total/)).not.toBeInTheDocument();

    fireEvent.click(within(d).getByRole('button', { name: /Reintentar/ }));
    expect(await within(d).findByText('Muy bueno')).toBeInTheDocument();
    expect(within(d).queryByText('Error al obtener el proyecto')).not.toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(api.projects.get).toHaveBeenCalledTimes(2);
  });

  test('sin conexión (fetch tira TypeError): mensaje en español, no el texto técnico', async () => {
    vi.mocked(api.projects.get).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('No pudimos cargar las reseñas. Revisá tu conexión.')).toBeInTheDocument();
    expect(within(d).queryByText('Failed to fetch')).not.toBeInTheDocument();
    expect(within(d).queryByText('Sin reseñas todavía')).not.toBeInTheDocument();
  });

  test('si de verdad no hay reseñas, sigue diciendo "Sin reseñas todavía" (sin error)', async () => {
    vi.mocked(api.projects.get).mockResolvedValueOnce({ project: { ratings: [] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Sin reseñas todavía')).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });
});
