// src/app/ui/VerifiedBadge.test.tsx — la insignia azul de ONG validada (§317; DESIGN.md → Validación de ONGs).
// Criterio de aceptación (antes de escribir el componente): un ícono con nombre accesible "ONG validada" (y el mismo
// texto como tooltip), en azul de texto (`text-brand-text`, que pasa el contraste de paletteContrast.test.ts). Va junto
// al nombre de la ONG en su perfil público, en el detalle del voluntariado y en la tarjeta del inicio, solo si la API
// dice que está validada (`verified` / `ngo_verified`); sin el dato, no se dibuja.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, openAuthModal: () => {}, logout: () => {} }) }));
vi.mock('../components/MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: { ...actual.api.ngos, get: vi.fn() },
      projects: { ...actual.api.projects, get: vi.fn() },
      follows: { ...actual.api.follows, ngoStatus: vi.fn().mockResolvedValue({ following: false }),
        projectStatus: vi.fn().mockResolvedValue({ following: false }) },
      posts: { ...actual.api.posts, list: vi.fn().mockResolvedValue({ posts: [] }) },
    },
  };
});
import { api, FeedProject, NGO } from '../../lib/api';
import { VerifiedBadge } from './VerifiedBadge';
import { ProfileHeader } from './ProfileHeader';
import { NGOPublicProfile } from '../components/NGOPublicProfile';
import { ProjectDetails } from '../components/ProjectDetails';
import { FeedPostCard } from '../components/FeedPostCard';

const badges = () => screen.queryAllByRole('img', { name: 'ONG validada' });

describe('<VerifiedBadge />', () => {
  test('nombre accesible, tooltip y azul de texto', () => {
    render(<VerifiedBadge />);
    const b = screen.getByRole('img', { name: 'ONG validada' });
    expect(b).toHaveAttribute('title', 'ONG validada');
    expect(b.getAttribute('class')).toContain('text-brand-text');
  });
});

describe('<ProfileHeader verified />', () => {
  test('con verified: la insignia junto al nombre (arriba y abajo); sin él, ninguna', () => {
    const { rerender } = render(<ProfileHeader name="Manos" kind="org" stats={[]} verified />);
    expect(badges()).toHaveLength(2);
    rerender(<ProfileHeader name="Manos" kind="org" stats={[]} />);
    expect(badges()).toHaveLength(0);
  });
});

describe('dónde se ve', () => {
  const ngo = (verified?: boolean) => ({ ngo: { id: 'n1', user_id: 'u-ngo', name: 'Sustentando', followers: 0, verified } as NGO, projects: [] });
  const profile = () => render(<MemoryRouter initialEntries={['/ngo/n1']}><Routes><Route path="/ngo/:id" element={<NGOPublicProfile />} /></Routes></MemoryRouter>);

  test('perfil público de la ONG: solo si está validada', async () => {
    vi.mocked(api.ngos.get).mockResolvedValueOnce(ngo(true) as never);
    const { unmount } = profile();
    await screen.findAllByText('Sustentando');
    expect(badges().length).toBeGreaterThan(0);
    unmount();
    vi.mocked(api.ngos.get).mockResolvedValueOnce(ngo(false) as never);
    profile();
    await screen.findAllByText('Sustentando');
    expect(badges()).toHaveLength(0);
  });

  const detail = (ngo_verified?: boolean) => ({
    project: {
      id: 'proj-1', ngo_id: 'ngo-1', ngo_name: 'Sustentando', title: 'Reforestación', status: 'active', type: 'fugaz', comments: [],
      kpis: [], ratings: [], avg_rating: 0, my_enrollment: null, funding_goal: 0, current_funding: 0, volunteers_needed: 10,
      current_volunteers: 2, ngo_verified,
    },
  });
  const project = () => render(<MemoryRouter initialEntries={['/project/proj-1']}><Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes></MemoryRouter>);

  test('detalle del voluntariado: junto al nombre de la ONG, solo si está validada', async () => {
    vi.mocked(api.projects.get).mockResolvedValueOnce(detail(true) as never);
    const { unmount } = project();
    await screen.findByRole('heading', { name: 'Reforestación' });
    expect(badges()).toHaveLength(1);
    unmount();
    vi.mocked(api.projects.get).mockResolvedValueOnce(detail(undefined) as never);
    project();
    await screen.findByRole('heading', { name: 'Reforestación' });
    expect(badges()).toHaveLength(0);
  });

  test('tarjeta del inicio: junto al nombre de la ONG, solo si está validada', () => {
    const card = (ngo_verified?: boolean) => ({
      id: 'p1', ngo_id: 'n1', ngo_name: 'Sustentando', title: 'Huerta', description: 'd', category: 'Ambiente', location: 'Córdoba',
      type: 'fugaz', volunteers_needed: 10, current_volunteers: 2, funding_goal: 0, current_funding: 0, cost_per_person: 0,
      followers: 0, avg_rating: 0, status: 'active', ngo_verified,
    }) as unknown as FeedProject;
    const { rerender } = render(<MemoryRouter><FeedPostCard project={card(true)} /></MemoryRouter>);
    expect(badges()).toHaveLength(1);
    rerender(<MemoryRouter><FeedPostCard project={card(false)} /></MemoryRouter>);
    expect(badges()).toHaveLength(0);
  });
});
