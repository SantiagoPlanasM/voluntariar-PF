// src/app/components/NgoPanelLink.test.tsx
//
// REVISION.md F16: ProjectDetails le ofrecía "Ver en panel ONG" a CUALQUIER ONG, también en proyectos
// (rediseño, §240: el link ahora dice "Ver en el panel")
// ajenos (el panel respondía 403). Ahora solo si el backend dice `can_manage: true` (es la ONG dueña).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const auth = { user: { id: 'u-ngo', name: 'Sustentando', email: 'n@example.org', role: 'ngo' }, openAuthModal: vi.fn() };
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

const mountWith = (can_manage: boolean) => {
  vi.mocked(api.projects.get).mockResolvedValue({
    project: { id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación Urbana', status: 'active', type: 'fugaz', comments: [], ratings: [], kpis: [], can_manage },
  } as never);
  render(
    <MemoryRouter initialEntries={['/project/proj-1']}>
      <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
    </MemoryRouter>
  );
};

describe('ProjectDetails: "Ver en panel ONG"', () => {
  test('la ONG dueña (can_manage) ve el link a su panel', async () => {
    mountWith(true);
    const links = await screen.findAllByRole('link', { name: 'Ver en el panel' });
    for (const a of links) expect(a).toHaveAttribute('href', '/ngo/dashboard/project/proj-1');
  });

  test('otra ONG no lo ve', async () => {
    mountWith(false);
    await waitFor(() => expect(screen.getAllByText('Reforestación Urbana').length).toBeGreaterThan(0));
    expect(screen.queryAllByRole('link', { name: 'Ver en el panel' })).toHaveLength(0);
  });
});
