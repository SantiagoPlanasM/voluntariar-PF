// Única fuente de la navegación (DESIGN.md → Navegación por rol). La usan la barra inferior (celular) y la
// barra lateral (escritorio) de los tres layouts: antes había una lista por componente.
import type { LucideIcon } from 'lucide-react';
import {
  Home, Search, SquarePlus, CalendarCheck, MessageCircle, Bell, User, LayoutDashboard,
  Handshake, Camera, Users, Building2,
} from 'lucide-react';

export type NavRole = 'volunteer' | 'ngo' | 'company' | 'visitor';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rellenar el ícono cuando está activo (los que tienen forma cerrada). */
  fill?: boolean;
  /** Contador que muestra el ítem: no leídos, o invitaciones a equipos de ONG pendientes (§305). */
  badge?: 'messages' | 'notifications' | 'team';
  /** Prefijos extra de ruta que también lo dejan activo. */
  also?: string[];
  /** El ítem de perfil se dibuja con el avatar de la persona. */
  avatar?: boolean;
  /** Abre el ingreso en vez de navegar. */
  auth?: boolean;
}

export interface NavSet {
  /** Barra inferior del celular: cinco ítems como máximo. */
  tabs: NavItem[];
  /** Barra lateral del escritorio. */
  side: NavItem[];
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

const ngo: NavSet = (() => {
  const panel: NavItem = { to: '/ngo/dashboard', label: 'Panel', icon: LayoutDashboard, fill: true, also: ['/ngo/kpis', '/ngo/empleados'] };
  const create: NavItem = { to: '/ngo/create', label: 'Crear', icon: SquarePlus };
  const messages: NavItem = { to: '/ngo/messages', label: 'Mensajes', icon: MessageCircle, fill: true, badge: 'messages' };
  const profile: NavItem = { to: '/ngo/profile', label: 'Perfil', icon: User, avatar: true };
  return {
    tabs: [panel, explore, create, messages, profile],
    side: [
      panel, create,
      { to: '/ngo/patrocinios', label: 'Patrocinios', icon: Handshake },
      { to: '/ngo/momentos', label: 'Publicaciones', icon: Camera },
      { to: '/ngo/equipo', label: 'Equipo', icon: Users },   // §296
      explore, messages,
      { to: '/ngo/notifications', label: 'Notificaciones', icon: Bell, fill: true, badge: 'notifications' },
      profile,
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

export function isActive(item: NavItem, pathname: string): boolean {
  const base = item.to.split('?')[0];
  if (item.to.includes('crear=1')) return false;        // "Crear" nunca queda marcado: abre el compositor
  if (pathname === base || pathname.startsWith(base + '/')) return true;
  return (item.also ?? []).some(p => pathname === p || pathname.startsWith(p + '/'));
}
