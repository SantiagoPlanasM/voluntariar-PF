// src/app/components/MomentsPlacement.test.tsx
// Etapa 3: la galería del proyecto, la grilla del perfil y la moderación de la ONG, con el filtro correcto.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProjectDetails } from './ProjectDetails';
import { VolunteerPublicProfile } from './VolunteerPublicProfile';
import { NGOProjectDetail } from './NGOProjectDetail';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-viewer', name: 'V', email: 'v@x.com', role: 'volunteer' }, openAuthModal: vi.fn(), initializing: false }),
}));
vi.mock('./MomentsGrid', async () => {
  const React = await import('react');
  return { MomentsGrid: (p: { filters: object }) => React.createElement('div', { 'data-testid': 'grid' }, JSON.stringify(p.filters)) };
});
vi.mock('./MomentsFeed', async () => {
  const React = await import('react');
  return { MomentsFeed: (p: { filters: object; showComposer?: boolean }) =>
    React.createElement('div', { 'data-testid': 'feed' }, JSON.stringify({ ...p.filters, showComposer: p.showComposer })) };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  const project = {
    id: 'proj-7', ngo_id: 'ngo-1', title: 'Reforestación', description: 'd', full_description: 'd', category: 'Medio Ambiente',
    location: 'Córdoba', type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0,
    current_funding: 0, cost_per_person: 0, followers: 0, ngo_name: 'ONG', roles: [], requirements: [], comments: [], ratings: [],
    categories: [], tags: [], gallery: [], my_enrollment_status: null, is_following: false,
  };
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn().mockResolvedValue({ project }) },
      follows: { ...actual.api.follows,
        projectStatus: vi.fn().mockResolvedValue({ following: false }),
        volunteerFollowStatus: vi.fn().mockResolvedValue({ following: false }) },
      enrollments: { ...actual.api.enrollments, byProject: vi.fn().mockResolvedValue({ enrollments: [] }) },
      voluntarios: { ...actual.api.voluntarios, getProfile: vi.fn().mockResolvedValue({
        volunteer: { id: 'user-55', name: 'María', avatar: null, bio: '', location: '', followers: 0, following_count: 0 },
        habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [] }) },
    },
  };
});

const at = (path: string, route: string, el: React.ReactElement) =>
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>);

describe('Momentos en las pantallas', () => {
  test('ProjectDetails: galería filtrada por el proyecto', async () => {
    at('/project/proj-7', '/project/:id', <ProjectDetails />);
    expect(await screen.findByTestId('grid')).toHaveTextContent('{"project_id":"proj-7"}');
    expect(screen.getByRole('heading', { name: 'Momentos' })).toBeInTheDocument();
  });

  test('VolunteerPublicProfile: grilla filtrada por el id de USUARIO del perfil', async () => {
    at('/volunteer/user-55', '/volunteer/:id', <VolunteerPublicProfile />);
    expect(await screen.findByTestId('grid')).toHaveTextContent('{"user_id":"user-55"}');
  });

  test('NGOProjectDetail: feed del proyecto SIN compositor (la ONG modera desde ahí; publica en /ngo/momentos)', async () => {
    at('/ngo/dashboard/project/proj-7', '/ngo/dashboard/project/:projectId', <NGOProjectDetail />);
    expect(await screen.findByTestId('feed')).toHaveTextContent('{"project_id":"proj-7","showComposer":false}');
  });
});
