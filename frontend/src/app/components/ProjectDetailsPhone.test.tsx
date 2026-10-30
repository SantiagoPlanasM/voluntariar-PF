// src/app/components/ProjectDetailsPhone.test.tsx
//
// Teléfono de contacto opcional al postularse (§291, lo pidió FONBEC). El campo aparece solo para un voluntario con
// sesión que todavía puede postularse, y va con "Inscribirme". Vacío no se manda; el backend lo valida y su mensaje se
// muestra. Como los botones, el campo se dibuja dos veces (caja de escritorio y barra del celular, jsdom no aplica
// `md:hidden`): se usa el primero.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: null as Record<string, unknown> | null, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn() },
      enrollments: { ...actual.api.enrollments, enroll: vi.fn() },
      follows: { ...actual.api.follows, projectStatus: vi.fn().mockResolvedValue({ following: false }) },
      posts: { ...actual.api.posts, list: vi.fn().mockResolvedValue({ posts: [] }) },
    },
  };
});
import { api } from '../../lib/api';
import { ProjectDetails } from './ProjectDetails';

const project = (extra: Record<string, unknown> = {}) => ({
  project: {
    id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', status: 'active', type: 'fugaz', comments: [], kpis: [], ratings: [],
    avg_rating: 0, my_enrollment: null, funding_goal: 0, current_funding: 0, volunteers_needed: 10, current_volunteers: 2,
    ...extra,
  },
});
const mount = () => render(
  <MemoryRouter initialEntries={['/project/proj-1']}><Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes></MemoryRouter>);
const cargado = () => screen.findByRole('heading', { name: 'Cómo vamos' });
const LABEL = 'Teléfono de contacto (opcional)';
const as = (role: string | null) => { auth.user = role ? { id: `u-${role}`, name: 'X', email: 'x@x.com', role } : null; };

beforeEach(() => {
  vi.mocked(api.projects.get).mockReset().mockResolvedValue(project() as never);
  vi.mocked(api.enrollments.enroll).mockReset().mockResolvedValue({ enrollment: {} as never, message: 'ok' });
  auth.openAuthModal.mockReset();
});

describe('ProjectDetails: teléfono al postularse', () => {
  test('voluntario: el teléfono que escribe va con la postulación', async () => {
    as('volunteer');
    mount();
    const [field] = await screen.findAllByLabelText(LABEL);
    expect(field).toHaveAttribute('type', 'tel');
    fireEvent.change(field, { target: { value: '351 555 1234' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Inscribirme' })[0]);
    await waitFor(() => expect(api.enrollments.enroll).toHaveBeenCalledWith('proj-1', { phone: '351 555 1234' }));
  });

  test('los dos campos comparten el valor (escritorio y celular)', async () => {
    as('volunteer');
    mount();
    const fields = await screen.findAllByLabelText(LABEL);
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
    fireEvent.change(fields[1], { target: { value: '0351 4555555' } });
    expect(fields[0]).toHaveValue('0351 4555555');
  });

  test('vacío o solo espacios: no se manda', async () => {
    as('volunteer');
    mount();
    const [field] = await screen.findAllByLabelText(LABEL);
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Inscribirme' })[0]);
    await waitFor(() => expect(api.enrollments.enroll).toHaveBeenCalledWith('proj-1', {}));
  });

  test('el error del backend se muestra', async () => {
    as('volunteer');
    vi.mocked(api.enrollments.enroll).mockRejectedValue(new Error('Teléfono inválido: usá entre 6 y 15 números.'));
    mount();
    const [field] = await screen.findAllByLabelText(LABEL);
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Inscribirme' })[0]);
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Teléfono inválido');
  });

  test('sin sesión, ya postulado o con otro rol: no hay campo', async () => {
    for (const [role, extra] of [[null, {}], ['volunteer', { my_enrollment: { status: 'pending' } }], ['company', {}]] as const) {
      as(role);
      vi.mocked(api.projects.get).mockResolvedValue(project(extra) as never);
      const { unmount } = mount();
      await cargado();
      expect(screen.queryByLabelText(LABEL)).toBeNull();
      unmount();
    }
  });
});
