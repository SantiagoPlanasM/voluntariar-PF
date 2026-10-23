// src/app/layout/AppShell.test.tsx
//
// Layout único (rediseño, DESIGN.md → Navegación por rol). Reemplaza a los tests de BottomNav, NGOBottomNav,
// CompanyBottomNav, NGOSidebarNav, CompanySidebarNav y del layout Root: las garantías son las mismas (cada rol ve
// su lista, el ítem activo se marca, los no leídos se cuentan, salir cierra la sesión), ahora sobre una sola pieza.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Routes, Route, useNavigate } from 'react-router';

const { auth, chat } = vi.hoisted(() => ({
  auth: {
    user: null as null | Record<string, unknown>,
    logout: vi.fn(), openAuthModal: vi.fn(),
  },
  chat: { unreadTotal: 0 },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/ChatContext', () => ({ useChatOptional: () => chat }));
vi.mock('../components/AuthModal', () => ({ AuthModal: () => null }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, notifications: { ...actual.api.notifications, list: vi.fn() } } };
});

import { api } from '../../lib/api';
import { AppShell } from './AppShell';
import { NAV, isActive, navRole } from './navConfig';

const as = (role: string | null) => {
  auth.user = role ? { id: `u-${role}`, name: 'Ana Pérez', email: 'ana@x.com', role, avatar: null } : null;
};

function app(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<p>Pantalla</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// En el DOM va primero la barra lateral (escritorio) y después la inferior (celular).
const sideBar = () => screen.getAllByRole('navigation', { name: 'Principal' })[0];
const tabBar = () => screen.getAllByRole('navigation', { name: 'Principal' })[1];
const labels = (nav: HTMLElement) => within(nav).getAllByRole('link').concat(within(nav).queryAllByRole('button'))
  .map(el => el.getAttribute('aria-label'));

beforeEach(() => {
  as('volunteer');
  chat.unreadTotal = 0;
  auth.logout.mockReset();
  auth.openAuthModal.mockReset();
  vi.mocked(api.notifications.list).mockReset().mockResolvedValue({ notifications: [], unread: 0 } as never);
  localStorage.clear();
});

describe('navegación por rol (navConfig)', () => {
  test('voluntario: Inicio, Explorar, Crear, Mis voluntariados y Perfil abajo (cinco como máximo)', () => {
    expect(NAV.volunteer.tabs.map(i => i.label)).toEqual(['Inicio', 'Explorar', 'Crear', 'Mis voluntariados', 'Perfil']);
  });
  test('ONG: Panel, Explorar, Crear, Mensajes y Perfil abajo; en la lateral también Patrocinios, Publicaciones y Notificaciones', () => {
    expect(NAV.ngo.tabs.map(i => i.label)).toEqual(['Panel', 'Explorar', 'Crear', 'Mensajes', 'Perfil']);
    expect(NAV.ngo.side.map(i => i.to)).toEqual(expect.arrayContaining(['/ngo/patrocinios', '/ngo/momentos', '/ngo/notifications']));
  });
  test('empresa: Notificaciones también en la barra inferior (en el celular no había otra forma de verlas)', () => {
    expect(NAV.company.tabs.map(i => i.label)).toEqual(['Panel', 'Explorar', 'Mensajes', 'Notificaciones', 'Perfil']);
  });
  test('ninguna barra inferior tiene más de cinco ítems', () => {
    for (const set of Object.values(NAV)) expect(set.tabs.length).toBeLessThanOrEqual(5);
  });
  test('navRole: un rol desconocido o sin sesión es visitante', () => {
    expect(navRole('ngo')).toBe('ngo');
    expect(navRole(undefined)).toBe('visitor');
    expect(navRole('admin')).toBe('visitor');
  });
  test('isActive: la ruta y sus subrutas; una que solo empieza igual no (/company/profilex)', () => {
    const profile = NAV.company.tabs.find(i => i.label === 'Perfil')!;
    expect(isActive(profile, '/company/profile')).toBe(true);
    expect(isActive(profile, '/company/profile/editar')).toBe(true);
    expect(isActive(profile, '/company/profilex')).toBe(false);
  });
  test('isActive: Panel de la ONG queda marcado en KPIs y equipo; "Crear" del voluntario nunca', () => {
    const panel = NAV.ngo.tabs.find(i => i.label === 'Panel')!;
    expect(isActive(panel, '/ngo/kpis/p1')).toBe(true);
    expect(isActive(panel, '/ngo/empleados/n1')).toBe(true);
    const create = NAV.volunteer.tabs.find(i => i.label === 'Crear')!;
    expect(isActive(create, '/momentos')).toBe(false);
  });
});

describe('<AppShell />', () => {
  test('voluntario: barra inferior con sus cinco destinos y el ítem activo marcado', () => {
    app('/explore');
    expect(labels(tabBar())).toEqual(['Inicio', 'Explorar', 'Crear', 'Mis voluntariados', 'Perfil']);
    expect(within(tabBar()).getByRole('link', { name: 'Explorar' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabBar()).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Pantalla')).toBeInTheDocument();
  });

  test('ONG: la lateral lleva a /ngo/notifications con el contador de no leídas', async () => {
    as('ngo');
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [], unread: 3 } as never);
    app('/ngo/dashboard');
    const link = within(sideBar()).getByRole('link', { name: 'Notificaciones' });
    expect(link).toHaveAttribute('href', '/ngo/notifications');
    await waitFor(() => expect(within(link).getAllByText('3').length).toBeGreaterThan(0));
    expect(screen.getByText('Panel de la ONG')).toBeInTheDocument();
  });

  test('si falla el pedido de no leídas, no muestra contador ni rompe', async () => {
    as('ngo');
    vi.mocked(api.notifications.list).mockRejectedValue(new Error('red'));
    app('/ngo/notifications');
    const link = within(sideBar()).getByRole('link', { name: 'Notificaciones' });
    expect(link).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(api.notifications.list).toHaveBeenCalled());
    expect(within(link).queryByText(/\d/)).not.toBeInTheDocument();
  });

  test('mensajes sin leer: el globito va solo en Mensajes y dice 9+ si son más de 9', () => {
    chat.unreadTotal = 12;
    app('/feed');
    const messages = within(sideBar()).getByRole('link', { name: 'Mensajes' });
    expect(within(messages).getAllByText('9+').length).toBeGreaterThan(0);
    expect(within(within(sideBar()).getByRole('link', { name: 'Explorar' })).queryByText('9+')).not.toBeInTheDocument();
  });

  test('barra superior en el Inicio del voluntario: logo, notificaciones y mensajes con su contador', async () => {
    chat.unreadTotal = 2;
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [], unread: 1 } as never);
    app('/feed');
    expect(await screen.findByRole('link', { name: 'Notificaciones, 1 sin leer' })).toHaveAttribute('href', '/notifications');
    expect(screen.getByRole('link', { name: 'Mensajes, 2 sin leer' })).toHaveAttribute('href', '/messages');
  });

  test('sin barra superior fuera de las pantallas de inicio', () => {
    app('/explore');
    expect(screen.queryByRole('link', { name: /^Notificaciones/ , hidden: false })).not.toBeNull(); // la de la lateral
    expect(screen.queryAllByRole('banner')).toHaveLength(0);
  });

  test('visitante: "Ingresar" (abajo) y "Crear cuenta" (lateral) abren el login; no hay "Cerrar sesión"', () => {
    as(null);
    app('/');
    fireEvent.click(within(tabBar()).getByRole('button', { name: 'Ingresar' }));
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(auth.openAuthModal).toHaveBeenLastCalledWith(expect.any(String), 'register');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    // En la portada, la barra superior ofrece ingresar
    expect(screen.getByRole('banner')).toHaveTextContent('Ingresar');
  });

  test('"Cerrar sesión" cierra la sesión y vuelve al inicio', () => {
    app('/explore');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  test('el perfil se dibuja con el avatar de la persona (iniciales sin foto)', () => {
    app('/profile');
    const perfil = within(tabBar()).getByRole('link', { name: 'Perfil' });
    expect(perfil).toHaveTextContent('AP');
    expect(perfil).toHaveAttribute('aria-current', 'page');
  });

  test('el botón de tema cambia a oscuro y lo recuerda', () => {
    app('/feed');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('v_theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema claro' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('el contenedor exterior no se encoge (flex-shrink-0, §128)', () => {
    const { container } = app('/feed');
    expect(container.firstElementChild).toHaveClass('flex-shrink-0');
  });
});

// D27 (Issue #28, sesión exploratoria §245): al pasar de una pantalla a otra se quedaba el scroll de la anterior
// (Explorar abría con scrollY = 1111). Criterio: una navegación nueva (link, navigate) vuelve arriba; "atrás" (POP)
// y un link a un #ancla no, para no pisar al navegador ni al ancla.
describe('volver arriba al cambiar de pantalla (D27)', () => {
  function Links() {
    const navigate = useNavigate();
    return (
      <>
        <Link to="/explore">a explorar</Link>
        <Link to="/ngo/profile#mercadopago">al ancla</Link>
        <button type="button" onClick={() => navigate(-1)}>atrás</button>
      </>
    );
  }
  const mount = () => render(
    <MemoryRouter initialEntries={['/feed']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<Links />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  test('un link a otra pantalla llama a scrollTo(0, 0)', () => {
    // Arrange
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mount();
    scrollTo.mockClear();

    // Act
    fireEvent.click(screen.getByRole('link', { name: 'a explorar' }));

    // Assert
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  test('"atrás" y un link con #ancla no vuelven arriba', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mount();
    fireEvent.click(screen.getByRole('link', { name: 'a explorar' }));
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'atrás' }));
    fireEvent.click(screen.getByRole('link', { name: 'al ancla' }));

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
