// src/app/components/NGOFollowStatus.test.tsx
//
// Perfil público de una ONG: si falla la consulta "¿ya la sigo?" (`GET /api/follows/ngo/:id/status`), antes se
// tragaba (`.catch(() => ({ following: false }))`) y el botón decía "Seguir" aunque ya la siguieras. Ahora el
// botón no se muestra, aparece un aviso con "Reintentar" y el resto del perfil se ve igual. Sin sesión (y para
// quien no es voluntario) no se consulta: no hay nada que saber.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';

type TestUser = { id: string; name: string; email: string; role: string } | null;
const { auth } = vi.hoisted(() => ({
  auth: { user: null as TestUser, openAuthModal: () => {}, logout: () => {} },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      ngos: { ...actual.api.ngos, get: vi.fn() },
      follows: { ...actual.api.follows, ngoStatus: vi.fn(), followNgo: vi.fn(), unfollowNgo: vi.fn() },
    },
  };
});

import { api, ApiError, NGO } from '../../lib/api';
import { NGOPublicProfile } from './NGOPublicProfile';

const f = vi.mocked(api.follows);
const volunteer = { id: 'u-me', name: 'María', email: 'm@x.com', role: 'volunteer' };
const verde = { id: 'n1', user_id: 'u-ngo', name: 'Fundación Verde', followers: 3, description: 'Plantamos árboles' } as NGO;
const STATUS_FALLBACK = 'No pudimos saber si ya seguís a esta organización. Revisá tu conexión.';

beforeEach(() => {
  auth.user = volunteer;
  for (const fn of Object.values(f)) if (vi.isMockFunction(fn)) fn.mockReset();
  f.ngoStatus.mockResolvedValue({ following: false });
  vi.mocked(api.ngos.get).mockReset().mockResolvedValue({ ngo: verde, projects: [] } as never);
});

const mount = () => render(
  <MemoryRouter initialEntries={['/ngo/n1']}>
    <Routes><Route path="/ngo/:id" element={<NGOPublicProfile />} /></Routes>
  </MemoryRouter>);
function Go({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>ir a {to}</button>;
}
const followButton = () => screen.queryByRole('button', { name: /^(Seguir|Siguiendo)$/ });

describe('perfil público de una ONG: falla "¿ya la sigo?"', () => {
  test('500: el perfil se ve, el botón no dice "Seguir" y hay un aviso; "Reintentar" lo resuelve', async () => {
    f.ngoStatus.mockRejectedValueOnce(new ApiError('Error al consultar estado', 500))
      .mockResolvedValueOnce({ following: true });
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error al consultar estado');
    expect(followButton()).toBeNull();
    // El resto del perfil, normal.
    expect(screen.getByRole('heading', { name: 'Fundación Verde' })).toBeInTheDocument();
    expect(screen.getByText('Plantamos árboles')).toBeInTheDocument();
    expect(screen.getByText('Seguidores').previousElementSibling).toHaveTextContent('3');

    fireEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(f.ngoStatus).toHaveBeenCalledTimes(2);
    expect(api.ngos.get).toHaveBeenCalledTimes(1); // reintentar no recarga el perfil
  });

  test('sin conexión: mensaje propio, no "Failed to fetch"', async () => {
    f.ngoStatus.mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(STATUS_FALLBACK);
    expect(alert).not.toHaveTextContent('Failed to fetch');
  });

  test('si "Reintentar" vuelve a fallar, sigue el aviso y no aparece "Seguir"', async () => {
    f.ngoStatus.mockRejectedValue(new ApiError('Error al consultar estado', 500));
    mount();
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(f.ngoStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al consultar estado');
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    expect(followButton()).toBeNull();
  });

  test('mientras reintenta, "Reintentar" está deshabilitado (dos clics → un pedido)', async () => {
    f.ngoStatus.mockRejectedValueOnce(new ApiError('Error al consultar estado', 500))
      .mockReturnValueOnce(new Promise(() => {}));
    mount();
    const retry = within(await screen.findByRole('alert')).getByRole('button', { name: 'Reintentar' });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(retry).toBeDisabled();
    expect(f.ngoStatus).toHaveBeenCalledTimes(2);
    expect(followButton()).toBeNull();
  });

  test('si cambiás de ONG mientras reintenta, la respuesta vieja no pisa a la nueva', async () => {
    let resolveOld!: (v: { following: boolean }) => void;
    f.ngoStatus
      .mockRejectedValueOnce(new ApiError('Error al consultar estado', 500))          // n1, al cargar
      .mockReturnValueOnce(new Promise((r) => { resolveOld = r; }))                   // n1, "Reintentar" (queda colgado)
      .mockRejectedValueOnce(new ApiError('Error al consultar estado', 500));         // n2, al cargar
    vi.mocked(api.ngos.get).mockImplementation(((ngoId: string) => Promise.resolve({
      ngo: ngoId === 'n2' ? { ...verde, id: 'n2', name: 'Fundación Azul' } : verde, projects: [],
    })) as never);
    render(
      <MemoryRouter initialEntries={['/ngo/n1']}>
        <Go to="/ngo/n2" />
        <Routes><Route path="/ngo/:id" element={<NGOPublicProfile />} /></Routes>
      </MemoryRouter>);
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Reintentar' }));
    fireEvent.click(screen.getByText('ir a /ngo/n2'));
    expect(await screen.findByRole('heading', { name: 'Fundación Azul' })).toBeInTheDocument();
    // El "Reintentar" de la ONG nueva anda (no quedó trabado por el pedido de la anterior).
    expect(within(await screen.findByRole('alert')).getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    await act(async () => { resolveOld({ following: true }); });
    expect(screen.getByRole('alert')).toHaveTextContent('Error al consultar estado');
    expect(followButton()).toBeNull();
  });

  test('control: la consulta anda → "Siguiendo", sin aviso', async () => {
    f.ngoStatus.mockResolvedValue({ following: true });
    mount();
    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('perfil público de una ONG: quién consulta "¿ya la sigo?"', () => {
  test('sin sesión no se consulta, y el botón "Seguir" está (abre el login)', async () => {
    auth.user = null;
    mount();
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(f.ngoStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('una ONG logueada (no puede seguir) no consulta y no ve el botón', async () => {
    auth.user = { id: 'u-otra', name: 'Otra ONG', email: 'o@x.com', role: 'ngo' };
    mount();
    expect(await screen.findByRole('heading', { name: 'Fundación Verde' })).toBeInTheDocument();
    expect(f.ngoStatus).not.toHaveBeenCalled();
    expect(followButton()).toBeNull();
  });
});

// §128: el banner (relative) se pintaba sobre la fila del logo y el nombre, que no era posicionada, y tapaba
// la parte de arriba del nombre. jsdom no aplica Tailwind: se comprueban las clases que lo resuelven.
describe('perfil público de una ONG: el banner no tapa el nombre', () => {
  test('la fila del logo es relative y el nombre y los botones arrancan debajo del banner (pt-11)', async () => {
    mount();
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Fundación Verde' });
    const textBlock = h1.parentElement!;
    const row = textBlock.parentElement!;
    expect(row.className).toMatch(/\brelative\b/);
    expect(row.className).toContain('-mt-10');
    expect(row.className).toContain('items-start');
    expect(textBlock.className).toMatch(/(^|\s)pt-11(\s|$)/);
    expect(h1.className).toContain('break-words');
  });

  // En el celular los botones (Seguir, Mensaje) en la misma fila tapaban el nombre: van en su propia línea
  // (la fila hace wrap y ellos ocupan todo el ancho); desde sm vuelven al costado, alineados con el nombre.
  test('celular: los botones pasan a su propia línea; desde sm, al costado del nombre', async () => {
    mount();
    const follow = await screen.findByRole('button', { name: 'Seguir' });
    const buttons = follow.parentElement!;
    const row = buttons.parentElement!;
    expect(row.className).toContain('flex-wrap');
    expect(row.className).toContain('sm:flex-nowrap');
    expect(buttons.className).toContain('w-full');
    expect(buttons.className).toContain('sm:w-auto');
    expect(buttons.className).toContain('sm:pt-11');
    expect(buttons.className).not.toMatch(/(^|\s)pt-11(\s|$)/);
  });
});
