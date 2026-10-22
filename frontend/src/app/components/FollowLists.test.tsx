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
import { api, ApiError, VolunteerPublic } from '../../lib/api';

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
  // F2 (PLAN_FALTANTE.md, §163): la foto es `avatar` (users.avatar). `foto_perfil` es la copia del registro, que
  // nunca se actualiza: si está, no tiene que ganarle a `avatar`, y sola no se muestra.
  { user_id: 'u-2', name: 'Juan', avatar: 'https://img/juan.jpg', foto_perfil: 'https://img/juan-vieja.jpg', ubicacion: 'Córdoba', followers: 3 },
  { user_id: 'u-3', name: 'Lucía', foto_perfil: 'https://img/lucia-vieja.jpg', location: 'Rosario', followers: 0 },
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

  test('un error al pedir la lista se ve como error con "Reintentar", no como "Todavía no…" (REVISION S1)', async () => {
    pub();
    f.volunteerFollowers.mockReset()
      .mockRejectedValueOnce(new ApiError('Error interno del servidor', 500))
      .mockResolvedValueOnce({ volunteers: people });
    const d = await open('Seguidores');
    expect(await within(d).findByRole('alert')).toHaveTextContent('Error interno del servidor');
    expect(within(d).queryByText(/Todavía no/)).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: /Reintentar/ }));
    expect(await within(d).findByRole('link', { name: /Juan/ })).toBeInTheDocument();
    expect(within(d).queryByRole('alert')).toBeNull();
    expect(f.volunteerFollowers).toHaveBeenCalledTimes(2);
  });

  test('sin conexión (fetch rechaza con TypeError): mensaje propio, no el del navegador', async () => {
    own();
    await screen.findByRole('button', { name: /Siguiendo/ });
    f.myFollowing.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    const d = await open('Siguiendo');
    const alert = await within(d).findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar la lista. Revisá tu conexión.');
    expect(alert).not.toHaveTextContent('Failed to fetch');
    expect(within(d).queryByText(/Todavía no/)).toBeNull();
  });

  test('si "Reintentar" vuelve a fallar, sigue el error (y mientras reintenta no dice "Todavía no…")', async () => {
    pub();
    let reject!: (e: unknown) => void;
    f.volunteerFollowing.mockReset()
      .mockRejectedValueOnce(new ApiError('Error interno del servidor', 500))
      .mockReturnValueOnce(new Promise((_, r) => { reject = r; }));
    const d = await open('Siguiendo');
    fireEvent.click(await within(d).findByRole('button', { name: /Reintentar/ }));
    expect(within(d).queryByRole('alert')).toBeNull();
    expect(within(d).queryByText(/Todavía no/)).toBeNull();
    reject(new ApiError('Servicio no disponible', 503));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Servicio no disponible');
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

describe('foto del voluntario: users.avatar, nunca la copia vieja de voluntarios.foto_perfil (F2, §163)', () => {
  test('perfil público: el encabezado muestra `avatar` aunque venga `foto_perfil`', async () => {
    vi.mocked(api.voluntarios.getProfile).mockResolvedValueOnce({
      volunteer: { id: 'user-55', name: 'Ana', avatar: 'https://img/ana-nueva.jpg', foto_perfil: 'https://img/ana-vieja.jpg', bio: '', location: '', followers: 1, following_count: 1 },
      habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [],
    } as never);
    pub();
    expect(await screen.findByRole('img', { name: 'Ana' })).toHaveAttribute('src', 'https://img/ana-nueva.jpg');
  });

  test('perfil público sin `avatar`: las iniciales, no la copia vieja', async () => {
    vi.mocked(api.voluntarios.getProfile).mockResolvedValueOnce({
      volunteer: { id: 'user-55', name: 'Ana', avatar: null, foto_perfil: 'https://img/ana-vieja.jpg', bio: '', location: '', followers: 1, following_count: 1 },
      habilidades: [], stats: { total_enrollments: 0, approved_enrollments: 0, total_horas: 0 }, participaciones: [],
    } as never);
    const { container } = pub();
    await screen.findByRole('button', { name: /Seguidores/ });
    // Rediseño (§240): el avatar sin foto son las iniciales con nombre accesible (un <span role="img">, no una <img>).
    const avatar = screen.getByRole('img', { name: 'Ana' });
    expect(avatar.tagName).toBe('SPAN');
    expect(avatar).toHaveTextContent('AN');
    expect(container.querySelector('img[src*="ana-vieja"]')).toBeNull();
  });

  // Rediseño (§240): la lista "Voluntarios que sigo" del perfil propio pasó a la estadística "Siguiendo".
  test('mi perfil, "Siguiendo": `avatar` y no `foto_perfil`', async () => {
    own();
    const d = await open('Siguiendo');
    const juan = await within(d).findByRole('link', { name: /Juan/ });
    expect(within(juan).getByRole('img', { name: 'Juan' })).toHaveAttribute('src', 'https://img/juan.jpg');
    const lucia = within(d).getByRole('link', { name: /Lucía/ });
    expect(lucia.querySelector('img')).toBeNull();
  });
});
