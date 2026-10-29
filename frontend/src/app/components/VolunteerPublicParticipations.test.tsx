// src/app/components/VolunteerPublicParticipations.test.tsx — los voluntariados en el perfil público (§271).
//
// Criterio: cada voluntariado de la lista dice sus horas verificadas por la ONG (si hay; "1 h" en singular no cambia)
// y su estado real: "Activo", "Finalizado" o "Cancelado" (antes un cancelado decía "Finalizado").
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => {
  const auth = { user: null, openAuthModal: vi.fn() };
  return { useAuth: () => auth };
});
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
const { part } = vi.hoisted(() => ({ part: (over: Record<string, unknown>) => ({
  enrollment_id: 'e', status: 'approved', horas_realizadas: 0, project_id: 'p', titulo: 'X', project_status: 'active',
  ubicacion: '', tipo: 'fugaz', ngo_name: 'ONG Verde', ...over,
}) }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api,
    follows: { ...actual.api.follows, volunteerFollowStatus: vi.fn().mockResolvedValue({ following: false }) },
    voluntarios: { ...actual.api.voluntarios, getProfile: vi.fn().mockResolvedValue({
      volunteer: { id: 'user-55', name: 'Ana', avatar: null, bio: '', location: '', followers: 0, following_count: 0 },
      habilidades: [], stats: { total_enrollments: 3, approved_enrollments: 3, total_horas: 14 },
      participaciones: [
        part({ enrollment_id: 'e1', project_id: 'p1', titulo: 'Huerta', project_status: 'completed', horas_realizadas: 12 }),
        part({ enrollment_id: 'e2', project_id: 'p2', titulo: 'Colecta', project_status: 'cancelled', horas_realizadas: 2 }),
        part({ enrollment_id: 'e3', project_id: 'p3', titulo: 'Taller', project_status: 'active', horas_realizadas: 0 }),
      ],
    }) } } };
});
import { VolunteerPublicProfile } from './VolunteerPublicProfile';

describe('Perfil público: los voluntariados', () => {
  test('cada uno con sus horas (si hay) y su estado real', async () => {
    render(<MemoryRouter initialEntries={['/volunteer/user-55']}><Routes>
      <Route path="/volunteer/:id" element={<VolunteerPublicProfile />} />
    </Routes></MemoryRouter>);
    const fila = async (t: string) => (await screen.findByText(t)).closest('li')!;
    expect(within(await fila('Huerta')).getByText('Finalizado')).toBeInTheDocument();
    expect(within(await fila('Huerta')).getByText('12 h verificadas')).toBeInTheDocument();
    expect(within(await fila('Colecta')).getByText('Cancelado')).toBeInTheDocument();
    expect(within(await fila('Taller')).getByText('Activo')).toBeInTheDocument();
    expect(within(await fila('Taller')).queryByText(/verificadas/)).not.toBeInTheDocument();
  });
});
