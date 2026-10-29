// src/app/components/MyParticipationInterview.test.tsx — la entrevista en "Mis voluntariados" (§262).
//
// Criterio: una postulación pendiente con entrevista PROGRAMADA muestra el chip "Entrevista" (vuelve el de DESIGN.md)
// y debajo la fecha, la hora, el lugar, la nota y el link (abre en otra pestaña), fuera del enlace al voluntariado.
// Una entrevista cancelada no cambia nada ("Pendiente"); una postulación aceptada sigue "Aceptado".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { UiProvider } from '../ui/UiProvider';
import type { EnrollmentWithProject, Interview } from '../../lib/api';

// El mismo objeto en cada render: la pantalla recarga cuando cambia `user`.
const auth = vi.hoisted(() => ({ user: { id: 'u-1', name: 'Ana', role: 'volunteer' }, openAuthModal: () => {} }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ReviewsModal', () => ({ ReviewsModal: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api,
    enrollments: { ...actual.api.enrollments, my: vi.fn() }, follows: { ...actual.api.follows, myProjects: vi.fn() } } };
});
import { api } from '../../lib/api';
import { MyParticipation } from './MyParticipation';

const item = (over: Partial<EnrollmentWithProject>): EnrollmentWithProject => ({
  id: 'enr-1', user_id: 'u-1', project_id: 'p-1', status: 'pending', created_at: '2026-10-01T10:00:00Z',
  title: 'Huerta comunitaria', category: 'Medio Ambiente', type: 'fugaz', location: 'Córdoba', project_status: 'active',
  ngo_name: 'ONG Verde', interview: null, ...over,
});
const interview = (over: Partial<Interview> = {}): Interview => ({
  id: 'int-1', enrollment_id: 'enr-1', date: '2030-03-10', time: '18:00', link: 'https://meet.google.com/abc',
  place: 'Sede de la ONG', note: 'Traé el DNI', status: 'scheduled', ...over,
});
const mount = (items: EnrollmentWithProject[]) => {
  vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: items });
  return render(<UiProvider><MemoryRouter><MyParticipation /></MemoryRouter></UiProvider>);
};
const filaDe = async (title: string) => (await screen.findByText(title)).closest('li')!;

beforeEach(() => {
  vi.mocked(api.follows.myProjects).mockResolvedValue({ projects: [] });
});

describe('Mis voluntariados: la entrevista', () => {
  test('pendiente con entrevista programada: chip "Entrevista", fecha, hora, lugar, nota y link', async () => {
    mount([item({ interview: interview() })]);
    const fila = await filaDe('Huerta comunitaria');
    expect(within(fila).getByText('Entrevista')).toBeInTheDocument();
    expect(within(fila).queryByText('Pendiente')).not.toBeInTheDocument();
    expect(within(fila).getByText(/10 de mar.*18:00/)).toBeInTheDocument();
    expect(within(fila).getByText(/Sede de la ONG/)).toBeInTheDocument();
    expect(within(fila).getByText(/Traé el DNI/)).toBeInTheDocument();
    const link = within(fila).getByRole('link', { name: 'Abrir el link de la entrevista' });
    expect(link).toHaveAttribute('href', 'https://meet.google.com/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.parentElement?.closest('a')).toBeNull(); // no queda adentro del enlace al voluntariado
  });

  test('entrevista cancelada: sigue "Pendiente" y sin datos de la entrevista', async () => {
    mount([item({ interview: interview({ status: 'cancelled' }) })]);
    const fila = await filaDe('Huerta comunitaria');
    expect(within(fila).getByText('Pendiente')).toBeInTheDocument();
    expect(within(fila).queryByText(/18:00/)).not.toBeInTheDocument();
  });

  test('aceptada: sigue "Aceptado"', async () => {
    mount([item({ status: 'approved', project_status: 'completed', interview: interview({ status: 'done' }) })]);
    fireEvent.click(await screen.findByRole('tab', { name: /Postulaciones/ }));
    const fila = await filaDe('Huerta comunitaria');
    expect(within(fila).getByText('Aceptado')).toBeInTheDocument();
  });
});
