// src/app/components/FollowErrors.test.tsx
//
// Seguir/dejar de seguir que falla (REVISION S6): en el perfil público de un voluntario (`catch { }`), en el de
// una ONG, en la tarjeta del feed (seguir proyecto) y en las sugerencias de Inicio solo se logueaba en consola.
// El botón volvía a su estado y nadie se enteraba. Ahora hay un mensaje breve con role="alert" cerca del botón,
// y el estado (siguiendo / seguidores) queda como estaba.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' }, openAuthModal: () => {}, logout: () => {} },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      notifications: { ...actual.api.notifications, list: vi.fn().mockResolvedValue({ notifications: [], unread: 0 }) },
      ngos: { ...actual.api.ngos, list: vi.fn(), get: vi.fn() },
      projects: { ...actual.api.projects, list: vi.fn().mockResolvedValue({ projects: [] }) },
      voluntarios: { ...actual.api.voluntarios, getProfile: vi.fn() },
      follows: {
        ...actual.api.follows,
        feed: vi.fn(), myNgos: vi.fn(), ngoStatus: vi.fn(), volunteerFollowStatus: vi.fn(),
        followNgo: vi.fn(), unfollowNgo: vi.fn(), followProject: vi.fn(), unfollowProject: vi.fn(),
        followVolunteer: vi.fn(), unfollowVolunteer: vi.fn(),
      },
    },
  };
});

import { api, ApiError, FeedProject, NGO } from '../../lib/api';
import { VolunteerPublicProfile } from './VolunteerPublicProfile';
import { NGOPublicProfile } from './NGOPublicProfile';
import { FeedPostCard } from './FeedPostCard';
import { MainFeed } from './MainFeed';

const f = vi.mocked(api.follows);
const boom = () => new ApiError('Error interno del servidor', 500);
const offline = () => new TypeError('Failed to fetch');
const FALLBACK = 'No pudimos actualizar el seguimiento. Revisá tu conexión y probá de nuevo.';
const verde = { id: 'n1', user_id: 'u-ngo', name: 'Fundación Verde', followers: 3 } as NGO;
const project = {
  id: 'proj-1', ngo_id: 'n1', title: 'Reforestación', description: 'd', category: 'Medio Ambiente', location: 'Córdoba',
  type: 'fugaz', status: 'active', volunteers_needed: 10, current_volunteers: 1, funding_goal: 0, current_funding: 0,
  followers: 5, ngo_name: 'Fundación Verde', image: '', follow_source: 'ngo_follow', ratings: [], recent_comments: [],
} as unknown as FeedProject;

beforeEach(() => {
  for (const fn of Object.values(f)) if (vi.isMockFunction(fn)) fn.mockReset();
  vi.mocked(api.voluntarios.getProfile).mockReset().mockResolvedValue({
    volunteer: { id: 'u-2', name: 'Juan', avatar: null, bio: '', location: '', followers: 7, following_count: 1 },
    habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [],
  } as never);
  f.volunteerFollowStatus.mockResolvedValue({ following: false });
  vi.mocked(api.ngos.get).mockReset().mockResolvedValue({ ngo: verde, projects: [] } as never);
  f.ngoStatus.mockResolvedValue({ following: false });
});

describe('perfil público de un voluntario', () => {
  const mount = () => render(
    <MemoryRouter initialEntries={['/volunteer/u-2']}>
      <Routes><Route path="/volunteer/:id" element={<VolunteerPublicProfile />} /></Routes>
    </MemoryRouter>);
  /** El contador de seguidores (el número arriba de la etiqueta "Seguidores"). */
  const followers = () => screen.getByRole('button', { name: /Seguidores/ });

  test('seguir falla: mensaje con role="alert", sigue en "Seguir" y los seguidores no cambian; reintentar lo limpia', async () => {
    f.followVolunteer.mockRejectedValueOnce(boom()).mockResolvedValueOnce({ following: true, followers: 8, message: '' });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeEnabled();
    expect(followers()).toHaveTextContent('7');
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(followers()).toHaveTextContent('8');
  });

  test('dejar de seguir falla sin conexión: mensaje propio y sigue en "Siguiendo"', async () => {
    f.volunteerFollowStatus.mockResolvedValue({ following: true });
    f.unfollowVolunteer.mockRejectedValue(offline());
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiendo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(FALLBACK);
    expect(screen.getByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(followers()).toHaveTextContent('7');
  });
});

describe('perfil público de una ONG', () => {
  const mount = () => render(
    <MemoryRouter initialEntries={['/ngo/n1']}>
      <Routes><Route path="/ngo/:id" element={<NGOPublicProfile />} /></Routes>
    </MemoryRouter>);
  const followers = () => screen.getByText('Seguidores').previousElementSibling!;

  test('seguir falla: mensaje, sigue en "Seguir" y los seguidores no cambian; reintentar lo limpia', async () => {
    f.followNgo.mockRejectedValueOnce(offline()).mockResolvedValueOnce({ following: true, followers: 4, message: '' });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(FALLBACK);
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeEnabled();
    expect(followers()).toHaveTextContent('3');
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(followers()).toHaveTextContent('4');
  });

  test('dejar de seguir falla: el mensaje del servidor y sigue en "Siguiendo"', async () => {
    f.ngoStatus.mockResolvedValue({ following: true });
    f.unfollowNgo.mockRejectedValue(boom());
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiendo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.getByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
  });
});

describe('tarjeta del feed (seguir proyecto)', () => {
  const mount = (p = project) => render(<MemoryRouter><FeedPostCard project={p} /></MemoryRouter>);

  test('seguir falla: mensaje y el botón sigue en "Seguir este voluntariado"; reintentar lo limpia', async () => {
    f.followProject.mockRejectedValueOnce(boom()).mockResolvedValueOnce({ following: true, followers: 6, message: '' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir este voluntariado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(screen.getByRole('button', { name: 'Seguir este voluntariado' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir este voluntariado' }));
    expect(await screen.findByRole('button', { name: 'Dejar de seguir voluntariado' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('dejar de seguir falla sin conexión: mensaje propio y sigue siguiéndolo', async () => {
    f.unfollowProject.mockRejectedValue(offline());
    mount({ ...project, follow_source: 'project_follow' } as FeedProject);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de seguir voluntariado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(FALLBACK);
    expect(screen.getByRole('button', { name: 'Dejar de seguir voluntariado' })).toBeInTheDocument();
  });
});

describe('Inicio: seguir una ONG sugerida', () => {
  beforeEach(() => {
    f.myNgos.mockResolvedValue({ ngos: [] });
    vi.mocked(api.ngos.list).mockReset().mockResolvedValue({ ngos: [verde] } as never);
  });
  const mount = () => render(<MemoryRouter><MainFeed /></MemoryRouter>);
  const sidebar = () => screen.getByText('Sugerencias para vos').closest('div.bg-white') as HTMLElement;

  test('desde la barra lateral: mensaje cerca del botón y la ONG sigue sugerida; reintentar lo limpia', async () => {
    f.feed.mockResolvedValue({ projects: [project] } as never);
    f.followNgo.mockRejectedValueOnce(boom()).mockResolvedValueOnce({ following: true, followers: 4, message: '' });
    mount();
    await within(sidebar()).findByText('Fundación Verde');
    fireEvent.click(within(sidebar()).getByRole('button', { name: '+ Seguir' }));
    expect(await within(sidebar()).findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(within(sidebar()).getByText('Fundación Verde')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: '+ Seguir' })).toBeEnabled();
    fireEvent.click(within(sidebar()).getByRole('button', { name: '+ Seguir' }));
    await vi.waitFor(() => expect(within(sidebar()).queryByText('Fundación Verde')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('con dos ONGs: el mensaje va debajo de la que falló y se va al seguir otra', async () => {
    const azul = { id: 'n2', name: 'Red Azul', followers: 1 } as NGO;
    vi.mocked(api.ngos.list).mockResolvedValue({ ngos: [verde, azul] } as never);
    f.feed.mockResolvedValue({ projects: [] } as never);
    f.followNgo.mockImplementation(async (id: string) => {
      if (id === 'n1') throw boom();
      return { following: true, followers: 2, message: '' };
    });
    mount();
    await screen.findByText('Tu feed personalizado está listo');
    // Barra lateral: falla Verde.
    fireEvent.click(within(sidebar()).getAllByRole('button', { name: '+ Seguir' })[0]);
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2); // debajo de Verde, en la barra y en el feed vacío (no debajo de Azul)
    for (const a of alerts) {
      expect(a.parentElement).toHaveTextContent('Fundación Verde');
      expect(a.parentElement).not.toHaveTextContent('Red Azul');
    }
    // Seguir Azul (anda): el mensaje de Verde se va.
    fireEvent.click(within(sidebar()).getAllByRole('button', { name: '+ Seguir' })[1]);
    await vi.waitFor(() => expect(within(sidebar()).queryByText('Red Azul')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('desde el feed vacío: mensaje cerca del botón y la ONG sigue sugerida', async () => {
    f.feed.mockResolvedValue({ projects: [] } as never);
    f.followNgo.mockRejectedValue(offline());
    mount();
    await screen.findByText('Tu feed personalizado está listo');
    const main = screen.getByText('ONGs recomendadas para vos').parentElement!;
    fireEvent.click(within(main).getByRole('button', { name: 'Seguir' }));
    expect(await within(main).findByRole('alert')).toHaveTextContent(FALLBACK);
    expect(within(main).getByRole('button', { name: 'Seguir' })).toBeEnabled();
  });

  // Doble clic: antes no había estado de envío y cada clic mandaba un pedido.
  test('mientras se envía, el botón de esa ONG está bloqueado: dos clics → un pedido', async () => {
    f.feed.mockResolvedValue({ projects: [project] } as never);
    f.followNgo.mockReturnValue(new Promise(() => {}));
    mount();
    await within(sidebar()).findByText('Fundación Verde');
    const btn = within(sidebar()).getByRole('button', { name: '+ Seguir' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(f.followNgo).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
  });

  test('bloquea también el botón de la misma ONG en el feed vacío, pero no el de otra ONG', async () => {
    const azul = { id: 'n2', name: 'Red Azul', followers: 1 } as NGO;
    vi.mocked(api.ngos.list).mockResolvedValue({ ngos: [verde, azul] } as never);
    f.feed.mockResolvedValue({ projects: [] } as never);
    // Verde queda en vuelo; Azul falla.
    f.followNgo.mockImplementation((id: string) => (id === 'n1' ? new Promise(() => {}) : Promise.reject(boom())));
    mount();
    await screen.findByText('Tu feed personalizado está listo');
    const main = screen.getByText('ONGs recomendadas para vos').parentElement!;
    fireEvent.click(within(sidebar()).getAllByRole('button', { name: '+ Seguir' })[0]); // Verde, en la barra
    const [verdeMain, azulMain] = within(main).getAllByRole('button', { name: 'Seguir' });
    expect(verdeMain).toBeDisabled();
    fireEvent.click(verdeMain);
    expect(f.followNgo).toHaveBeenCalledTimes(1);
    expect(azulMain).toBeEnabled();
    expect(within(sidebar()).getAllByRole('button', { name: '+ Seguir' })[1]).toBeEnabled();
    fireEvent.click(azulMain);
    expect(f.followNgo).toHaveBeenCalledTimes(2);
    expect(f.followNgo).toHaveBeenLastCalledWith('n2');
    // Que falle Azul la desbloquea a ella sola: Verde sigue en vuelo y bloqueada.
    expect(await within(main).findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(azulMain).toBeEnabled();
    expect(verdeMain).toBeDisabled();
    expect(within(sidebar()).getAllByRole('button', { name: '+ Seguir' })[0]).toBeDisabled();
  });
});
