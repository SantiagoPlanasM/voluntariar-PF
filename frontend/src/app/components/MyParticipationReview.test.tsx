// src/app/components/MyParticipationReview.test.tsx
//
// Había dos modales de reseña que hacían lo mismo (deuda conocida; decisión del usuario, §101): ReviewModal en
// "Mis participaciones" (solo el formulario) y ReviewsModal en el feed (reseñas de otros + formulario). Ahora
// "Mis participaciones" abre ReviewsModal con el formulario habilitado, y ReviewModal se borró.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => {
  const auth = { user: { id: 'u-vol', name: 'María', role: 'volunteer' }, openAuthModal: vi.fn() };
  return { useAuth: () => auth };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      enrollments: { ...actual.api.enrollments, my: vi.fn(), cancel: vi.fn() },
      projects: { ...actual.api.projects, get: vi.fn(), rate: vi.fn() },
    },
  };
});

import { api } from '../../lib/api';
import { MyParticipation } from './MyParticipation';

beforeEach(() => {
  vi.mocked(api.enrollments.my).mockResolvedValue({ enrollments: [{
    id: 'e1', project_id: 'proj-1', title: 'Reforestación Urbana', status: 'approved', category: 'Medio Ambiente',
    location: 'Córdoba', ngo_name: 'Sustentando', image: '', hours_logged: 4,
  }] } as never);
  vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [
    { id: 'r1', user_id: 'u-juan', user_name: 'Juan Pérez', rating: 5, comment: 'Muy bueno', created_at: '2026-10-10 12:00:00' },
  ] } } as never);
  vi.mocked(api.projects.rate).mockReset().mockResolvedValue({ rating: {} } as never);
});

describe('Mis participaciones: reseña', () => {
  test('"Reseña" abre el mismo modal que el feed: se ven las reseñas de otros y se puede dejar la propia', async () => {
    render(<MemoryRouter><MyParticipation /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Reseña/ }));
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Muy bueno')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: '4 estrellas' }));
    fireEvent.change(within(d).getByRole('textbox', { name: 'Tu reseña' }), { target: { value: 'Aprendí un montón' } });
    fireEvent.submit(within(d).getByRole('textbox', { name: 'Tu reseña' }).closest('form')!);
    await waitFor(() => expect(api.projects.rate).toHaveBeenCalledWith('proj-1', 4, 'Aprendí un montón'));
  });
});
