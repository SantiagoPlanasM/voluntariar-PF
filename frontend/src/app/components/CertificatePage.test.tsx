// src/app/components/CertificatePage.test.tsx — certificado de participación (§269).
//
// Criterio: /certificado/:enrollmentId muestra, para una postulación propia APROBADA en un voluntariado FINALIZADO,
// el nombre de quien participó, el voluntariado, la ONG, las horas verificadas (si hay) y la fecha de emisión, con
// "Imprimir o guardar como PDF" (window.print). Si la postulación no es propia, no está aprobada o el voluntariado no
// terminó (activo o cancelado): un aviso, sin certificado. En "Mis voluntariados" → Realizados, el acceso aparece
// solo en los finalizados.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { UiProvider } from '../ui/UiProvider';
import type { EnrollmentWithProject } from '../../lib/api';

const auth = vi.hoisted(() => ({ user: { id: 'u-1', name: 'Lucía Gómez', role: 'volunteer' } as Record<string, unknown> | null, openAuthModal: () => {} }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ReviewsModal', () => ({ ReviewsModal: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api,
    enrollments: { ...actual.api.enrollments, my: vi.fn() }, follows: { ...actual.api.follows, myProjects: vi.fn() } } };
});
import { api } from '../../lib/api';
import { CertificatePage } from './CertificatePage';
import { MyParticipation } from './MyParticipation';

const item = (over: Partial<EnrollmentWithProject> = {}): EnrollmentWithProject => ({
  id: 'enr-1', user_id: 'u-1', project_id: 'p-1', status: 'approved', created_at: '2026-09-01T10:00:00Z',
  title: 'Huerta comunitaria', category: 'Medio Ambiente', type: 'fugaz', location: 'Córdoba', project_status: 'completed',
  ngo_name: 'ONG Verde', hours_logged: 12, interview: null, ...over,
});
const mount = (items: EnrollmentWithProject[]) => {
  vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: items });
  return render(<MemoryRouter initialEntries={['/certificado/enr-1']}><Routes>
    <Route path="/certificado/:enrollmentId" element={<CertificatePage />} />
  </Routes></MemoryRouter>);
};

beforeEach(() => {
  auth.user = { id: 'u-1', name: 'Lucía Gómez', role: 'volunteer' };
  vi.mocked(api.follows.myProjects).mockResolvedValue({ projects: [] });
});

describe('Certificado de participación', () => {
  test('aprobada en un voluntariado finalizado: nombre, voluntariado, ONG, horas y fecha; imprimir', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    mount([item()]);
    const cert = await screen.findByRole('article', { name: 'Certificado de participación' });
    expect(within(cert).getByText('Lucía Gómez')).toBeInTheDocument();
    expect(within(cert).getByText('Huerta comunitaria')).toBeInTheDocument();
    expect(within(cert).getByText(/ONG Verde/)).toBeInTheDocument();
    expect(within(cert).getByText('12 horas verificadas por la ONG')).toBeInTheDocument();
    expect(within(cert).getByText(/Emitido el \d{1,2} de \w+ de \d{4}/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir o guardar como PDF' }));
    expect(print).toHaveBeenCalled();
  });

  test('una hora va en singular, y sin horas no se menciona', async () => {
    mount([item({ hours_logged: 1 })]);
    expect(await screen.findByText('1 hora verificada por la ONG')).toBeInTheDocument();
  });

  test('sin horas cargadas no dice "0 horas"', async () => {
    mount([item({ hours_logged: 0 })]);
    await screen.findByRole('article', { name: 'Certificado de participación' });
    expect(screen.queryByText(/hora/)).not.toBeInTheDocument();
  });

  test('pendiente, activo, cancelado o ajeno: aviso sin certificado', async () => {
    for (const over of [{ status: 'pending' as const }, { project_status: 'active' }, { project_status: 'cancelled' }, { id: 'otra' }]) {
      const { unmount } = mount([item(over)]);
      expect(await screen.findByText('Este certificado no está disponible')).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      unmount();
    }
  });

  test('sin sesión: pide iniciar sesión', async () => {
    auth.user = null;
    mount([item()]);
    expect(await screen.findByText('Iniciá sesión para ver tu certificado.')).toBeInTheDocument();
  });
});

describe('Mis voluntariados → Realizados: el acceso al certificado', () => {
  test('solo en los voluntariados finalizados', async () => {
    vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [
      item(), item({ id: 'enr-2', project_id: 'p-2', title: 'Colecta cancelada', project_status: 'cancelled' })] });
    render(<UiProvider><MemoryRouter><MyParticipation /></MemoryRouter></UiProvider>);
    fireEvent.click(await screen.findByRole('tab', { name: /Realizados/ }));
    expect(await screen.findByRole('link', { name: 'Certificado de Huerta comunitaria' })).toHaveAttribute('href', '/certificado/enr-1');
    expect(screen.queryByRole('link', { name: 'Certificado de Colecta cancelada' })).not.toBeInTheDocument();
  });
});
