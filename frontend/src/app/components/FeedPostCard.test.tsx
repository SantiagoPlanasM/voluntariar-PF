// src/app/components/FeedPostCard.test.tsx — la tarjeta de un proyecto en el feed (TP de Calidad, cobertura del frontend, §210).
// Criterio de aceptación (antes de escribir los casos):
//  - cerrada: categoría (o "Comunidad"), tipo con su duración ("Fugaz"/duración, "Sostenido"/hs por semana), logo o
//    inicial de la ONG, calificación o "Nuevo", y las barras: financiamiento solo si hay meta, en pesos, tope 100 %;
//  - abierta (chevron): quién la sigue ("Seguido por 1 persona" / "N personas" / la etiqueta del backend), roles,
//    costo ("Gratis" o en pesos), cantidad de reseñas, hasta 3 comentarios (foto o inicial, "Participó");
//  - comentar sin sesión pide iniciarla; con sesión agrega el comentario arriba y suma 1; si falla, el error;
//  - inscribirse sin sesión pide iniciarla; si no es voluntario lleva al proyecto; si ya está inscripto no deja; si
//    sale bien avisa y refresca; si falla, el error;
//  - seguir/dejar de seguir actualiza el botón y los seguidores; las reseñas se abren desde las estrellas y, al
//    calificar, la tarjeta muestra el nuevo promedio.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth, navigate } = vi.hoisted(() => ({
  auth: { user: null as null | Record<string, unknown>, openAuthModal: vi.fn() },
  navigate: vi.fn(),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
vi.mock('./ReviewsModal', () => ({
  ReviewsModal: ({ isOpen, onClose, onReviewAdded }: { isOpen: boolean; onClose: () => void; onReviewAdded: (a: number, n: number) => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Reseñas">
        <button onClick={() => onReviewAdded(4.5, 3)}>calificar</button>
        <button onClick={onClose}>cerrar reseñas</button>
      </div>
    ) : null,
}));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      enrollments: { ...actual.api.enrollments, enroll: vi.fn() },
      projects: { ...actual.api.projects, comment: vi.fn() },
      follows: { ...actual.api.follows, followProject: vi.fn(), unfollowProject: vi.fn() },
    },
  };
});

import { api, FeedProject } from '../../lib/api';
import { FeedPostCard } from './FeedPostCard';

const VOLUNTARIO = { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' };
const proyecto = (over: Record<string, unknown> = {}) => ({
  id: 'p1', ngo_id: 'n1', ngo_name: 'Sustentando', title: 'Huerta comunitaria', description: 'Plantamos', category: 'Ambiente',
  location: 'Córdoba', type: 'fugaz', duration: '2 días', volunteers_needed: 10, current_volunteers: 2, funding_goal: 0,
  current_funding: 0, cost_per_person: 0, followers: 0, avg_rating: 0, ...over,
}) as unknown as FeedProject;
const montar = (over: Record<string, unknown> = {}, onRefresh?: () => void) =>
  render(<MemoryRouter><FeedPostCard project={proyecto(over)} onRefresh={onRefresh} /></MemoryRouter>);
const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Expandir detalles' }));

beforeEach(() => {
  auth.user = null;
  auth.openAuthModal.mockReset();
  navigate.mockReset();
  vi.mocked(api.enrollments.enroll).mockReset();
  vi.mocked(api.projects.comment).mockReset();
  vi.mocked(api.follows.followProject).mockReset();
  vi.mocked(api.follows.unfollowProject).mockReset();
});

describe('FeedPostCard: cerrada', () => {
  test('fugaz con duración, logo de la ONG y "Nuevo" sin calificación', () => {
    montar({ ngo_logo: 'https://x/logo.png' });
    expect(screen.getByText('Ambiente')).toBeInTheDocument();
    expect(screen.getAllByText('Fugaz').length).toBeGreaterThan(0);
    expect(screen.getByText('2 días')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sustentando' })).toHaveAttribute('src', 'https://x/logo.png');
    expect(screen.getByTitle('Ver reseñas de la comunidad')).toHaveTextContent('Nuevo');
  });

  test('sin categoría, ni nombre ni logo de ONG, sostenido sin horas: los textos por defecto', () => {
    montar({ category: null, ngo_name: null, type: 'sostenido', hours_per_week: null });
    expect(screen.getByText('Comunidad')).toBeInTheDocument();
    expect(screen.getByText('Organización')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
    expect(screen.getAllByText('Sostenido').length).toBe(2);   // el badge y la duración
  });

  test('sostenido con horas y calificación: "4 hs/semana" y el promedio con un decimal', () => {
    montar({ type: 'sostenido', hours_per_week: 4, avg_rating: 4.25 });
    expect(screen.getByText('4 hs/semana')).toBeInTheDocument();
    expect(screen.getByTitle('Ver reseñas de la comunidad')).toHaveTextContent('4.3');
  });

  test('con meta de financiamiento: los montos en pesos y la barra en su porcentaje', () => {
    const { container } = montar({ funding_goal: 10000, current_funding: 1500 });
    expect(screen.getByText('Financiamiento')).toBeInTheDocument();
    expect(screen.getByText('$1.500 / $10.000')).toBeInTheDocument();
    expect(container.querySelector('.bg-blue-600.rounded-full')).toHaveStyle({ width: '15%' });
  });

  test('sin meta no hay barra de financiamiento; los voluntarios pasados de la meta topean en 100 %', () => {
    const { container } = montar({ current_volunteers: 15, volunteers_needed: 10 });
    expect(screen.queryByText('Financiamiento')).not.toBeInTheDocument();
    expect(screen.getByText('15 / 10')).toBeInTheDocument();
    expect(container.querySelector('.bg-\\[\\#3d6139\\]')).toHaveStyle({ width: '100%' });
  });

  test('un monto que no es número se muestra como $0', () => {
    montar({ funding_goal: 1000, current_funding: 'abc' });
    expect(screen.getByText('$0 / $1.000')).toBeInTheDocument();
  });
});

describe('FeedPostCard: abierta', () => {
  test.each([
    [{ follow_label: 'Seguís a esta ONG' }, 'Seguís a esta ONG'],
    [{ followers: 1 }, 'Seguido por 1 persona'],
    [{ followers: 3 }, 'Seguido por 3 personas'],
    [{}, 'Organización en Voluntariar'],
  ])('quién la sigue: %o → "%s"', (over, texto) => {
    montar(over);
    expect(screen.queryByText(texto)).not.toBeInTheDocument();
    abrir();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  test('roles, costo en pesos, cantidad de reseñas y el chevron vuelve a cerrar', () => {
    montar({ roles_needed: ['Docente', 'Cocinero'], cost_per_person: 2500, ratings_count: 3, avg_rating: 4 });
    abrir();
    expect(screen.getByText('Docente')).toBeInTheDocument();
    expect(screen.getByText('Cocinero')).toBeInTheDocument();
    expect(screen.getByText('$2.500')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar detalles' }));
    expect(screen.queryByText('Docente')).not.toBeInTheDocument();
  });

  test('sin costo: "Gratis"; sin comentarios: la invitación a ser el primero', () => {
    montar();
    abrir();
    expect(screen.getByText('Gratis')).toBeInTheDocument();
    expect(screen.getByText(/Sé el primero en dejar un comentario/)).toBeInTheDocument();
    expect(screen.getByText('Comentarios (0)')).toBeInTheDocument();
  });

  test('comentarios: hasta 3, con foto o inicial y "Participó" solo a quien participó', () => {
    const c = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, user_id: 'v' + id, user_name: name, comment: 'Hola ' + id, ...extra });
    montar({
      recent_comments: [c('1', 'Ana', { user_avatar: 'https://x/ana.jpg', is_participant: 1 }), c('2', 'Beto'), c('3', 'Caro'), c('4', 'Dani')],
      comments_count: 4,
    });
    abrir();
    expect(screen.getByRole('img', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getAllByText('Participó')).toHaveLength(1);
    expect(screen.queryByText('Hola 4')).not.toBeInTheDocument();
    expect(screen.getByText('Comentarios (4)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ana/ })).toHaveAttribute('href', '/volunteer/v1');
  });
});

describe('FeedPostCard: comentar', () => {
  const escribir = (texto: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario' }), { target: { value: texto } });
    fireEvent.click(screen.getByTitle('Enviar comentario'));
  };

  test('sin sesión pide iniciarla y no manda nada', () => {
    montar();
    abrir();
    escribir('Hola');
    expect(auth.openAuthModal).toHaveBeenCalledWith('Iniciá sesión para comentar');
    expect(api.projects.comment).not.toHaveBeenCalled();
  });

  test('con sesión: manda el texto sin espacios, lo agrega arriba, suma 1 y vacía el campo', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.projects.comment).mockResolvedValue({ comment: { id: 'c9', user_id: 'u-me', user_name: 'María', comment: 'Me sumo' } } as never);
    montar();
    abrir();
    escribir('  Me sumo  ');
    expect(await screen.findByText('Me sumo')).toBeInTheDocument();
    expect(api.projects.comment).toHaveBeenCalledWith('p1', 'Me sumo');
    expect(screen.getByText('Comentarios (1)')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toHaveValue('');
  });

  test('vacío no se puede mandar', () => {
    auth.user = VOLUNTARIO;
    montar();
    abrir();
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario' }), { target: { value: '   ' } });
    expect(screen.getByTitle('Enviar comentario')).toBeDisabled();
  });

  test('si falla, el error y el texto queda escrito', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.projects.comment).mockRejectedValue(new Error('Contenido no permitido'));
    montar();
    abrir();
    escribir('Hola');
    expect(await screen.findByText('Contenido no permitido')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toHaveValue('Hola');
  });
});

describe('FeedPostCard: inscribirse', () => {
  test('sin sesión pide iniciarla', () => {
    montar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirse' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('Iniciá sesión para inscribirte como voluntario');
    expect(api.enrollments.enroll).not.toHaveBeenCalled();
  });

  test('una ONG o empresa va al detalle del proyecto', () => {
    auth.user = { ...VOLUNTARIO, role: 'ngo' };
    montar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirse' }));
    expect(navigate).toHaveBeenCalledWith('/project/p1');
    expect(api.enrollments.enroll).not.toHaveBeenCalled();
  });

  test('voluntario: se inscribe, avisa, refresca y el botón queda como enviado', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.enrollments.enroll).mockResolvedValue({} as never);
    const onRefresh = vi.fn();
    montar({}, onRefresh);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirse' }));
    expect(await screen.findByText('¡Inscripción enviada con éxito!')).toBeInTheDocument();
    expect(api.enrollments.enroll).toHaveBeenCalledWith('p1');
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Inscripto \/ Solicitud enviada/ })).toBeDisabled();
  });

  test('si falla, el error y se puede reintentar', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.enrollments.enroll).mockRejectedValue(new Error('No hay cupos'));
    montar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirse' }));
    expect(await screen.findByText('No hay cupos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inscribirse' })).toBeEnabled();
  });

  test.each(['pending', 'approved'])('ya inscripto (%s): el botón está deshabilitado', (estado) => {
    auth.user = VOLUNTARIO;
    montar({ my_enrollment_status: estado });
    abrir();
    expect(screen.getByRole('button', { name: /Inscripto \/ Solicitud enviada/ })).toBeDisabled();
  });
});

describe('FeedPostCard: seguir y reseñas', () => {
  test('solo el voluntario ve el botón de seguir', () => {
    auth.user = { ...VOLUNTARIO, role: 'ngo' };
    montar();
    expect(screen.queryByTitle('Seguir este voluntariado')).not.toBeInTheDocument();
  });

  test('seguir: el botón cambia y los seguidores se actualizan con los del servidor', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.follows.followProject).mockResolvedValue({ followers: 8 } as never);
    montar({ followers: 7 });
    fireEvent.click(screen.getByTitle('Seguir este voluntariado'));
    expect(await screen.findByTitle('Dejar de seguir voluntariado')).toBeInTheDocument();
    abrir();
    expect(screen.getByText('8 seguidores')).toBeInTheDocument();
  });

  test('dejar de seguir (seguía por los dos lados): manda la baja y usa los seguidores del servidor', async () => {
    auth.user = VOLUNTARIO;
    // El servidor dice 0 (no 3 − 1): así se distingue usar su número de restar uno localmente
    vi.mocked(api.follows.unfollowProject).mockResolvedValue({ followers: 0 } as never);
    montar({ follow_source: 'both', followers: 3 });
    fireEvent.click(screen.getByTitle('Dejar de seguir voluntariado'));
    expect(await screen.findByTitle('Seguir este voluntariado')).toBeInTheDocument();
    expect(api.follows.unfollowProject).toHaveBeenCalledWith('p1');
    abrir();
    expect(screen.getByText('0 seguidores')).toBeInTheDocument();
  });

  test('las estrellas abren las reseñas; al calificar, la tarjeta muestra el nuevo promedio; se cierran', async () => {
    montar();
    fireEvent.click(screen.getByTitle('Ver reseñas de la comunidad'));
    fireEvent.click(screen.getByRole('button', { name: 'calificar' }));
    await waitFor(() => expect(screen.getByTitle('Ver reseñas de la comunidad')).toHaveTextContent('4.5'));
    fireEvent.click(screen.getByRole('button', { name: 'cerrar reseñas' }));
    expect(screen.queryByRole('dialog', { name: 'Reseñas' })).not.toBeInTheDocument();
    abrir();
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });
});
