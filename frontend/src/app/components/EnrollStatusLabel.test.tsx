// src/app/components/EnrollStatusLabel.test.tsx
//
// REVISION.md F8: en ProjectDetails, una inscripción RECHAZADA se mostraba "Inscripto · Pendiente" para
// siempre (el texto solo distinguía 'approved' de "cualquier otra cosa"). Como `enrollments` tiene
// UNIQUE(user_id, project_id), no se puede volver a postular: el botón tiene que decir que fue rechazada.
// Rediseño (§240, DESIGN.md → Estados de los botones): "No seleccionado", "Postulado" y "Vas a ir" (este último no es
// un botón: no hay nada para tocar).
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
  test('rechazada → "No seleccionado", no "Postulado" ni "Inscribirme"', async () => {
    mountWith('rejected');
    const buttons = await screen.findAllByRole('button', { name: 'No seleccionado' });
    for (const b of buttons) expect(b).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Postulado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
  });

  test('pendiente → "Postulado" (deshabilitado)', async () => {
    mountWith('pending');
    const buttons = await screen.findAllByRole('button', { name: 'Postulado' });
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toBeDisabled();
  });

  test('aprobada → "Vas a ir"', async () => {
    mountWith('approved');
    expect((await screen.findAllByText('Vas a ir')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).not.toBeInTheDocument();
  });
});
