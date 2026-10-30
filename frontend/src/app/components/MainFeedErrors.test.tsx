// src/app/components/MainFeedErrors.test.tsx
//
// Inicio del voluntario (REVISION S1): si fallaba la carga de la barra lateral, FeedSidebar decía
// "¡Ya seguís a todas las organizaciones recomendadas!", y si fallaba el feed de seguidos se veía
// "Tu feed personalizado está listo" (el estado vacío), como si no siguieras nada.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/AuthContext', () => {
  const auth = { user: { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' }, logout: vi.fn() };
  return { useAuth: () => auth };
});
vi.mock('./FeedPostCard', () => ({ FeedPostCard: ({ project }: { project: { title: string } }) => <p>{project.title}</p> }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      notifications: { ...actual.api.notifications, list: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }) },
      ngos: { ...actual.api.ngos, list: vi.fn() },
      projects: { ...actual.api.projects, list: vi.fn() },
      follows: { ...actual.api.follows, feed: vi.fn(), myNgos: vi.fn(), followNgo: vi.fn() },
    },
  };
});

import { api, ApiError, FeedProject, NGO, Project } from '../../lib/api';
import { MainFeed } from './MainFeed';

const verde = { id: 'n1', name: 'Fundación Verde', followers: 3 } as NGO;
const azul = { id: 'n2', name: 'Red Azul', followers: 1 } as NGO;
const post = { id: 'p1', title: 'Plantada en el parque' } as FeedProject;
const urgent = { id: 'p9', title: 'Colecta urgente', type: 'fugaz' } as Project;
const m = {
  feed: vi.mocked(api.follows.feed), myNgos: vi.mocked(api.follows.myNgos),
  ngos: vi.mocked(api.ngos.list), projects: vi.mocked(api.projects.list),
};
const boom = () => new ApiError('Error interno del servidor', 500);
const mount = () => render(<MemoryRouter><MainFeed /></MemoryRouter>);
/** La sección "ONGs para seguir" de la barra lateral (antes "Sugerencias para vos"; rediseño, §240). */
const suggestionsBox = () => screen.getByRole('region', { name: 'ONGs para seguir' });
/** El estado vacío del Inicio (antes "Tu feed personalizado está listo"). */
const EMPTY = /Empezá por una causa/;

beforeEach(() => {
  m.feed.mockReset().mockResolvedValue({ projects: [post] } as never);
  m.myNgos.mockReset().mockResolvedValue({ ngos: [azul] });
  m.ngos.mockReset().mockResolvedValue({ ngos: [verde, azul] } as never);
  m.projects.mockReset().mockResolvedValue({ projects: [urgent] } as never);
});

describe('Inicio: errores de carga (REVISION S1)', () => {
  test('feed de seguidos: un error se ve con "Reintentar", no como "Tu feed personalizado está listo"', async () => {
    m.feed.mockReset().mockRejectedValueOnce(boom()).mockResolvedValueOnce({ projects: [post] } as never);
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error interno del servidor');
    expect(screen.queryByText(EMPTY)).toBeNull();
    fireEvent.click(within(alert).getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Plantada en el parque')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('feed de seguidos sin conexión: mensaje propio', async () => {
    m.feed.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tu feed. Revisá tu conexión.');
    expect(alert).not.toHaveTextContent('Failed to fetch');
  });

  test('feed vacío de verdad: sigue el estado vacío, sin error', async () => {
    m.feed.mockResolvedValue({ projects: [] } as never);
    mount();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('barra lateral: si falla la lista de ONGs, error con "Reintentar" en vez de "¡Ya seguís a todas…!"', async () => {
    m.ngos.mockReset().mockRejectedValueOnce(boom()).mockResolvedValueOnce({ ngos: [verde, azul] } as never);
    mount();
    await screen.findByText('Plantada en el parque');
    const box = suggestionsBox();
    expect(await within(box).findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.queryByText(/Ya seguís a todas/)).toBeNull();
    fireEvent.click(within(box).getByRole('button', { name: /Reintentar/ }));
    expect(await within(box).findByText('Fundación Verde')).toBeInTheDocument();
    expect(within(box).queryByRole('alert')).toBeNull();
  });

  test('barra lateral: si fallan mis ONGs seguidas también es error (si no, sugeriría las que ya sigo)', async () => {
    m.myNgos.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    await screen.findByText('Plantada en el parque');
    const box = suggestionsBox();
    expect(await within(box).findByRole('alert')).toHaveTextContent('No pudimos cargar las sugerencias. Revisá tu conexión.');
    expect(within(box).queryByText('Red Azul')).toBeNull();
    expect(within(box).queryByText('Fundación Verde')).toBeNull();
  });

  test('barra lateral: si falla solo la de proyectos, las sugerencias se ven y "Próximas actividades" no', async () => {
    m.projects.mockReset().mockRejectedValue(boom());
    mount();
    const box = await vi.waitFor(() => suggestionsBox());
    expect(await within(box).findByText('Fundación Verde')).toBeInTheDocument();
    expect(within(box).queryByText('Red Azul')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Próximas actividades')).toBeNull();
  });

  test('barra lateral sin error y sin sugerencias: "¡Ya seguís a todas…!" sigue siendo el vacío', async () => {
    m.myNgos.mockResolvedValue({ ngos: [verde, azul] });
    mount();
    expect(await screen.findByText(/Ya seguís a todas/)).toBeInTheDocument();
    expect(screen.getByText('Colecta urgente')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('reintentar la barra cuando antes falló proyectos también los recarga', async () => {
    m.ngos.mockReset().mockRejectedValueOnce(boom()).mockResolvedValue({ ngos: [verde, azul] } as never);
    m.projects.mockReset().mockRejectedValueOnce(boom()).mockResolvedValue({ projects: [urgent] } as never);
    mount();
    await screen.findByText('Plantada en el parque');
    fireEvent.click(within(suggestionsBox()).getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Colecta urgente')).toBeInTheDocument();
  });
});

// La invitación al equipo de una ONG se ve arriba del Inicio (antes solo en Configuración).
describe('Inicio: invitación al equipo', () => {
  test('el voluntario ve la invitación con "Aceptar"', async () => {
    const mine = vi.spyOn(api.team, 'mine').mockResolvedValue({
      memberships: [{ ngo_id: 'ngo-1', ngo_name: 'Sustentando', ngo_logo: null, role: 'coordinator', status: 'invited' }],
    });
    mount();
    expect(await screen.findByRole('button', { name: 'Aceptar invitación de Sustentando' })).toBeInTheDocument();
    mine.mockRestore();
  });
});
