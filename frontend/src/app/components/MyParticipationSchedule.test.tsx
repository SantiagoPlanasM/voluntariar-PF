// src/app/components/MyParticipationSchedule.test.tsx — "Próximos" en Mis voluntariados (§315): un voluntariado en el
// que ya me aceptaron, y que tiene fecha, muestra cuándo es y los links para agregarlo al calendario. Pendiente o sin
// fecha, no.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { UiProvider } from '../ui/UiProvider';
import type { EnrollmentWithProject } from '../../lib/api';

const auth = vi.hoisted(() => ({ user: { id: 'u-1', name: 'Ana', role: 'volunteer' }, openAuthModal: () => {} }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ReviewsModal', () => ({ ReviewsModal: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api,
    enrollments: { ...actual.api.enrollments, my: vi.fn() }, follows: { ...actual.api.follows, myProjects: vi.fn() } } };
});
import { api } from '../../lib/api';
import { formatDateOnly } from '../../lib/format';
import { MyParticipation } from './MyParticipation';

const item = (over: Partial<EnrollmentWithProject>): EnrollmentWithProject => ({
  id: 'enr-1', user_id: 'u-1', project_id: 'p-1', status: 'approved', created_at: '2026-10-01T10:00:00Z',
  title: 'Huerta comunitaria', category: 'Medio Ambiente', type: 'fugaz', location: 'Córdoba', project_status: 'active',
  ngo_name: 'ONG Verde', interview: null, ...over,
});
const mount = (items: EnrollmentWithProject[]) => {
  vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: items });
  return render(<UiProvider><MemoryRouter><MyParticipation /></MemoryRouter></UiProvider>);
};

beforeEach(() => { vi.mocked(api.follows.myProjects).mockResolvedValue({ projects: [] }); });

describe('Mis voluntariados: agregar al calendario (§315)', () => {
  test('aceptado y con fecha: cuándo es, Google Calendar y el .ics', async () => {
    mount([item({ start_date: '2030-03-10', end_date: '2030-03-12' })]);
    // La pantalla se vuelve a dibujar varias veces al cargar (salta a "Próximos", llegan los seguidos): no se guarda
    // la fila, que puede quedar vieja; se consulta la pantalla, que tiene un solo voluntariado.
    await waitFor(() => expect(
      screen.getByText(`Del ${formatDateOnly('2030-03-10')} al ${formatDateOnly('2030-03-12')}`),
    ).toBeInTheDocument());
    const google = new URL(screen.getByRole('link', { name: 'Agregar a Google Calendar' }).getAttribute('href')!);
    expect(google.searchParams.get('dates')).toBe('20300310/20300313');
    expect(google.searchParams.get('details')).toContain('/project/p-1');
    expect(screen.getByRole('link', { name: 'Descargar .ics' })).toHaveAttribute('download', 'voluntariado.ics');
  });

  test('aceptado sin fecha, o pendiente con fecha: sin links de calendario', async () => {
    mount([
      item({ id: 'enr-a', project_id: 'p-a', title: 'Sin fecha' }),
      item({ id: 'enr-b', project_id: 'p-b', title: 'Pendiente con fecha', status: 'pending', start_date: '2030-03-10' }),
    ]);
    await screen.findByText('Sin fecha');
    expect(screen.queryByRole('link', { name: 'Agregar a Google Calendar' })).toBeNull();
    // La pendiente está en "Postulaciones": tampoco ahí.
    fireEvent.click(screen.getByRole('tab', { name: /Postulaciones/ }));
    await screen.findByText('Pendiente con fecha');
    expect(screen.queryByRole('link', { name: 'Agregar a Google Calendar' })).toBeNull();
  });
});
