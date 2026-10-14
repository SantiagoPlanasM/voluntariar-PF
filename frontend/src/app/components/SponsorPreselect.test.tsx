// src/app/components/SponsorPreselect.test.tsx
//
// REVISION.md F6: el selector de "Proponer patrocinio" de la empresa se llenaba con
// `api.projects.list({ status: 'active' })` sin `limit` → solo los 20 primeros (el default del backend).
// El botón "Patrocinar este proyecto" de ProjectDetails llevaba al perfil sin decir cuál proyecto: si no
// estaba entre esos 20, la empresa no podía patrocinarlo. Ahora el botón lleva `?proponer=<id>` y el perfil
// abre el formulario con ese proyecto ya elegido (aunque no esté en la lista).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import type { Project } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-comp', name: 'TechCorp', email: 'c@example.com', role: 'company' }, logout: vi.fn(), openAuthModal: vi.fn() }),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      empresas: { ...actual.api.empresas, me: vi.fn(), patrocinios: { list: vi.fn(), propose: vi.fn(), withdraw: vi.fn() } },
      projects: { ...actual.api.projects, list: vi.fn(), get: vi.fn() },
      follows: { ...actual.api.follows, projectStatus: vi.fn() },
      posts: { ...actual.api.posts, list: vi.fn() },
    },
  };
});

import { api } from '../../lib/api';
import { CompanyOwnProfile } from './CompanyOwnProfile';
import { ProjectDetails } from './ProjectDetails';

const empresa = { id: 'emp-1', user_id: 'u-comp', name: 'TechCorp', industry: '', description: '', mission: '', location: '', followers: 0 };
const project = (n: number, extra: Partial<Project> = {}) =>
  ({ id: `proj-${n}`, title: `Proyecto ${n}`, status: 'active', ngo_id: 'ngo-1', ...extra }) as Project;
const first20 = Array.from({ length: 20 }, (_, i) => project(i + 1));

const mount = (url: string) =>
  render(<MemoryRouter initialEntries={[url]}><CompanyOwnProfile /></MemoryRouter>);

describe('Proponer patrocinio con el proyecto preseleccionado (?proponer=)', () => {
  beforeEach(() => {
    vi.mocked(api.empresas.me).mockReset().mockResolvedValue({ empresa } as never);
    vi.mocked(api.empresas.patrocinios.list).mockReset().mockResolvedValue({ patrocinios: [] } as never);
    vi.mocked(api.empresas.patrocinios.propose).mockReset().mockResolvedValue({ message: 'ok' } as never);
    vi.mocked(api.projects.list).mockReset().mockResolvedValue({ projects: first20 } as never);
    vi.mocked(api.projects.get).mockReset();
  });

  test('pide la lista con un limit explícito (no el default de 20 del backend)', async () => {
    mount('/company/profile');
    await waitFor(() => expect(api.projects.list).toHaveBeenCalled());
    const params = vi.mocked(api.projects.list).mock.calls[0][0]!;
    expect(params.status).toBe('active');
    expect(Number(params.limit)).toBeGreaterThan(20);
  });

  test('un proyecto que NO vino en la lista se trae aparte, queda elegido y se puede proponer', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: project(30, { title: 'Proyecto treinta' }) } as never);
    mount('/company/profile?proponer=proj-30');

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('proj-30'));
    expect(screen.getByRole('option', { name: 'Proyecto treinta' })).toBeInTheDocument();
    expect(api.projects.get).toHaveBeenCalledWith('proj-30');

    fireEvent.click(screen.getByText('Enviar propuesta'));
    await waitFor(() => expect(api.empresas.patrocinios.propose).toHaveBeenCalledWith('proj-30', undefined));
  });

  test('un proyecto que sí vino en la lista queda elegido sin pedirlo aparte', async () => {
    mount('/company/profile?proponer=proj-5');
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('proj-5'));
    expect(api.projects.get).not.toHaveBeenCalled();
  });

  test('si ya hay una propuesta vigente para ese proyecto, lo dice', async () => {
    vi.mocked(api.empresas.patrocinios.list).mockResolvedValue({
      patrocinios: [{ empresa_id: 'emp-1', project_id: 'proj-5', estado: 'propuesto', aporte: 0, created_at: '', updated_at: '', project_title: 'Proyecto 5' }],
    } as never);
    mount('/company/profile?proponer=proj-5');
    await waitFor(() => expect(screen.getByText(/Ya tenés una propuesta vigente para este proyecto/)).toBeInTheDocument());
  });

  test('si el proyecto no está activo, lo dice y no lo ofrece', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: project(31, { status: 'completed' }) } as never);
    mount('/company/profile?proponer=proj-31');
    await waitFor(() => expect(screen.getByText(/no está activo/)).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Proyecto 31' })).not.toBeInTheDocument();
  });

  test('sin ?proponer= el formulario arranca cerrado (comportamiento de antes)', async () => {
    mount('/company/profile');
    await waitFor(() => expect(api.projects.list).toHaveBeenCalled());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('ProjectDetails: el botón de la empresa lleva el proyecto', () => {
  test('"Patrocinar este proyecto" apunta a /company/profile?proponer=<id>', async () => {
    vi.mocked(api.projects.get).mockReset().mockResolvedValue({ project: { ...project(30), comments: [], ratings: [], kpis: [] } } as never);
    vi.mocked(api.follows.projectStatus).mockResolvedValue({ following: false });
    vi.mocked(api.posts.list).mockResolvedValue({ posts: [] } as never);
    render(
      <MemoryRouter initialEntries={['/project/proj-30']}>
        <Routes><Route path="/project/:id" element={<ProjectDetails />} /></Routes>
      </MemoryRouter>
    );
    const links = await screen.findAllByRole('link', { name: /Patrocinar este proyecto/ });
    for (const a of links) expect(a).toHaveAttribute('href', '/company/profile?proponer=proj-30');
  });
});
