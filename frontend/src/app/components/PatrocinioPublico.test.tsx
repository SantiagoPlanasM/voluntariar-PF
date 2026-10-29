// src/app/components/PatrocinioPublico.test.tsx — "Patrocinado por" en público (§266, PLAN_PATROCINIO.md etapa 4).
//
// Criterio: el detalle del voluntariado muestra "Patrocinado por" con cada empresa (logo y nombre, enlace a su perfil)
// solo si hay alguna; el perfil público de la empresa lista los voluntariados que patrocina (enlace a cada uno) en vez
// del "próximamente", y si no patrocina ninguno, lo dice.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const { auth } = vi.hoisted(() => ({ auth: { user: null as Record<string, unknown> | null, openAuthModal: () => {} } }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn() },
      empresas: { ...actual.api.empresas, get: vi.fn() },
      follows: { ...actual.api.follows, projectStatus: vi.fn().mockResolvedValue({ following: false }) },
      posts: { ...actual.api.posts, list: vi.fn().mockResolvedValue({ posts: [] }) },
    },
  };
});
import { api } from '../../lib/api';
import { ProjectDetails } from './ProjectDetails';
import { CompanyPublicProfile } from './CompanyPublicProfile';

const project = (sponsors: unknown[]) => ({
  project: {
    id: 'proj-1', ngo_id: 'ngo-1', title: 'Reforestación', status: 'active', type: 'fugaz', comments: [], kpis: [], ratings: [],
    avg_rating: 0, my_enrollment: null, funding_goal: 0, current_funding: 0, volunteers_needed: 10, current_volunteers: 2, sponsors,
  },
});
const empresa = (sponsored_projects: unknown[]) => ({
  empresa: { id: 'emp-1', user_id: 'u-c', name: 'TechCorp', followers: 0, sponsored_projects },
});
const at = (path: string, route: string, el: React.ReactNode) =>
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>);

beforeEach(() => { vi.mocked(api.projects.get).mockReset(); vi.mocked(api.empresas.get).mockReset(); });

describe('Patrocinado por: el detalle del voluntariado', () => {
  test('con patrocinadores: cada empresa con su enlace', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project([{ id: 'emp-1', name: 'TechCorp', logo: null }, { id: 'emp-2', name: 'Acme SA', logo: null }]) as never);
    at('/project/proj-1', '/project/:id', <ProjectDetails />);
    const bloque = await screen.findByRole('region', { name: 'Patrocinado por' });
    expect(within(bloque).getByRole('link', { name: /TechCorp/ })).toHaveAttribute('href', '/company/emp-1');
    expect(within(bloque).getByRole('link', { name: /Acme SA/ })).toHaveAttribute('href', '/company/emp-2');
  });

  test('sin patrocinadores: no aparece', async () => {
    vi.mocked(api.projects.get).mockResolvedValue(project([]) as never);
    at('/project/proj-1', '/project/:id', <ProjectDetails />);
    await screen.findByRole('heading', { name: 'Reforestación' });
    expect(screen.queryByRole('region', { name: 'Patrocinado por' })).not.toBeInTheDocument();
  });
});

describe('Patrocinado por: el perfil público de la empresa', () => {
  test('lista los voluntariados que patrocina, con su enlace y la ONG', async () => {
    vi.mocked(api.empresas.get).mockResolvedValue(empresa([{ id: 'proj-9', title: 'Banco de Alimentos', image: null, ngo_name: 'Sustentando' }]) as never);
    at('/company/emp-1', '/company/:id', <CompanyPublicProfile />);
    const link = await screen.findByRole('link', { name: /Banco de Alimentos/ });
    expect(link).toHaveAttribute('href', '/project/proj-9');
    expect(within(link).getByText('Sustentando')).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/)).not.toBeInTheDocument();
  });

  test('sin patrocinios: lo dice', async () => {
    vi.mocked(api.empresas.get).mockResolvedValue(empresa([]) as never);
    at('/company/emp-1', '/company/:id', <CompanyPublicProfile />);
    expect(await screen.findByText('Todavía no patrocina voluntariados.')).toBeInTheDocument();
  });
});
