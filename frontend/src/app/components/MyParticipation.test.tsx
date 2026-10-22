// src/app/components/MyParticipation.test.tsx — "Mis voluntariados" del voluntario (TP de Calidad, cobertura del frontend, §210).
// Reescrito en el rediseño (§240): los filtros Todas/Pendientes/Aprobadas/Rechazadas pasaron a cuatro pestañas
// (DESIGN.md → Mis voluntariados) y "Cancelar" pasó al menú "···" con un diálogo propio.
// (La reseña desde esta pantalla ya tiene su test: MyParticipationReview.test.tsx.)
// Criterio de aceptación (antes de escribir los casos):
//  - sin sesión: el aviso y "Iniciar sesión" abre el modal; una ONG va a su panel y una empresa a su perfil (sin pedir
//    inscripciones);
//  - pestañas: Próximos (aprobadas en voluntariados activos), Postulaciones (todas menos las canceladas),
//    Seguidos (los voluntariados que sigo) y Realizados (aprobadas en voluntariados terminados, con "Dejá tu
//    reseña"); cada una con su cantidad. Si hay algo próximo, se empieza por Próximos; si no, por Postulaciones;
//  - vacío: el mensaje de cada pestaña (y "Explorar voluntariados" salvo en Realizados); si falla la carga, el
//    error con "Reintentar" (no la lista vacía);
//  - cada fila: foto o logo, estado (uno desconocido se ve como "No seleccionado"), horas verificadas en singular o
//    plural solo si hay horas;
//  - "Cancelar postulación" solo en las pendientes, con confirmación: cancelada desaparece y avisa; si falla, avisa.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { UiProvider } from '../ui/UiProvider';

const { auth, navigate } = vi.hoisted(() => ({
  auth: { user: null as null | Record<string, unknown>, openAuthModal: vi.fn() },
  navigate: vi.fn(),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
vi.mock('./ReviewsModal', () => ({
  ReviewsModal: ({ projectTitle, onClose }: { projectTitle: string; onClose: () => void }) => (
    <div role="dialog" aria-label={`Reseñas de ${projectTitle}`}><button onClick={onClose}>cerrar reseñas</button></div>
  ),
}));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      enrollments: { ...actual.api.enrollments, my: vi.fn(), cancel: vi.fn() },
      follows: { ...actual.api.follows, myProjects: vi.fn() },
    },
  };
});

import { api } from '../../lib/api';
import { MyParticipation } from './MyParticipation';

const insc = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, project_id: 'p-' + id, status, title: 'Proyecto ' + id, ngo_name: 'Sustentando', location: 'Córdoba, Argentina',
  category: 'Ambiente', image: null, hours_logged: 0, project_status: 'active', ...extra,
});
const seguido = (id: string, title: string) => ({
  id, ngo_id: 'n1', ngo_name: 'Sustentando', title, description: '', category: 'Ambiente', location: 'Córdoba', type: 'fugaz',
  status: 'active', volunteers_needed: 5, current_volunteers: 0, funding_goal: 0, current_funding: 0, cost_per_person: 0,
});
const montar = () => render(<MemoryRouter><UiProvider><MyParticipation /></UiProvider></MemoryRouter>);
const pestaña = (nombre: RegExp) => screen.getByRole('tab', { name: nombre });
const panel = () => screen.getByRole('tabpanel');

beforeEach(() => {
  auth.user = { id: 'u1', name: 'María', role: 'volunteer' };
  auth.openAuthModal.mockReset();
  navigate.mockReset();
  vi.mocked(api.enrollments.my).mockReset().mockResolvedValue({
    enrollments: [
      insc('1', 'pending'),
      insc('2', 'approved', { image: 'https://x/2.jpg', hours_logged: 1 }),
      insc('3', 'approved', { hours_logged: 5, project_status: 'completed' }),
      insc('4', 'rejected'),
      insc('5', 'cancelled'),
    ],
  } as never);
  vi.mocked(api.enrollments.cancel).mockReset().mockResolvedValue({} as never);
  vi.mocked(api.follows.myProjects).mockReset().mockResolvedValue({ projects: [seguido('f1', 'Comedor del barrio')] } as never);
});

describe('MyParticipation: según la sesión', () => {
  test('sin sesión: el aviso, y "Iniciar sesión" abre el modal', () => {
    auth.user = null;
    montar();
    expect(screen.getByText('Iniciá sesión para ver tus postulaciones y lo que seguís.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
    expect(api.enrollments.my).not.toHaveBeenCalled();
  });

  test.each([
    ['ngo', '/ngo/dashboard'],
    ['company', '/company/profile'],
  ])('rol %s: va a %s sin pedir inscripciones', (role, ruta) => {
    auth.user = { id: 'x', name: 'X', role };
    montar();
    expect(navigate).toHaveBeenCalledWith(ruta, { replace: true });
    expect(api.enrollments.my).not.toHaveBeenCalled();
  });
});

describe('MyParticipation: pestañas', () => {
  test('cada pestaña muestra su cantidad y solo lo suyo; con algo próximo se empieza por Próximos', async () => {
    // Arrange / Act
    montar();
    await within(panel()).findByText('Proyecto 2');
    // Assert: cantidades (Postulaciones no cuenta la cancelada)
    expect(pestaña(/Próximos/)).toHaveTextContent('Próximos · 1');
    expect(pestaña(/Postulaciones/)).toHaveTextContent('Postulaciones · 4');
    expect(pestaña(/Seguidos/)).toHaveTextContent('Seguidos · 1');
    expect(pestaña(/Realizados/)).toHaveTextContent('Realizados · 1');
    expect(pestaña(/Próximos/)).toHaveAttribute('aria-selected', 'true');
    // Próximos: la aprobada en un voluntariado activo
    expect(within(panel()).queryByText('Proyecto 1')).not.toBeInTheDocument();
    expect(within(panel()).queryByText('Proyecto 3')).not.toBeInTheDocument();
    // Postulaciones: todas menos la cancelada
    fireEvent.click(pestaña(/Postulaciones/));
    for (const t of ['Proyecto 1', 'Proyecto 2', 'Proyecto 3', 'Proyecto 4']) expect(within(panel()).getByText(t)).toBeInTheDocument();
    expect(within(panel()).queryByText('Proyecto 5')).not.toBeInTheDocument();
    expect(within(panel()).getByText(/Las ONG suelen responder en pocos días/)).toBeInTheDocument();
    // Seguidos: la grilla de voluntariados
    fireEvent.click(pestaña(/Seguidos/));
    expect(within(panel()).getByText('Comedor del barrio')).toBeInTheDocument();
    // Realizados: la aprobada en un voluntariado terminado, con "Dejá tu reseña"
    fireEvent.click(pestaña(/Realizados/));
    expect(within(panel()).getByText('Proyecto 3')).toBeInTheDocument();
    expect(within(panel()).queryByText('Proyecto 2')).not.toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Dejá tu reseña' }));
    expect(screen.getByRole('dialog', { name: 'Reseñas de Proyecto 3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cerrar reseñas' }));
    expect(screen.queryByRole('dialog', { name: 'Reseñas de Proyecto 3' })).not.toBeInTheDocument();
  });

  test('sin nada próximo se empieza por Postulaciones', async () => {
    vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [insc('1', 'pending')] } as never);
    montar();
    await within(panel()).findByText('Proyecto 1');
    expect(pestaña(/Postulaciones/)).toHaveAttribute('aria-selected', 'true');
    expect(pestaña(/Próximos/)).toHaveTextContent(/^Próximos$/);   // sin cantidad cuando es 0
  });

  test('foto o logo, estado, horas en singular y plural, y el menú solo en las pendientes', async () => {
    vi.mocked(api.enrollments.my).mockResolvedValue({
      enrollments: [
        insc('1', 'pending'),
        insc('2', 'approved', { image: 'https://x/2.jpg', hours_logged: 1, project_status: 'completed' }),
        insc('3', 'approved', { hours_logged: 5, project_status: 'completed' }),
        insc('4', 'rejected'),
      ],
    } as never);
    const { container } = montar();
    await within(panel()).findByText('Proyecto 1');
    expect(container.querySelector('img[src="https://x/2.jpg"]')).toBeInTheDocument();
    expect(screen.getByText('1 hora verificada por la ONG')).toBeInTheDocument();
    expect(screen.getByText('5 horas verificadas por la ONG')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('Aceptado')).toHaveLength(2);
    expect(screen.getByText('No seleccionado')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Opciones de/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Proyecto 1/ })).toHaveAttribute('href', '/project/p-1');
    expect(screen.getAllByText('Sustentando · Córdoba')).toHaveLength(4);   // solo la ciudad
  });

  test('un estado desconocido se ve como "No seleccionado"; sin horas no hay línea de horas', async () => {
    vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [insc('8', 'raro', { hours_logged: 0, location: null })] } as never);
    montar();
    await within(panel()).findByText('Proyecto 8');
    expect(screen.getByText('No seleccionado')).toBeInTheDocument();
    expect(screen.queryByText(/verificad/)).not.toBeInTheDocument();
    expect(screen.getByText('Sustentando')).toBeInTheDocument();
  });

  test.each([
    [/Próximos/, 'Todavía no tenés voluntariados próximos', true],
    [/Postulaciones/, 'No te postulaste a ningún voluntariado', true],
    [/Seguidos/, 'Todavía no seguís ningún voluntariado', true],
    [/Realizados/, 'Todavía no realizaste voluntariados', false],
  ])('vacío en %s: "%s"', async (t, texto, conExplorar) => {
    vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [] } as never);
    vi.mocked(api.follows.myProjects).mockResolvedValue({ projects: [] } as never);
    montar();
    await screen.findByText('No te postulaste a ningún voluntariado');
    fireEvent.click(pestaña(t));
    expect(screen.getByText(texto)).toBeInTheDocument();
    const link = screen.queryByRole('link', { name: 'Explorar voluntariados' });
    if (conExplorar) expect(link).toHaveAttribute('href', '/explore');
    else expect(link).not.toBeInTheDocument();
  });

  test('si falla la carga: el error con "Reintentar", y reintentar la carga', async () => {
    vi.mocked(api.enrollments.my).mockRejectedValueOnce(new Error('caído'));
    montar();
    expect(await screen.findByText('caído')).toBeInTheDocument();
    expect(screen.queryByText('No te postulaste a ningún voluntariado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(within(panel()).getByText('Proyecto 2')).toBeInTheDocument());
  });

  test('si fallan solo los seguidos, el resto se ve igual', async () => {
    vi.mocked(api.follows.myProjects).mockRejectedValue(new Error('caído'));
    montar();
    await waitFor(() => expect(within(panel()).getByText('Proyecto 2')).toBeInTheDocument());
    expect(pestaña(/Seguidos/)).toHaveTextContent(/^Seguidos$/);
  });
});

describe('MyParticipation: cancelar postulación', () => {
  const pedirCancelar = async () => {
    await within(panel()).findByText('Proyecto 2');
    fireEvent.click(pestaña(/Postulaciones/));
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de Proyecto 1' }));
    expect(screen.getByRole('menuitem', { name: 'Ver voluntariado' })).toHaveAttribute('href', '/project/p-1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar postulación' }));
    return screen.findByRole('dialog', { name: '¿Cancelar tu postulación?' });
  };

  test('si no se confirma, no se cancela', async () => {
    montar();
    const d = await pedirCancelar();
    expect(within(d).getByText(/Sustentando deja de verla/)).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.enrollments.cancel).not.toHaveBeenCalled();
    expect(screen.getByText('Proyecto 1')).toBeInTheDocument();
  });

  test('confirmado: se cancela, desaparece y avisa', async () => {
    montar();
    const d = await pedirCancelar();
    fireEvent.click(within(d).getByRole('button', { name: 'Cancelar postulación' }));
    await waitFor(() => expect(screen.queryByText('Proyecto 1')).not.toBeInTheDocument());
    expect(api.enrollments.cancel).toHaveBeenCalledWith('1');
    expect(screen.getByRole('status')).toHaveTextContent('Cancelaste tu postulación a Proyecto 1');
    expect(pestaña(/Postulaciones/)).toHaveTextContent('Postulaciones · 3');
  });

  test('si falla, avisa con el mensaje y la postulación sigue', async () => {
    vi.mocked(api.enrollments.cancel).mockRejectedValue(new Error('Ya fue aprobada'));
    montar();
    const d = await pedirCancelar();
    fireEvent.click(within(d).getByRole('button', { name: 'Cancelar postulación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya fue aprobada');
    expect(screen.getByText('Proyecto 1')).toBeInTheDocument();
  });

  test('el menú "···" se cierra con un segundo toque', async () => {
    montar();
    await within(panel()).findByText('Proyecto 2');
    fireEvent.click(pestaña(/Postulaciones/));
    const btn = screen.getByRole('button', { name: 'Opciones de Proyecto 1' });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
