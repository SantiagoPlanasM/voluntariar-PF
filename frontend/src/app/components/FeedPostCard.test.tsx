// src/app/components/FeedPostCard.test.tsx — la tarjeta de un proyecto en el feed (TP de Calidad, cobertura del frontend, §210).
// Reescrito en el rediseño (§240): la tarjeta nueva (DESIGN.md → Tarjeta de voluntariado) cambió textos y estructura.
// Criterio de aceptación (antes de escribir los casos):
//  - cerrada: categoría (si hay), tipo con color, duración ("2 días" / "N h por semana"), logo o iniciales de la ONG,
//    puntaje con un decimal o "Nuevo", y la doble meta: financiamiento solo si hay meta, en pesos, tope 100 %;
//  - "Más información" abre el detalle (y "Menos información" lo cierra): quién la sigue, roles, costo
//    ("Sin costo" o en pesos), seguidores y comentarios, hasta 3 comentarios (foto o iniciales, "Participó");
//  - comentar sin sesión pide iniciarla; con sesión agrega el comentario arriba y suma 1; si falla, el error;
//  - inscribirse sin sesión pide iniciarla; ONG y empresa no ven el botón; si ya está inscripto muestra el estado;
//    si sale bien avisa y refresca; si falla, el error;
//  - donar sin sesión pide iniciarla; con sesión lleva al voluntariado; sin meta de dinero no hay botón;
//  - seguir/dejar de seguir actualiza el botón y los seguidores; las reseñas se abren desde el puntaje y, al
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
  current_funding: 0, cost_per_person: 0, followers: 0, avg_rating: 0, status: 'active', ...over,
}) as unknown as FeedProject;
const montar = (over: Record<string, unknown> = {}, onRefresh?: () => void) =>
  render(<MemoryRouter><FeedPostCard project={proyecto(over)} onRefresh={onRefresh} /></MemoryRouter>);
const abrir = () => fireEvent.click(screen.getByRole('button', { name: /Más información/ }));
/** El detalle siempre está en el DOM (para animarlo); cerrado queda aria-hidden. */
const detalle = (container: HTMLElement) => container.querySelector('[id^="vc-detail-"]')!;
const barra = (nombre: string) => screen.getByRole('progressbar', { name: nombre });

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
    const { container } = montar({ ngo_logo: 'https://x/logo.png' });
    expect(screen.getByText('Ambiente')).toBeInTheDocument();
    expect(screen.getByText('Fugaz')).toBeInTheDocument();
    expect(screen.getByText('2 días')).toBeInTheDocument();
    expect(screen.getByText('Sustentando')).toBeInTheDocument();
    expect(container.querySelector('img[src="https://x/logo.png"]')).toBeInTheDocument();
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver reseñas/ })).not.toBeInTheDocument();
  });

  test('sin categoría, ni nombre ni logo de ONG, sostenido sin horas ni duración: sin chip, iniciales "ON", sin duración', () => {
    montar({ category: null, ngo_name: null, type: 'sostenido', hours_per_week: null, duration: null });
    expect(screen.queryByText('Ambiente')).not.toBeInTheDocument();
    expect(screen.getByText('ON')).toBeInTheDocument();          // iniciales de "ONG"
    expect(screen.getByText('Sostenido')).toBeInTheDocument();
    expect(screen.queryByText(/por semana/)).not.toBeInTheDocument();
  });

  test('sostenido con horas y calificación: "4 h por semana" y el promedio con un decimal y coma', () => {
    montar({ type: 'sostenido', hours_per_week: 4, avg_rating: 4.25, ratings_count: 2 });
    expect(screen.getByText('4 h por semana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Puntaje 4,3, 2 reseñas. Ver reseñas' })).toHaveTextContent('4,3(2)');
  });

  test('sostenido sin horas pero con duración: muestra la duración', () => {
    montar({ type: 'sostenido', hours_per_week: null, duration: '3 meses' });
    expect(screen.getByText('3 meses')).toBeInTheDocument();
  });

  test('con meta de financiamiento: los montos en pesos y la barra en su porcentaje', () => {
    montar({ funding_goal: 10000, current_funding: 1500 });
    expect(screen.getByText('Financiamiento')).toBeInTheDocument();
    expect(screen.getByText('$ 1.500')).toBeInTheDocument();
    expect(screen.getByText('de $ 10.000')).toBeInTheDocument();
    expect(barra('Financiamiento')).toHaveAttribute('aria-valuenow', '15');
  });

  test('sin meta no hay barra de financiamiento; los voluntarios pasados de la meta topean en 100 %', () => {
    montar({ current_volunteers: 15, volunteers_needed: 10 });
    expect(screen.queryByText('Financiamiento')).not.toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('de 10 lugares')).toBeInTheDocument();
    expect(barra('Voluntarios')).toHaveAttribute('aria-valuenow', '100');
  });

  test('un monto que no es número se muestra como $ 0', () => {
    montar({ funding_goal: 1000, current_funding: 'abc' });
    expect(screen.getByText('$ 0')).toBeInTheDocument();
    expect(barra('Financiamiento')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('FeedPostCard: abierta', () => {
  test('"Más información" abre el detalle y "Menos información" lo cierra', () => {
    const { container } = montar({ roles_needed: ['Docente'] });
    expect(detalle(container)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('textbox', { name: 'Comentario' })).not.toBeInTheDocument();
    abrir();
    expect(screen.getByRole('button', { name: /Menos información/ })).toHaveAttribute('aria-expanded', 'true');
    expect(detalle(container)).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Menos información/ }));
    expect(detalle(container)).toHaveAttribute('aria-hidden', 'true');
  });

  test.each([
    [{ follow_label: 'Seguís a esta ONG' }, 'Seguís a esta ONG'],
    [{ followers: 1 }, '1 persona sigue este voluntariado'],
    [{ followers: 3 }, '3 personas siguen este voluntariado'],
  ])('quién la sigue: %o → "%s"', (over, texto) => {
    montar(over);
    abrir();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });

  test('sin seguidores ni etiqueta no hay línea de contexto', () => {
    montar();
    abrir();
    expect(screen.queryByText(/sigue/)).not.toBeInTheDocument();
  });

  test('roles y costo en pesos', () => {
    montar({ roles_needed: ['Docente', 'Cocinero'], cost_per_person: 2500 });
    abrir();
    expect(screen.getByText('Docente')).toBeInTheDocument();
    expect(screen.getByText('Cocinero')).toBeInTheDocument();
    expect(screen.getByText('$ 2.500 por persona')).toBeInTheDocument();
  });

  test('sin costo: "Sin costo"; sin comentarios ni seguidores: los contadores en cero', () => {
    montar();
    abrir();
    expect(screen.getByText('Sin costo')).toBeInTheDocument();
    expect(screen.getByText('0 seguidores · 0 comentarios')).toBeInTheDocument();
    expect(screen.queryByText('Roles que se necesitan')).not.toBeInTheDocument();
  });

  test('comentarios: hasta 3, con foto o iniciales y "Participó" solo a quien participó', () => {
    const c = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, user_id: 'v' + id, user_name: name, comment: 'Hola ' + id, ...extra });
    const { container } = montar({
      recent_comments: [c('1', 'Ana', { user_avatar: 'https://x/ana.jpg', is_participant: 1 }), c('2', 'Beto'), c('3', 'Caro'), c('4', 'Dani')],
      comments_count: 4,
      followers: 1,
    });
    abrir();
    expect(container.querySelector('img[src="https://x/ana.jpg"]')).toBeInTheDocument();
    expect(screen.getByText('BE')).toBeInTheDocument();
    expect(screen.getAllByText('Participó')).toHaveLength(1);
    expect(screen.queryByText('Hola 4')).not.toBeInTheDocument();
    expect(screen.getByText('1 seguidor · 4 comentarios')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/volunteer/v1');
  });
});

describe('FeedPostCard: comentar', () => {
  const escribir = (texto: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario' }), { target: { value: texto } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar comentario' }));
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
    expect(screen.getByText('0 seguidores · 1 comentario')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toHaveValue('');
  });

  test('vacío no se puede mandar', () => {
    auth.user = VOLUNTARIO;
    montar();
    abrir();
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario' }), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Enviar comentario' })).toBeDisabled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('Iniciá sesión para inscribirte como voluntario');
    expect(api.enrollments.enroll).not.toHaveBeenCalled();
  });

  test.each(['ngo', 'company'])('%s no ve el botón de inscribirse', (role) => {
    auth.user = { ...VOLUNTARIO, role };
    montar();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
  });

  test('voluntario: se inscribe, avisa, refresca y el botón queda como postulado', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.enrollments.enroll).mockResolvedValue({} as never);
    const onRefresh = vi.fn();
    montar({}, onRefresh);
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }));
    expect(await screen.findByText('Inscripción enviada. La ONG te responde por notificación.')).toBeInTheDocument();
    expect(api.enrollments.enroll).toHaveBeenCalledWith('p1');
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Postulado' })).toBeDisabled();
  });

  test('si falla, el error y se puede reintentar', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.enrollments.enroll).mockRejectedValue(new Error('No hay cupos'));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }));
    expect(await screen.findByText('No hay cupos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inscribirme' })).toBeEnabled();
  });

  test('ya postulado: el botón está deshabilitado', () => {
    auth.user = VOLUNTARIO;
    montar({ my_enrollment_status: 'pending' });
    expect(screen.getByRole('button', { name: 'Postulado' })).toBeDisabled();
  });

  test.each([
    ['approved', 'Vas a ir'],
    ['rejected', 'No seleccionado'],
  ])('inscripción %s: "%s" y sin botón de inscribirse', (estado, texto) => {
    auth.user = VOLUNTARIO;
    montar({ my_enrollment_status: estado });
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
  });

  test('cupos completos o terminado: no se puede inscribir', () => {
    montar({ current_volunteers: 10, volunteers_needed: 10 });
    expect(screen.getByRole('button', { name: 'Cupos completos' })).toBeDisabled();
  });

  test('terminado: "Ver cómo salió" lleva al voluntariado', () => {
    montar({ status: 'completed' });
    expect(screen.getByRole('link', { name: 'Ver cómo salió' })).toHaveAttribute('href', '/project/p1');
  });

  test('cancelado (§256): "Cancelado", deshabilitado, y sin "Inscribirme"', () => {
    montar({ status: 'cancelled' });
    expect(screen.getByRole('button', { name: 'Cancelado' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
  });
});

describe('FeedPostCard: donar', () => {
  test('sin meta de dinero no hay botón de donar', () => {
    montar();
    expect(screen.queryByRole('button', { name: 'Donar' })).not.toBeInTheDocument();
  });

  test('sin sesión pide iniciarla', () => {
    montar({ funding_goal: 1000, current_funding: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'Donar' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('Iniciá sesión para donar');
    expect(navigate).not.toHaveBeenCalled();
  });

  test('con sesión lleva al voluntariado (ahí se elige el monto)', () => {
    auth.user = VOLUNTARIO;
    montar({ funding_goal: 1000, current_funding: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'Donar' }));
    expect(navigate).toHaveBeenCalledWith('/project/p1');
  });

  test('meta cumplida: el botón lo dice y sigue llevando al voluntariado', () => {
    auth.user = VOLUNTARIO;
    montar({ funding_goal: 1000, current_funding: 1000 });
    fireEvent.click(screen.getByRole('button', { name: 'Meta cumplida' }));
    expect(navigate).toHaveBeenCalledWith('/project/p1');
  });
});

describe('FeedPostCard: seguir y reseñas', () => {
  test('ONG y empresa no ven el botón de seguir', () => {
    auth.user = { ...VOLUNTARIO, role: 'ngo' };
    montar();
    expect(screen.queryByTitle('Seguir voluntariado')).not.toBeInTheDocument();
  });

  test('sin sesión, seguir pide iniciarla', () => {
    montar();
    fireEvent.click(screen.getByTitle('Seguir voluntariado'));
    expect(auth.openAuthModal).toHaveBeenCalledWith('Iniciá sesión para seguir este voluntariado');
    expect(api.follows.followProject).not.toHaveBeenCalled();
  });

  test('seguir: el botón cambia y los seguidores se actualizan con los del servidor', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.follows.followProject).mockResolvedValue({ followers: 8 } as never);
    montar({ followers: 7 });
    fireEvent.click(screen.getByTitle('Seguir voluntariado'));
    expect(await screen.findByTitle('Dejar de seguir voluntariado')).toHaveAttribute('aria-pressed', 'true');
    abrir();
    expect(screen.getByText('8 seguidores · 0 comentarios')).toBeInTheDocument();
  });

  test('dejar de seguir (seguía por los dos lados): manda la baja y usa los seguidores del servidor', async () => {
    auth.user = VOLUNTARIO;
    // El servidor dice 0 (no 3 − 1): así se distingue usar su número de restar uno localmente
    vi.mocked(api.follows.unfollowProject).mockResolvedValue({ followers: 0 } as never);
    montar({ follow_source: 'both', followers: 3 });
    fireEvent.click(screen.getByTitle('Dejar de seguir voluntariado'));
    expect(await screen.findByTitle('Seguir voluntariado')).toBeInTheDocument();
    expect(api.follows.unfollowProject).toHaveBeenCalledWith('p1');
    abrir();
    expect(screen.getByText('0 seguidores · 0 comentarios')).toBeInTheDocument();
  });

  test('si seguir falla, el error y el botón no cambia', async () => {
    auth.user = VOLUNTARIO;
    vi.mocked(api.follows.followProject).mockRejectedValue(new Error('Ya lo seguís'));
    montar();
    fireEvent.click(screen.getByTitle('Seguir voluntariado'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya lo seguís');
    expect(screen.getByTitle('Seguir voluntariado')).toHaveAttribute('aria-pressed', 'false');
  });

  test('el puntaje abre las reseñas; al calificar, la tarjeta muestra el nuevo promedio; se cierran', async () => {
    montar({ avg_rating: 4, ratings_count: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Ver reseñas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'calificar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Puntaje 4,5, 3 reseñas. Ver reseñas' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'cerrar reseñas' }));
    expect(screen.queryByRole('dialog', { name: 'Reseñas' })).not.toBeInTheDocument();
  });
});
