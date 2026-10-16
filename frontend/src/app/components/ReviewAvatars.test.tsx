// src/app/components/ReviewAvatars.test.tsx
//
// §133: las listas de reseñas (ReviewsModal y la pestaña Reseñas de ProjectDetails) mostraban solo la inicial.
// Ahora, si quien calificó tiene foto (`user_avatar`, que el backend manda en todas las reseñas), se ve la foto;
// si no, la inicial como antes. La foto es decorativa (alt=""): el nombre está al lado.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, openAuthModal: vi.fn(), initializing: false }) }));
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn() },
      follows: { ...actual.api.follows, projectStatus: vi.fn().mockResolvedValue({ following: false }) },
    },
  };
});

import { api } from '../../lib/api';
import { ReviewsModal } from './ReviewsModal';
import { ProjectDetails } from './ProjectDetails';

const ratings = [
  { id: 'r1', user_id: 'u-ana', user_name: 'Ana', user_avatar: 'https://img/ana.jpg', rating: 5, comment: 'Lindo', created_at: '2026-10-10 12:00:00' },
  { id: 'r2', user_id: 'u-beto', user_name: 'Beto', user_avatar: null, rating: 4, comment: 'Bien', created_at: '2026-10-09 12:00:00' },
];
vi.mocked(api.projects.get).mockResolvedValue({
  project: {
    id: 'proj-1', ngo_id: 'ngo-1', title: 'Huerta', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
    type: 'fugaz', status: 'active', modality: 'presencial', volunteers_needed: 5, current_volunteers: 0,
    cost_per_person: 0, ngo_name: 'Sustentando', comments: [], kpis: [], ratings, avg_rating: 4.5,
  },
} as never);

// Cada reseña: la foto (si hay) o la inicial, en la misma fila que el nombre.
const rowOf = (name: string) => {
  let el: HTMLElement | null = screen.getAllByText(name)[0];
  while (el && !el.querySelector('img, [data-initial]')) el = el.parentElement;
  return el!;
};

describe('avatar en las reseñas', () => {
  test('ReviewsModal: foto si la hay, inicial si no', async () => {
    render(<MemoryRouter><ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Huerta" /></MemoryRouter>);
    await screen.findByText('Ana');
    const ana = rowOf('Ana');
    expect(ana.querySelector('img')).toHaveAttribute('src', 'https://img/ana.jpg');
    expect(ana.querySelector('img')).toHaveAttribute('alt', '');
    const beto = rowOf('Beto');
    expect(beto.querySelector('img')).toBeNull();
    expect(beto.querySelector('[data-initial]')).toHaveTextContent('B');
  });

  test('ProjectDetails (pestaña Reseñas): foto si la hay, inicial si no', async () => {
    render(
      <MemoryRouter initialEntries={['/project/proj-1']}>
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /^Reseñas \(/ }));
    await screen.findAllByText('Ana');
    const ana = rowOf('Ana');
    expect(ana.querySelector('img')).toHaveAttribute('src', 'https://img/ana.jpg');
    expect(ana.querySelector('img')).toHaveAttribute('alt', '');
    const beto = rowOf('Beto');
    expect(beto.querySelector('img')).toBeNull();
    expect(beto.querySelector('[data-initial]')).toHaveTextContent('B');
  });
});
