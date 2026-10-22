// src/app/components/CommentMaxLength.test.tsx
//
// §151: desde §148 el backend rechaza un comentario de proyecto de más de 1000 caracteres (400 al enviar).
// Los dos campos de comentario (detalle del proyecto y tarjeta del feed) no limitaban: ahora tienen el mismo tope.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' }, openAuthModal: vi.fn() }),
}));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: {
        ...actual.api.projects,
        get: vi.fn().mockResolvedValue({
          project: {
            id: 'proj-1', ngo_id: 'ngo-1', title: 'Proyecto 1', status: 'active', type: 'fugaz',
            comments: [], kpis: [], ratings: [], avg_rating: 0, my_enrollment: null,
          },
        }),
        comment: vi.fn(),
      },
      follows: { ...actual.api.follows, projectStatus: vi.fn().mockResolvedValue({ following: false }) },
      posts: { ...actual.api.posts, list: vi.fn().mockResolvedValue({ posts: [] }) },
    },
  };
});

import { ProjectDetails } from './ProjectDetails';
import { FeedPostCard } from './FeedPostCard';

describe('Comentarios de proyecto: el tope de 1000 del backend también en los campos', () => {
  test('detalle del proyecto (sección Comentarios): maxLength 1000', async () => {
    render(
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /^Comentarios/ });
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toHaveAttribute('maxLength', '1000');
  });

  test('tarjeta del feed: maxLength 1000', () => {
    const project = {
      id: 'proj-1', ngo_id: 'ngo-1', ngo_name: 'Sustentando', title: 'Reforestación', description: 'Plantamos árboles',
      type: 'fugaz', status: 'active', category: 'Medio Ambiente', location: 'Córdoba', volunteers_needed: 10,
      current_volunteers: 0, recent_comments: [], comments_count: 0, ratings: [], avg_rating: 0, ratings_count: 0,
      roles_needed: [], requirements: [], created_at: '2026-10-10 12:00:00',
    };
    render(<MemoryRouter><FeedPostCard project={project as never} onRefresh={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Más información/ }));
    expect(screen.getByRole('textbox', { name: 'Comentario' })).toHaveAttribute('maxLength', '1000');
  });
});
