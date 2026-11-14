// Única fuente de la navegación (DESIGN.md → Navegación por rol). La usan la barra inferior (celular) y la
// barra lateral (escritorio) de los tres layouts: antes había una lista por componente.
import type { LucideIcon } from 'lucide-react';
import {
  Home, Search, SquarePlus, CalendarCheck, MessageCircle, Bell, User, LayoutDashboard,
  Handshake, Camera, Users, Building2, Wallet, UserCheck, BadgeCheck, Settings,
} from 'lucide-react';

export type NavRole = 'volunteer' | 'ngo' | 'company' | 'visitor';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rellenar el ícono cuando está activo (los que tienen forma cerrada). */
  fill?: boolean;
  /** Contador que muestra el ítem: no leídos, invitaciones a equipos de ONG pendientes (§305) o postulaciones sin
   *  responder de la ONG (§336). */
  badge?: 'messages' | 'notifications' | 'team' | 'applications';
  /** Prefijos extra de ruta que también lo dejan activo. */
  also?: string[];
  /** El ítem de perfil se dibuja con el avatar de la persona. */
  avatar?: boolean;
  /** Abre el ingreso en vez de navegar. */
  auth?: boolean;
}

/** Grupo de la barra lateral que se despliega (§320): acordeón con nombres, panel flotante con solo íconos. */
export interface NavGroup {
  label: string;
  icon: LucideIcon;
  fill?: boolean;
  avatar?: boolean;
  children: NavItem[];
}

export type SideEntry = NavItem | NavGroup;

export interface NavSet {
  /** Barra inferior del celular: cinco ítems como máximo. */
  tabs: NavItem[];
  /** Barra lateral del escritorio: ítems sueltos o grupos (por ahora solo la ONG tiene grupos). */
  side: SideEntry[];
}

export function isGroup(e: SideEntry): e is NavGroup {
  return 'children' in e;
}

/** Todos los destinos de la barra lateral, con los de los grupos. */
export function flatSide(entries: SideEntry[]): NavItem[] {
  return entries.flatMap(e => (isGroup(e) ? e.children : [e]));
}

const explore: NavItem = { to: '/explore', label: 'Explorar', icon: Search };

const volunteer: NavSet = (() => {
  const home: NavItem = { to: '/feed', label: 'Inicio', icon: Home, fill: true };
  const create: NavItem = { to: '/momentos?crear=1', label: 'Crear', icon: SquarePlus };
  const mine: NavItem = { to: '/participation', label: 'Mis voluntariados', icon: CalendarCheck };
  const profile: NavItem = { to: '/profile', label: 'Perfil', icon: User, avatar: true, badge: 'team' };
  return {
    tabs: [home, explore, create, mine, profile],
    side: [
      home, explore, create, mine,
      { to: '/messages', label: 'Mensajes', icon: MessageCircle, fill: true, badge: 'messages' },
      { to: '/notifications', label: 'Notificaciones', icon: Bell, fill: true, badge: 'notifications' },
      profile,
    ],
  };
})();

// Lateral por grupos (§320, DESIGN.md → Navegación por rol): antes eran nueve ítems sueltos y Postulaciones y
// Validación solo se abrían desde el Panel. La barra inferior del celular no cambia.
const ngo: NavSet = (() => {
  const panelAlso = ['/ngo/kpis', '/ngo/empleados'];
  const panel: NavItem = { to: '/ngo/dashboard', label: 'Panel', icon: LayoutDashboard, fill: true, also: panelAlso };
  const create: NavItem = { to: '/ngo/create', label: 'Crear', icon: SquarePlus };
  const messages: NavItem = { to: '/ngo/messages', label: 'Mensajes', icon: MessageCircle, fill: true, badge: 'messages' };
  const profile: NavItem = { to: '/ngo/profile', label: 'Perfil', icon: User, avatar: true };
  return {
    tabs: [panel, explore, create, messages, profile],
    side: [
      { label: 'Panel', icon: LayoutDashboard, fill: true, children: [
        { to: '/ngo/dashboard', label: 'Resumen', icon: LayoutDashboard, also: panelAlso },
        { to: '/ngo/postulaciones', label: 'Postulaciones', icon: UserCheck, badge: 'applications' },   // §319; contador, §336
      ] },
      { ...create, label: 'Crear voluntariado' },
      { label: 'Comunidad', icon: Users, children: [
        { to: '/ngo/momentos', label: 'Publicaciones', icon: Camera },
        { to: '/ngo/equipo', label: 'Equipo', icon: Users },   // §296
      ] },
      { to: '/ngo/patrocinios', label: 'Patrocinios', icon: Handshake },
      messages,
      { to: '/ngo/notifications', label: 'Notificaciones', icon: Bell, fill: true, badge: 'notifications' },
      { label: 'Mi ONG', icon: User, avatar: true, children: [
        profile,
        { to: '/ngo/profile#mercadopago', label: 'Mercado Pago', icon: Wallet },
        { to: '/ngo/validacion', label: 'Validación', icon: BadgeCheck },   // §317
        { to: '/settings', label: 'Configuración', icon: Settings },
      ] },
      explore,
    ],
  };
})();

const company: NavSet = (() => {
  const panel: NavItem = { to: '/company/dashboard', label: 'Panel', icon: LayoutDashboard, fill: true };
  const messages: NavItem = { to: '/company/messages', label: 'Mensajes', icon: MessageCircle, fill: true, badge: 'messages' };
  const profile: NavItem = { to: '/company/profile', label: 'Perfil', icon: Building2, avatar: true };
  const notifications: NavItem = { to: '/notifications', label: 'Notificaciones', icon: Bell, fill: true, badge: 'notifications' };
  return {
    tabs: [panel, explore, messages, notifications, profile],
    side: [panel, explore, messages, notifications, profile],
  };
})();

const visitor: NavSet = (() => {
  const home: NavItem = { to: '/', label: 'Inicio', icon: Home, fill: true };
  const enter: NavItem = { to: '#ingresar', label: 'Ingresar', icon: Users, auth: true };
  return { tabs: [home, explore, enter], side: [home, explore, enter] };
})();

export const NAV: Record<NavRole, NavSet> = { volunteer, ngo, company, visitor };

export function navRole(role: string | undefined | null): NavRole {
  return role === 'volunteer' || role === 'ngo' || role === 'company' ? role : 'visitor';
}

// Un destino con #ancla (Mercado Pago, en el perfil) solo queda marcado con su ancla; el mismo destino sin ancla
// (Perfil) deja de estarlo cuando hay una.
export function isActive(item: NavItem, pathname: string, hash = ''): boolean {
  if (item.to.includes('crear=1')) return false;        // "Crear" nunca queda marcado: abre el compositor
  const [path, anchor = ''] = item.to.split('?')[0].split('#');
  if (anchor ? hash !== '#' + anchor : hash !== '' && pathname === path) return false;
  if (pathname === path || pathname.startsWith(path + '/')) return true;
  return (item.also ?? []).some(p => pathname === p || pathname.startsWith(p + '/'));
}

export function isGroupActive(group: NavGroup, pathname: string, hash = ''): boolean {
  return group.children.some(c => isActive(c, pathname, hash));
}
