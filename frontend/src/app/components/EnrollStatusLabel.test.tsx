// src/app/components/EnrollStatusLabel.test.tsx
//
// REVISION.md F8: en ProjectDetails, una inscripción RECHAZADA se mostraba "Inscripto · Pendiente" para
// siempre (el texto solo distinguía 'approved' de "cualquier otra cosa"). Como `enrollments` tiene
// UNIQUE(user_id, project_id), no se puede volver a postular: el botón tiene que decir que fue rechazada.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-vol', name: 'María', email: 'm@example.com', role: 'volunteer' }, openAuthModal: vi.fn() }),
}));

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

const mountWith = (status: 'pending' | 'approved' | 'rejected') => {
  vi.mocked(api.projects.get).mockResolvedValue({
    project: {
      id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación Urbana', status: 'active', type: 'fugaz',
      comments: [], ratings: [], kpis: [], my_enrollment: { id: 'e1', status },
    },
  } as never);
  render(
    <MemoryRouter initialEntries={['/project/proj-1']}>
      <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
    </MemoryRouter>
  );
};

describe('ProjectDetails: estado de la inscripción propia', () => {
  test('rechazada → "Inscripción rechazada", no "Pendiente"', async () => {
    mountWith('rejected');
    const buttons = await screen.findAllByRole('button', { name: /Inscripción rechazada/ });
    for (const b of buttons) expect(b).toBeDisabled();
    expect(screen.queryByText(/Inscripto · Pendiente/)).not.toBeInTheDocument();
  });

  test('pendiente → "Inscripto · Pendiente"', async () => {
    mountWith('pending');
    expect((await screen.findAllByRole('button', { name: 'Inscripto · Pendiente' })).length).toBeGreaterThan(0);
  });

  test('aprobada → "Inscripto · Aprobado"', async () => {
    mountWith('approved');
    expect((await screen.findAllByRole('button', { name: 'Inscripto · Aprobado' })).length).toBeGreaterThan(0);
  });
});
