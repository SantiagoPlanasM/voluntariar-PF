// src/app/components/ProjectDetailsDonate.test.tsx
//
// Botón "Donar" en el detalle del proyecto (PLAN_FALTANTE.md, Etapa 9, §172). El backend deja donar a voluntarios y
// empresas en proyectos activos (§170): el botón aparece en esos casos y para un visitante (que primero inicia sesión).
// No aparece para una ONG ni en un proyecto que no está activo.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    avg_rating: 0, my_enrollment: null, funding_goal: 100000, current_funding: 20000, volunteers_needed: 10, current_volunteers: 2,
    ...extra,
  },
});
const mount = () => render(
  <MemoryRouter initialEntries={['/project/proj-1']}><Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes></MemoryRouter>);
const as = (role: string | null) => { auth.user = role ? { id: `u-${role}`, name: 'X', email: 'x@x.com', role } : null; };

beforeEach(() => {
  vi.mocked(api.projects.get).mockReset().mockResolvedValue(project() as never);
  auth.openAuthModal.mockReset();
});

describe('ProjectDetails: botón "Donar"', () => {
  test('voluntario: abre el modal de donación de ESE proyecto', async () => {
    as('volunteer');
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Donar a este proyecto' }));
    expect(screen.getByRole('dialog', { name: 'Donar a Reforestación' })).toBeInTheDocument();
  });

  test('empresa: también', async () => {
    as('company');
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Donar a este proyecto' }));
    expect(screen.getByRole('dialog', { name: 'Donar a Reforestación' })).toBeInTheDocument();
  });

  test('visitante: pide iniciar sesión (no abre el modal)', async () => {
    as(null);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Donar a este proyecto' }));
    expect(auth.openAuthModal).toHaveBeenCalledWith('Iniciá sesión para donar');
    expect(screen.queryByRole('dialog', { name: /Donar a/ })).toBeNull();
  });

  test('ONG: no aparece', async () => {
    as('ngo');
    mount();
    await screen.findByText('Progreso del proyecto');
    expect(screen.queryByRole('button', { name: 'Donar a este proyecto' })).toBeNull();
  });

  test('proyecto que no está activo: no aparece', async () => {
    as('volunteer');
    vi.mocked(api.projects.get).mockResolvedValue(project({ status: 'completed' }) as never);
    mount();
    await screen.findByText('Progreso del proyecto');
    expect(screen.queryByRole('button', { name: 'Donar a este proyecto' })).toBeNull();
  });

  test('aparece aunque el proyecto no tenga meta de financiamiento', async () => {
    as('volunteer');
    vi.mocked(api.projects.get).mockResolvedValue(project({ funding_goal: 0, current_funding: 0 }) as never);
    mount();
    expect(await screen.findByRole('button', { name: 'Donar a este proyecto' })).toBeInTheDocument();
  });
});
