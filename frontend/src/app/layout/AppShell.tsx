// Layout único de la app (DESIGN.md → Layout y Navegación por rol): barra inferior en el celular, barra lateral
// en escritorio (solo íconos entre 768 y 1263 px, con nombres desde 1264 px) y una barra superior corta en las
// pantallas de inicio. Lo usan los tres layouts (Root, NGOLayout, CompanyLayout); antes cada uno tenía las suyas.
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Bell, LogIn, LogOut, MessageCircle, Moon, Sun } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useChatOptional } from '../../lib/ChatContext';
import { useTheme } from '../../lib/useTheme';
import { AuthModal } from '../components/AuthModal';
import { Avatar } from '../ui/Avatar';
import { Logo, LogoMark } from '../ui/Logo';
import { NAV, NavItem, isActive, navRole } from './navConfig';

function useBadges() {
  const { user } = useAuth();
  const unreadTotal = useChatOptional()?.unreadTotal ?? 0;
  const { pathname } = useLocation();
  const [notifications, setNotifications] = useState(0);
  useEffect(() => {
    if (!user) { setNotifications(0); return; }
    api.notifications.list().then(r => setNotifications(Number(r.unread) || 0)).catch(() => {});
  }, [user, pathname]);
  return { messages: unreadTotal, notifications };
}

function Badge({ n, className = '' }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span aria-hidden="true" className={`min-w-[18px] h-[18px] px-1 rounded-full bg-like text-white text-[11px] font-bold flex items-center justify-center ${className}`}>
      {n > 9 ? '9+' : n}
    </span>
  );
}

function ItemIcon({ item, active, size }: { item: NavItem; active: boolean; size: number }) {
  const { user } = useAuth();
  if (item.avatar && user) {
    return (
      <span className={`rounded-full ${active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''}`}>
        <Avatar src={user.avatar} name={user.name} kind={user.role === 'volunteer' ? 'person' : 'org'} size={size} />
      </span>
    );
  }
  const Icon = item.icon;
  return <Icon width={size} height={size} strokeWidth={active ? 2.25 : 1.75} className={active && item.fill ? 'fill-current' : ''} aria-hidden="true" />;
}

// ── Barra inferior (celular) ────────────────────────────────────────────────
function TabBar({ items, badges }: { items: NavItem[]; badges: Record<string, number> }) {
  const { pathname } = useLocation();
  const { openAuthModal } = useAuth();
  return (
    <nav
      aria-label="Principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-canvas border-t border-hairline flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      {items.map(item => {
        const active = isActive(item, pathname);
        const content = (
          <span className="relative flex items-center justify-center h-14 w-full">
            <ItemIcon item={item} active={active} size={item.avatar ? 26 : 24} />
            {item.badge && <Badge n={badges[item.badge] ?? 0} className="absolute top-2 left-1/2 ml-1.5" />}
          </span>
        );
        const cls = `flex-1 min-w-0 flex items-center justify-center ${active ? 'text-ink' : 'text-ink-soft'}`;
        return item.auth ? (
          <button key={item.label} type="button" aria-label={item.label} onClick={() => openAuthModal()} className={cls}>{content}</button>
        ) : (
          <Link key={item.to} to={item.to} aria-label={item.label} aria-current={active ? 'page' : undefined} className={cls}>{content}</Link>
        );
      })}
    </nav>
  );
}

// ── Barra lateral (escritorio) ──────────────────────────────────────────────
function SideNav({ items, badges, role }: { items: NavItem[]; badges: Record<string, number>; role: string }) {
  const { pathname } = useLocation();
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const { choice, setChoice } = useTheme();
  const dark = choice === 'dark' || (choice === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  const cls = 'group relative flex items-center gap-3.5 h-12 px-3 rounded-[10px] text-[15px] transition-colors hover:bg-surface-soft';
  const roleTag = role === 'ngo' ? 'Panel de la ONG' : role === 'company' ? 'Panel de la empresa' : '';

  return (
    <aside className="hidden md:flex sticky top-0 h-screen flex-shrink-0 flex-col gap-5 py-5 px-3 bg-surface border-r border-hairline z-30 w-[72px] min-[1264px]:w-[244px]">
      <Link to={role === 'visitor' ? '/' : '/feed'} aria-label="VoluntariAR, inicio" className="px-1.5 min-[1264px]:px-3 h-8 flex items-center">
        <span className="min-[1264px]:hidden"><LogoMark size={32} /></span>
        <span className="hidden min-[1264px]:inline-flex"><Logo /></span>
      </Link>
      {roleTag && <p className="hidden min-[1264px]:block -mt-3 px-3 text-xs text-ink-muted">{roleTag}</p>}

      <nav aria-label="Principal" className="flex flex-col gap-0.5 flex-1">
        {items.map(item => {
          const active = isActive(item, pathname);
          const inner = (
            <>
              <span className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
                <ItemIcon item={item} active={active} size={item.avatar ? 26 : 24} />
                {item.badge && <Badge n={badges[item.badge] ?? 0} className="absolute -top-1.5 -right-2 min-[1264px]:hidden" />}
              </span>
              <span className={`hidden min-[1264px]:block flex-1 text-left truncate ${active ? 'font-bold text-ink' : 'text-ink-soft'}`}>{item.label}</span>
              {item.badge && <Badge n={badges[item.badge] ?? 0} className="hidden min-[1264px]:flex" />}
            </>
          );
          const c = `${cls} ${active ? 'bg-surface-soft text-ink' : 'text-ink-soft'}`;
          return item.auth ? (
            <button key={item.label} type="button" aria-label={item.label} onClick={() => openAuthModal()} className={c}>{inner}</button>
          ) : (
            <Link key={item.to} to={item.to} aria-label={item.label} aria-current={active ? 'page' : undefined} className={c}>{inner}</Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setChoice(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          className={`${cls} text-ink-soft`}
        >
          <span className="w-6 h-6 flex items-center justify-center">{dark ? <Sun size={22} strokeWidth={1.75} /> : <Moon size={22} strokeWidth={1.75} />}</span>
          <span className="hidden min-[1264px]:block text-left">{dark ? 'Tema claro' : 'Tema oscuro'}</span>
        </button>
        {user ? (
          <button type="button" aria-label="Cerrar sesión" onClick={() => { logout(); navigate('/'); }} className={`${cls} text-ink-soft`}>
            <span className="w-6 h-6 flex items-center justify-center"><LogOut size={22} strokeWidth={1.75} /></span>
            <span className="hidden min-[1264px]:block text-left">Cerrar sesión</span>
          </button>
        ) : (
          <button type="button" aria-label="Crear cuenta" onClick={() => openAuthModal('Creá tu cuenta gratis y empezá a ayudar hoy', 'register')} className={`${cls} text-ink font-semibold`}>
            <span className="w-6 h-6 flex items-center justify-center"><LogIn size={22} strokeWidth={1.75} /></span>
            <span className="hidden min-[1264px]:block text-left">Crear cuenta</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Barra superior corta (celular, pantallas de inicio) ─────────────────────
const TOP_BAR_PATHS = new Set(['/', '/feed', '/momentos']);

function TopBar({ badges }: { badges: Record<string, number> }) {
  const { pathname } = useLocation();
  const { user, openAuthModal } = useAuth();
  if (!TOP_BAR_PATHS.has(pathname)) return null;
  const volunteer = user?.role === 'volunteer';
  return (
    <header className="md:hidden sticky top-0 z-20 h-[52px] px-4 flex items-center justify-between bg-canvas">
      <Link to={volunteer ? '/feed' : '/'} aria-label="VoluntariAR, inicio"><Logo /></Link>
      {volunteer ? (
        <div className="flex items-center -mr-3">
          <Link to="/notifications" aria-label={badges.notifications ? `Notificaciones, ${badges.notifications} sin leer` : 'Notificaciones'} className="relative w-11 h-11 flex items-center justify-center text-ink">
            <Bell size={24} strokeWidth={1.75} aria-hidden="true" />
            <Badge n={badges.notifications} className="absolute top-1.5 right-1" />
          </Link>
          <Link to="/messages" aria-label={badges.messages ? `Mensajes, ${badges.messages} sin leer` : 'Mensajes'} className="relative w-11 h-11 flex items-center justify-center text-ink">
            <MessageCircle size={24} strokeWidth={1.75} aria-hidden="true" />
            <Badge n={badges.messages} className="absolute top-1.5 right-1" />
          </Link>
        </div>
      ) : !user ? (
        <button type="button" onClick={() => openAuthModal()} className="h-10 px-4 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold">Ingresar</button>
      ) : null}
    </header>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const role = navRole(user?.role);
  const badges = useBadges();
  const set = NAV[role];
  return (
    // flex-shrink-0: #root es un flex en columna; sin esto el layout se encogía al alto de la pantalla (§128).
    <div className="min-h-screen bg-canvas-soft flex flex-shrink-0 text-ink">
      <SideNav items={set.side} badges={badges} role={role} />
      <div className="flex-1 min-w-0 flex flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <TopBar badges={badges} />
        <Outlet />
      </div>
      <TabBar items={set.tabs} badges={badges} />
      <AuthModal />
    </div>
  );
}
