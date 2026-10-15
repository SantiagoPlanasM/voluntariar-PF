// src/app/components/ReviewsModal.test.tsx
//
// REVISION S1 (segunda pasada): si la carga de las reseñas fallaba, el error se tragaba y el modal decía
// "Sin reseñas todavía", como si nadie hubiera calificado. Ahora se ve el error, con "Reintentar".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' } as Record<string, unknown> | null, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), rate: vi.fn() } } };
});

import { api, ApiError } from '../../lib/api';
import { ReviewsModal } from './ReviewsModal';

const juan = { id: 'r1', user_id: 'u-juan', user_name: 'Juan Pérez', rating: 5, comment: 'Muy bueno', created_at: '2026-10-10 12:00:00' };

const open = () => render(
  <MemoryRouter>
    <ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación" />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.mocked(api.projects.get).mockReset();
  vi.mocked(api.projects.rate).mockReset();
});

describe('ReviewsModal: error al cargar las reseñas (S1)', () => {
  test('un 500 muestra el error y "Reintentar", no "Sin reseñas todavía"; reintentar carga la lista', async () => {
    vi.mocked(api.projects.get)
      .mockRejectedValueOnce(new ApiError('Error al obtener el proyecto', 500))
      .mockResolvedValueOnce({ project: { ratings: [juan] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Error al obtener el proyecto')).toBeInTheDocument();
    expect(within(d).queryByText('Sin reseñas todavía')).not.toBeInTheDocument();
    expect(within(d).queryByText(/0 reseñas en total/)).not.toBeInTheDocument();

    fireEvent.click(within(d).getByRole('button', { name: /Reintentar/ }));
    expect(await within(d).findByText('Muy bueno')).toBeInTheDocument();
    expect(within(d).queryByText('Error al obtener el proyecto')).not.toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(api.projects.get).toHaveBeenCalledTimes(2);
  });

  test('sin conexión (fetch tira TypeError): mensaje en español, no el texto técnico', async () => {
    vi.mocked(api.projects.get).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('No pudimos cargar las reseñas. Revisá tu conexión.')).toBeInTheDocument();
    expect(within(d).queryByText('Failed to fetch')).not.toBeInTheDocument();
    expect(within(d).queryByText('Sin reseñas todavía')).not.toBeInTheDocument();
  });

  test('si de verdad no hay reseñas, sigue diciendo "Sin reseñas todavía" (sin error)', async () => {
    vi.mocked(api.projects.get).mockResolvedValueOnce({ project: { ratings: [] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas y Calificaciones' });
    expect(await within(d).findByText('Sin reseñas todavía')).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });
});
