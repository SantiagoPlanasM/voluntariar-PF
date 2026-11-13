// src/app/components/ReviewsModalAverage.test.tsx — D37 (Issue #38, sesión exploratoria 2, §330).
//
// El promedio de la hoja de reseñas salía con punto ("4.5"); la tarjeta del feed y la página del voluntariado lo
// escriben con coma ("4,5").
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' }, openAuthModal: vi.fn() }),
}));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), rate: vi.fn() } } };
});

import { api } from '../../lib/api';
import { ReviewsModal } from './ReviewsModal';

const rating = (id: string, value: number) =>
  ({ id, user_id: `u-${id}`, user_name: `Persona ${id}`, rating: value, comment: 'Bien', created_at: '2026-10-10 12:00:00' });

const open = () => render(
  <MemoryRouter>
    <ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación" />
  </MemoryRouter>,
);

beforeEach(() => vi.mocked(api.projects.get).mockReset());

describe('Hoja de reseñas: el promedio', () => {
  test('con decimales va con coma: 5 y 4 dan "4,5"', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [rating('a', 5), rating('b', 4)] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('4,5')).toBeInTheDocument();
    expect(within(d).queryByText('4.5')).not.toBeInTheDocument();
  });

  test('entero también lleva un decimal: "5,0"', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { ratings: [rating('a', 5)] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('5,0')).toBeInTheDocument();
  });
});
