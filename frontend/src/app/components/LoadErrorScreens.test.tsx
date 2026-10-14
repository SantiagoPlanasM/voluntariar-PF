// src/app/components/LoadErrorScreens.test.tsx
//
// REVISION.md F7: si la carga del recurso falla, la pantalla tiene que mostrar un error (y no hacer
// `navigate(-1)` + `return null`, que abierta desde un link compartido quedaba en blanco).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

const navigateSpy = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => ({ id: 'x-1', projectId: 'x-1' }), useNavigate: () => navigateSpy };
});

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: null, openAuthModal: vi.fn() }),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: { ...actual.api.projects, get: vi.fn() },
      ngos: { ...actual.api.ngos, get: vi.fn() },
      empresas: { ...actual.api.empresas, get: vi.fn() },
      enrollments: { ...actual.api.enrollments, byProject: vi.fn() },
      follows: { ...actual.api.follows, ngoStatus: vi.fn(), projectStatus: vi.fn() },
      posts: { ...actual.api.posts, list: vi.fn() },
    },
  };
});

import { api, ApiError } from '../../lib/api';
import { ProjectDetails } from './ProjectDetails';
import { NGOPublicProfile } from './NGOPublicProfile';
import { CompanyPublicProfile } from './CompanyPublicProfile';
import { NGOProjectDetail } from './NGOProjectDetail';

const mount = (el: ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  navigateSpy.mockReset();
  vi.mocked(api.follows.ngoStatus).mockResolvedValue({ following: false });
  vi.mocked(api.follows.projectStatus).mockResolvedValue({ following: false });
  vi.mocked(api.enrollments.byProject).mockResolvedValue({ enrollments: [] });
  vi.mocked(api.posts.list).mockResolvedValue({ posts: [] } as never);
});

const notFound = () => Promise.reject(new ApiError('No encontrado', 404));
const serverDown = () => Promise.reject(new ApiError('El servidor no está disponible en este momento. Probá de nuevo en un rato.', 502));

describe.each([
  ['ProjectDetails', () => <ProjectDetails />, () => vi.mocked(api.projects.get), /No encontramos este voluntariado/],
  ['NGOPublicProfile', () => <NGOPublicProfile />, () => vi.mocked(api.ngos.get), /No encontramos esta organización/],
  ['CompanyPublicProfile', () => <CompanyPublicProfile />, () => vi.mocked(api.empresas.get), /No encontramos esta empresa/],
  ['NGOProjectDetail', () => <NGOProjectDetail />, () => vi.mocked(api.projects.get), /No encontramos este voluntariado/],
])('%s: error al cargar', (_, el, getter, notFoundText) => {
  test('404 → mensaje de "no existe" en pantalla, sin navigate(-1)', async () => {
    getter().mockImplementation(notFound as never);
    mount(el());
    await waitFor(() => expect(screen.getByText(notFoundText)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  test('502 → mensaje del error y "Reintentar" vuelve a pedir', async () => {
    getter().mockImplementation(serverDown as never);
    mount(el());
    await waitFor(() => expect(screen.getByText(/no está disponible/)).toBeInTheDocument());
    expect(navigateSpy).not.toHaveBeenCalled();
    const calls = getter().mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(getter().mock.calls.length).toBeGreaterThan(calls));
  });
});
