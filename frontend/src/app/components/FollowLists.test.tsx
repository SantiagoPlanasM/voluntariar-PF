// src/app/components/FollowLists.test.tsx
//
// Listas "Seguidores"/"Siguiendo" del perfil propio (VolunteerProfile) y del público (VolunteerPublicProfile).
// Eran dos copias casi iguales del mismo JSX; pasaron a FollowListModal (PROJECT_ANALYSIS §105). Estos tests
// fijan lo que se ve y a qué endpoint se llama en cada perfil, y se escribieron contra el código anterior
// (ModalsA11y.test.tsx ya cubre el diálogo, el foco y Escape).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { VolunteerPublicProfile } from './VolunteerPublicProfile';
import { VolunteerProfile } from './VolunteerProfile';
import { api, VolunteerPublic } from '../../lib/api';

// Objeto estable: VolunteerProfile tiene useEffect([user]); uno nuevo en cada render lo deja en bucle.
vi.mock('../../lib/AuthContext', () => {
  const auth = {
    user: { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' },
    openAuthModal: vi.fn(), logout: vi.fn(), login: vi.fn(), initializing: false,
  };
  return { useAuth: () => auth };
});
vi.mock('./MomentsGrid', () => ({ MomentsGrid: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      enrollments: { ...actual.api.enrollments, my: vi.fn().mockResolvedValue({ enrollments: [] }) },
      catalog: { ...actual.api.catalog, habilidades: vi.fn().mockResolvedValue({ habilidades: [] }) },
      follows: {
        ...actual.api.follows,
        myNgos: vi.fn().mockResolvedValue({ ngos: [] }),
        myFollowing: vi.fn(), myFollowers: vi.fn(),
        volunteerFollowStatus: vi.fn().mockResolvedValue({ following: false }),
        volunteerFollowers: vi.fn(), volunteerFollowing: vi.fn(),
      },
      voluntarios: {
        ...actual.api.voluntarios,
        habilidades: { list: vi.fn().mockResolvedValue({ habilidades: [] }), update: vi.fn() },
        getProfile: vi.fn().mockResolvedValue({
          volunteer: { id: 'user-55', name: 'Ana', avatar: null, bio: '', location: '', followers: 1, following_count: 1 },
          habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [],
        }),
      },
    },
  };
});

const people: VolunteerPublic[] = [
  { user_id: 'u-me', name: 'María', avatar: 'https://img/maria.jpg', followers: 2 },
  { user_id: 'u-2', name: 'Juan', foto_perfil: 'https://img/juan.jpg', ubicacion: 'Córdoba', followers: 3 },
  { user_id: 'u-3', name: 'Lucía', location: 'Rosario', followers: 0 },
];
const f = vi.mocked(api.follows);
const lists = (volunteers: VolunteerPublic[]) => {
  for (const fn of [f.myFollowers, f.myFollowing, f.volunteerFollowers, f.volunteerFollowing])
    fn.mockReset().mockResolvedValue({ volunteers });
};

const own = () => render(
  <MemoryRouter initialEntries={['/profile']}><Routes>
    <Route path="/profile" element={<VolunteerProfile />} />
    <Route path="/volunteer/:id" element={<p>perfil ajeno</p>} />
  </Routes></MemoryRouter>);
const pub = () => render(
  <MemoryRouter initialEntries={['/volunteer/user-55']}><Routes>
    <Route path="/volunteer/:id" element={<VolunteerPublicProfile />} />
  </Routes></MemoryRouter>);
const open = async (name: 'Seguidores' | 'Siguiendo') => {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  return screen.findByRole('dialog', { name });
};

beforeEach(() => lists(people));

describe('listas de seguidores/seguidos', () => {
  test('cada persona: link a su perfil (o a /profile si soy yo, con "Tú"), foto o inicial, ubicación y seguidores', async () => {
    own();
    const d = await open('Seguidores');
    const juan = await within(d).findByRole('link', { name: /Juan/ });
    expect(juan).toHaveAttribute('href', '/volunteer/u-2');
    expect(within(juan).getByRole('img', { name: 'Juan' })).toHaveAttribute('src', 'https://img/juan.jpg');
    expect(juan).toHaveTextContent('Córdoba · 3 seguidores');
    expect(juan).not.toHaveTextContent('Tú');

    const me = within(d).getByRole('link', { name: /María/ });
    expect(me).toHaveAttribute('href', '/profile');
    expect(me).toHaveTextContent('Tú');
    expect(me).toHaveTextContent('Argentina · 2 seguidores');
    expect(within(me).getByRole('img', { name: 'María' })).toHaveAttribute('src', 'https://img/maria.jpg');

    const lucia = within(d).getByRole('link', { name: /Lucía/ });
    expect(within(lucia).queryByRole('img')).toBeNull();
    expect(lucia).toHaveTextContent(/^LLucía/);
    expect(lucia).toHaveTextContent('Rosario · 0 seguidores');
  });

  test('perfil propio: pide mis listas', async () => {
    own();
    // Al montar, el perfil propio ya llama a las dos para los contadores: se cuentan solo las de la lista.
    await screen.findByRole('button', { name: /Seguidores/ });
    await vi.waitFor(() => expect(f.myFollowers).toHaveBeenCalled());
    f.myFollowers.mockClear();
    await open('Seguidores');
    expect(f.myFollowers).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    f.myFollowing.mockClear();
    await open('Siguiendo');
    expect(f.myFollowing).toHaveBeenCalledTimes(1);
    expect(f.volunteerFollowers).not.toHaveBeenCalled();
    expect(f.volunteerFollowing).not.toHaveBeenCalled();
  });

  test('perfil público: pide las listas de ese voluntario', async () => {
    pub();
    await open('Seguidores');
    expect(f.volunteerFollowers).toHaveBeenCalledWith('user-55');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await open('Siguiendo');
    expect(f.volunteerFollowing).toHaveBeenCalledWith('user-55');
    expect(f.myFollowers).not.toHaveBeenCalled();
  });

  test('listas vacías: el texto habla en segunda persona en mi perfil y en tercera en el público', async () => {
    lists([]);
    const a = own();
    expect(await within(await open('Seguidores')).findByText('Todavía no tenés seguidores.')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(await within(await open('Siguiendo')).findByText('Todavía no seguís a nadie.')).toBeInTheDocument();
    a.unmount();

    pub();
    expect(await within(await open('Seguidores')).findByText('Todavía no tiene seguidores.')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(await within(await open('Siguiendo')).findByText('Todavía no sigue a nadie.')).toBeInTheDocument();
  });

  test('mientras carga no dice "Todavía no…"', async () => {
    pub();
    let resolve!: (v: { volunteers: VolunteerPublic[] }) => void;
    f.volunteerFollowers.mockReturnValue(new Promise(r => { resolve = r; }));
    const d = await open('Seguidores');
    expect(within(d).queryByText(/Todavía no/)).toBeNull();
    expect(within(d).queryByRole('link')).toBeNull();
    resolve({ volunteers: [] });
    expect(await within(d).findByText('Todavía no tiene seguidores.')).toBeInTheDocument();
  });

  test('tocar una persona navega a su perfil y cierra la lista; "Cerrar" también la cierra', async () => {
    own();
    let d = await open('Siguiendo');
    fireEvent.click(within(d).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    d = await open('Siguiendo');
    fireEvent.click(await within(d).findByRole('link', { name: /Juan/ }));
    expect(await screen.findByText('perfil ajeno')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('perfil público → otra persona de la lista: el perfil nuevo carga sin la lista abierta', async () => {
    // Es el mismo componente con otro :id; si el link no cerrara la lista, volvería a abrirse sola
    // cuando termina de cargar el perfil nuevo.
    pub();
    const d = await open('Seguidores');
    fireEvent.click(await within(d).findByRole('link', { name: /Juan/ }));
    await vi.waitFor(() => expect(api.voluntarios.getProfile).toHaveBeenLastCalledWith('u-2'));
    expect(await screen.findByRole('button', { name: /Seguidores/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
