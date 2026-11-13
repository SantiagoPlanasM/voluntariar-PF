// src/app/layout/SideNavGroups.test.tsx
//
// Barra lateral de la ONG por grupos (§320). Antes eran nueve ítems sueltos y Postulaciones y Validación solo se
// abrían desde el Panel. Ahora los ítems relacionados van en grupos que se despliegan: con nombres (≥ 1024 px) como
// acordeón, abierto solo si estás en una de sus pantallas; con solo íconos (768–1023 px) como un panel flotante.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Routes, Route } from 'react-router';

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
  return { ...actual, api: { ...actual.api,
    notifications: { ...actual.api.notifications, list: vi.fn() },
    team: { ...actual.api.team, mine: vi.fn() } } };
});

import { api } from '../../lib/api';
import { AppShell } from './AppShell';
import { NAV, flatSide, isActive, isGroup } from './navConfig';

const ngo = () => {
  auth.user = { id: 'u-ngo', name: 'Ana Pérez', email: 'ana@x.com', role: 'ngo', avatar: null };
};

// Pantalla de prueba con links para navegar sin pasar por la barra.
function Screen() {
  return (
    <>
      <p>Pantalla</p>
      <Link to="/ngo/equipo">ir al equipo</Link>
      <Link to="/ngo/messages">ir a mensajes</Link>
    </>
  );
}

function app(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<Screen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const sideBar = () => screen.getAllByRole('navigation', { name: 'Principal' })[0];
const group = (name: string) => within(sideBar()).getByRole('button', { name });

// Ancho de la ventana para la media query de la barra (con nombres desde 1024 px).
function setWidth(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q === '(min-width: 1024px)' ? wide : false,
    media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  ngo();
  chat.unreadTotal = 0;
  vi.mocked(api.notifications.list).mockReset().mockResolvedValue({ notifications: [], unread: 0 } as never);
  vi.mocked(api.team.mine).mockReset().mockResolvedValue({ memberships: [] });
  setWidth(true);
  // ScrollToTop vuelve arriba al navegar; jsdom no tiene scrollTo y lo avisa por consola.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { window.matchMedia = realMatchMedia; vi.restoreAllMocks(); });

describe('navConfig: barra lateral de la ONG por grupos', () => {
  test('arriba van Panel, Crear voluntariado, Comunidad, Patrocinios, Mensajes, Notificaciones, Mi ONG y Explorar', () => {
    expect(NAV.ngo.side.map(e => e.label)).toEqual([
      'Panel', 'Crear voluntariado', 'Comunidad', 'Patrocinios', 'Mensajes', 'Notificaciones', 'Mi ONG', 'Explorar',
    ]);
  });

  test('cada grupo con sus pantallas: Postulaciones y Validación ahora están en la barra', () => {
    const children = (label: string) => {
      const e = NAV.ngo.side.find(x => x.label === label)!;
      if (!isGroup(e)) throw new Error(`${label} no es un grupo`);
      return e.children.map(c => [c.label, c.to]);
    };
    expect(children('Panel')).toEqual([['Resumen', '/ngo/dashboard'], ['Postulaciones', '/ngo/postulaciones']]);
    expect(children('Comunidad')).toEqual([['Publicaciones', '/ngo/momentos'], ['Equipo', '/ngo/equipo']]);
    expect(children('Mi ONG')).toEqual([
      ['Perfil', '/ngo/profile'], ['Mercado Pago', '/ngo/profile#mercadopago'],
      ['Validación', '/ngo/validacion'], ['Configuración', '/settings'],
    ]);
  });

  test('no se pierde ningún destino de la barra anterior', () => {
    const to = flatSide(NAV.ngo.side).map(i => i.to);
    for (const old of ['/ngo/dashboard', '/ngo/create', '/ngo/patrocinios', '/ngo/momentos', '/ngo/equipo',
      '/explore', '/ngo/messages', '/ngo/notifications', '/ngo/profile']) expect(to).toContain(old);
  });

  test('la barra inferior del celular no cambia', () => {
    expect(NAV.ngo.tabs.map(i => i.label)).toEqual(['Panel', 'Explorar', 'Crear', 'Mensajes', 'Perfil']);
  });

  test('isActive con ancla: Mercado Pago solo con #mercadopago; Perfil, sin él', () => {
    const mi = NAV.ngo.side.find(x => x.label === 'Mi ONG')!;
    if (!isGroup(mi)) throw new Error('Mi ONG no es un grupo');
    const [perfil, mp] = mi.children;
    expect(isActive(perfil, '/ngo/profile', '')).toBe(true);
    expect(isActive(mp, '/ngo/profile', '')).toBe(false);
    expect(isActive(mp, '/ngo/profile', '#mercadopago')).toBe(true);
    expect(isActive(perfil, '/ngo/profile', '#mercadopago')).toBe(false);
  });

  test('Resumen queda marcado en el detalle de un voluntariado, en KPIs y en empleados', () => {
    const panel = NAV.ngo.side.find(x => x.label === 'Panel')!;
    if (!isGroup(panel)) throw new Error('Panel no es un grupo');
    const [resumen, postulaciones] = panel.children;
    for (const p of ['/ngo/dashboard', '/ngo/dashboard/project/p1', '/ngo/kpis/p1', '/ngo/empleados/n1']) {
      expect(isActive(resumen, p)).toBe(true);
    }
    expect(isActive(postulaciones, '/ngo/dashboard')).toBe(false);
    // Un ancla en una subruta no le saca la marca (solo cuenta en la ruta exacta del ítem).
    expect(isActive(resumen, '/ngo/dashboard/project/p1', '#cupos')).toBe(true);
  });

  test('voluntario y empresa siguen sin grupos', () => {
    expect(NAV.volunteer.side.some(isGroup)).toBe(false);
    expect(NAV.company.side.some(isGroup)).toBe(false);
  });
});

describe('barra con nombres (≥ 1024 px): acordeón', () => {
  test('abre solo el grupo de la pantalla actual y marca la pantalla', () => {
    app('/ngo/postulaciones');
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'true');
    expect(within(sideBar()).getByRole('link', { name: 'Postulaciones' })).toHaveAttribute('aria-current', 'page');
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'false');
    expect(within(sideBar()).queryByRole('link', { name: 'Publicaciones' })).not.toBeInTheDocument();
  });

  test('tocar un grupo lo abre y lo cierra; el botón dice qué lista controla', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(group('Comunidad').getAttribute('aria-controls')!)!;
    expect(within(list).getByRole('link', { name: 'Publicaciones' })).toHaveAttribute('href', '/ngo/momentos');
    expect(within(list).getByRole('link', { name: 'Equipo' })).toHaveAttribute('href', '/ngo/equipo');
    fireEvent.click(group('Comunidad'));
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'false');
    expect(within(sideBar()).queryByRole('link', { name: 'Equipo' })).not.toBeInTheDocument();
  });

  // Con tres grupos abiertos, en una notebook de 633 px de alto la barra desbordaba (visto en Chrome, §320).
  test('abrir un grupo cierra el que estaba abierto', () => {
    app('/ngo/postulaciones');
    fireEvent.click(group('Comunidad'));
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'true');
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(group('Mi ONG'));
    expect(group('Mi ONG')).toHaveAttribute('aria-expanded', 'true');
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'false');
  });

  test('los ítems no se encogen cuando la barra desborda (scroll en vez de aplastarlos)', () => {
    app('/ngo/dashboard');
    for (const el of Array.from(sideBar().children)) expect(el).toHaveClass('flex-shrink-0');
  });

  test('ir a una pantalla suelta (Mensajes) no cierra el grupo abierto', () => {
    app('/ngo/postulaciones');
    fireEvent.click(screen.getByRole('link', { name: 'ir a mensajes' }));
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape en el acordeón no le roba el foco al link', () => {
    app('/ngo/postulaciones');
    const link = within(sideBar()).getByRole('link', { name: 'Resumen' });
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(link).toHaveFocus();
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'true');
  });

  test('se puede cerrar el grupo de la pantalla actual', () => {
    app('/ngo/postulaciones');
    fireEvent.click(group('Panel'));
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'false');
  });

  test('al llegar a una pantalla de un grupo cerrado, el grupo se abre', () => {
    app('/ngo/dashboard');
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('link', { name: 'ir al equipo' }));
    expect(group('Comunidad')).toHaveAttribute('aria-expanded', 'true');
    expect(within(sideBar()).getByRole('link', { name: 'Equipo' })).toHaveAttribute('aria-current', 'page');
  });

  test('Mi ONG se dibuja con el avatar de la ONG y abre en Configuración', () => {
    app('/settings');
    expect(group('Mi ONG')).toHaveTextContent('AP');
    expect(group('Mi ONG')).toHaveAttribute('aria-expanded', 'true');
    expect(within(sideBar()).getByRole('link', { name: 'Configuración' })).toHaveAttribute('aria-current', 'page');
  });

  // T6 (§334): el aro del ítem activo era siempre redondo y el avatar de una organización es cuadrado.
  test('el aro del avatar activo sigue la forma del avatar de la organización (cuadrado redondeado)', () => {
    app('/settings');
    const ring = group('Mi ONG').querySelector('[data-initial]')!.parentElement!;
    expect(ring.className).toContain('ring-2');
    expect(ring.className).toContain('rounded-[28%]');
    expect(ring.className).not.toContain('rounded-full');
  });

  test('los ítems sueltos siguen siendo links con su contador', async () => {
    vi.mocked(api.notifications.list).mockResolvedValue({ notifications: [], unread: 4 } as never);
    app('/ngo/dashboard');
    const link = within(sideBar()).getByRole('link', { name: 'Notificaciones' });
    expect(link).toHaveAttribute('href', '/ngo/notifications');
    await waitFor(() => expect(within(link).getAllByText('4').length).toBeGreaterThan(0));
    expect(within(sideBar()).getByRole('link', { name: 'Crear voluntariado' })).toHaveAttribute('href', '/ngo/create');
  });
});

describe('barra de solo íconos (768–1023 px): panel flotante', () => {
  beforeEach(() => setWidth(false));

  test('no abre nada solo: ni el grupo de la pantalla actual', () => {
    app('/ngo/postulaciones');
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'false');
    expect(group('Panel')).not.toHaveAttribute('aria-controls');   // no apunta a un panel que no existe
    expect(within(sideBar()).queryByRole('link', { name: 'Postulaciones' })).not.toBeInTheDocument();
  });

  test('tocar un grupo abre su panel con los nombres; tocar otro cambia de panel', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    const panel = screen.getByRole('group', { name: 'Comunidad' });
    expect(within(panel).getByRole('link', { name: 'Publicaciones' })).toBeVisible();
    fireEvent.click(group('Mi ONG'));
    expect(screen.queryByRole('group', { name: 'Comunidad' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Mi ONG' })).getByRole('link', { name: 'Validación' }))
      .toHaveAttribute('href', '/ngo/validacion');
  });

  test('Escape cierra el panel y devuelve el foco al botón', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.keyDown(screen.getByRole('group', { name: 'Comunidad' }), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Comunidad' })).not.toBeInTheDocument();
    expect(group('Comunidad')).toHaveFocus();
  });

  test('cerrado el panel, Escape ya no hace nada (los listeners se sacan)', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.keyDown(document, { key: 'Escape' });
    const link = within(sideBar()).getByRole('link', { name: 'Patrocinios' });
    link.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(link).toHaveFocus();
  });

  test('solo Escape lo cierra: otras teclas no', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('group', { name: 'Comunidad' })).toBeInTheDocument();
  });

  test('el foco que sale de un grupo ya cerrado no cierra el panel de otro', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.mouseDown(group('Mi ONG'));
    fireEvent.click(group('Mi ONG'));
    fireEvent.focusOut(group('Comunidad'), { relatedTarget: within(sideBar()).getByRole('link', { name: 'Patrocinios' }) });
    expect(screen.getByRole('group', { name: 'Mi ONG' })).toBeInTheDocument();
  });

  test('un clic afuera lo cierra; uno adentro no', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.mouseDown(screen.getByRole('group', { name: 'Comunidad' }));
    expect(screen.getByRole('group', { name: 'Comunidad' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Pantalla'));
    expect(screen.queryByRole('group', { name: 'Comunidad' })).not.toBeInTheDocument();
  });

  test('ir a otra pantalla lo cierra', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.click(screen.getByRole('link', { name: 'ir a mensajes' }));
    expect(screen.queryByRole('group', { name: 'Comunidad' })).not.toBeInTheDocument();
  });

  test('el foco que sale del grupo lo cierra (navegación con Tab)', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    const out = within(sideBar()).getByRole('link', { name: 'Patrocinios' });
    fireEvent.focusOut(group('Comunidad'), { relatedTarget: out });
    expect(screen.queryByRole('group', { name: 'Comunidad' })).not.toBeInTheDocument();
  });

  // Safari no enfoca el link al tocarlo: el foco sale sin destino y cerrar ahí perdería el clic.
  test('si el foco sale sin destino conocido, el panel sigue abierto', () => {
    app('/ngo/dashboard');
    fireEvent.click(group('Comunidad'));
    fireEvent.focusOut(group('Comunidad'), { relatedTarget: null });
    expect(screen.getByRole('group', { name: 'Comunidad' })).toBeInTheDocument();
  });
});

describe('cambio de ancho de la ventana', () => {
  test('al pasar de solo íconos a nombres, los grupos pasan a acordeón', () => {
    let listener = () => {};
    const mq = { matches: false, media: '', addEventListener: vi.fn((_: string, l: () => void) => { listener = l; }), removeEventListener: vi.fn() };
    window.matchMedia = vi.fn().mockReturnValue(mq) as unknown as typeof window.matchMedia;
    app('/ngo/postulaciones');
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'false');
    mq.matches = true;
    act(() => listener());
    expect(group('Panel')).toHaveAttribute('aria-expanded', 'true');
    expect(within(sideBar()).getByRole('link', { name: 'Postulaciones' })).toHaveAttribute('aria-current', 'page');
  });
});
