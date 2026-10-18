// src/app/components/MyParticipation.test.tsx — "Mis Participaciones" del voluntario (TP de Calidad, cobertura del frontend, §210).
// (La reseña desde esta pantalla ya tiene su test: MyParticipationReview.test.tsx.)
// Criterio de aceptación (antes de escribir los casos):
//  - sin sesión: el aviso y "Iniciar sesión" abre el modal; una ONG va a su panel y una empresa a su perfil (sin pedir
//    inscripciones);
//  - los filtros (Todas/Pendientes/Aprobadas/Rechazadas) muestran su cantidad y solo lo suyo; vacío, el mensaje de
//    cada filtro (y "Explorar proyectos" solo en "Todas"); si falla la carga, se ve como vacío;
//  - cada inscripción: foto o ícono, estado (uno desconocido se ve como "Rechazado"), horas verificadas en singular
//    o plural solo si está aprobada;
//  - "Cancelar" solo en las pendientes, con confirmación: cancelada desaparece; si falla, avisa.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth, navigate } = vi.hoisted(() => ({
  auth: { user: null as null | Record<string, unknown>, openAuthModal: vi.fn() },
  navigate: vi.fn(),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, enrollments: { ...actual.api.enrollments, my: vi.fn(), cancel: vi.fn() } } };
});

import { api } from '../../lib/api';
import { MyParticipation } from './MyParticipation';

const insc = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, project_id: 'p-' + id, status, title: 'Proyecto ' + id, ngo_name: 'Sustentando', location: 'Córdoba',
  category: 'Ambiente', image: null, hours_logged: 0, ...extra,
});
const montar = () => render(<MemoryRouter><MyParticipation /></MemoryRouter>);
const filtro = (nombre: RegExp) => screen.getByRole('button', { name: nombre });

let confirmSpy: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  auth.user = { id: 'u1', name: 'María', role: 'volunteer' };
  auth.openAuthModal.mockReset();
  navigate.mockReset();
  vi.mocked(api.enrollments.my).mockReset().mockResolvedValue({
    enrollments: [
      insc('1', 'pending'),
      insc('2', 'approved', { image: 'https://x/2.jpg', hours_logged: 1 }),
      insc('3', 'approved', { hours_logged: 5 }),
      insc('4', 'rejected'),
    ],
  } as never);
  vi.mocked(api.enrollments.cancel).mockReset().mockResolvedValue({} as never);
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { confirmSpy.mockRestore(); alertSpy.mockRestore(); });

describe('MyParticipation: según la sesión', () => {
  test('sin sesión: el aviso, y "Iniciar sesión" abre el modal', () => {
    auth.user = null;
    montar();
    expect(screen.getByText('Iniciá sesión para ver tus participaciones')).toBeInTheDocument();
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

describe('MyParticipation: lista y filtros', () => {
  test('cada filtro muestra su cantidad y solo lo suyo', async () => {
    // Arrange / Act
    montar();
    await screen.findByText('Proyecto 1');
    // Assert: cantidades
    expect(filtro(/Todas/)).toHaveTextContent('4');
    expect(filtro(/Pendientes/)).toHaveTextContent('1');
    expect(filtro(/Aprobadas/)).toHaveTextContent('2');
    expect(filtro(/Rechazadas/)).toHaveTextContent('1');
    // y el filtrado
    fireEvent.click(filtro(/Aprobadas/));
    expect(screen.queryByText('Proyecto 1')).not.toBeInTheDocument();
    expect(screen.getByText('Proyecto 2')).toBeInTheDocument();
    expect(screen.getByText('Proyecto 3')).toBeInTheDocument();
    fireEvent.click(filtro(/Rechazadas/));
    expect(screen.getByText('Proyecto 4')).toBeInTheDocument();
    expect(screen.queryByText('Proyecto 2')).not.toBeInTheDocument();
  });

  test('foto o ícono, estado, horas en singular y plural, y los botones según el estado', async () => {
    montar();
    await screen.findByText('Proyecto 1');
    expect(screen.getByRole('img', { name: 'Proyecto 2' })).toHaveAttribute('src', 'https://x/2.jpg');
    expect(screen.getByText(/1 hora verificada por la ONG/)).toBeInTheDocument();
    expect(screen.getByText(/5 horas verificadas por la ONG/)).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('Aprobado')).toHaveLength(2);
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Reseña/ })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Ver proyecto' })[0]).toHaveAttribute('href', '/project/p-1');
  });

  test('un estado desconocido se ve como "Rechazado"; horas en una no aprobada no se muestran', async () => {
    vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [insc('9', 'cancelled'), insc('8', 'raro', { hours_logged: 3 })] } as never);
    montar();
    await screen.findByText('Proyecto 9');
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.queryByText(/horas verificadas/)).not.toBeInTheDocument();
  });

  test.each([
    [/Pendientes/, 'Sin participaciones pendientes'],
    [/Aprobadas/, 'Sin participaciones aprobadas'],
    [/Rechazadas/, 'Sin participaciones rechazadas'],
  ])('vacío en el filtro %s: "%s", sin link a explorar', async (f, texto) => {
    vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [] } as never);
    montar();
    await screen.findByText('No participaste en ningún proyecto aún');
    fireEvent.click(filtro(f));
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Explorar proyectos/ })).not.toBeInTheDocument();
  });

  test('si falla la carga, se ve vacío con el link a explorar', async () => {
    vi.mocked(api.enrollments.my).mockRejectedValue(new Error('caído'));
    montar();
    expect(await screen.findByText('No participaste en ningún proyecto aún')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explorar proyectos/ })).toHaveAttribute('href', '/feed');
  });
});

describe('MyParticipation: cancelar', () => {
  test('si no se confirma, no se cancela', async () => {
    confirmSpy.mockReturnValue(false);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(confirmSpy).toHaveBeenCalledWith('¿Cancelar tu inscripción a este proyecto?');
    expect(api.enrollments.cancel).not.toHaveBeenCalled();
    expect(screen.getByText('Proyecto 1')).toBeInTheDocument();
  });

  test('confirmado: se cancela y desaparece', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Proyecto 1')).not.toBeInTheDocument());
    expect(api.enrollments.cancel).toHaveBeenCalledWith('1');
    expect(filtro(/Todas/)).toHaveTextContent('3');
  });

  test('si falla, avisa con el mensaje y la inscripción sigue', async () => {
    vi.mocked(api.enrollments.cancel).mockRejectedValue(new Error('Ya fue aprobada'));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Ya fue aprobada'));
    expect(screen.getByText('Proyecto 1')).toBeInTheDocument();
  });
});
