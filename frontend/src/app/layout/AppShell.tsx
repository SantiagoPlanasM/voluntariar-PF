// Layout único de la app (DESIGN.md → Layout y Navegación por rol): barra inferior en el celular, barra lateral
// en escritorio (solo íconos entre 768 y 1023 px, con nombres desde 1024 px, §320) y una barra superior corta en las
// pantallas de inicio. Lo usan los tres layouts (Root, NGOLayout, CompanyLayout); antes cada uno tenía las suyas.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import { Bell, ChevronDown, LogIn, LogOut, MessageCircle, Moon, Sun } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useChatOptional } from '../../lib/ChatContext';
import { useTheme } from '../../lib/useTheme';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { AuthModal } from '../components/AuthModal';
import { Avatar } from '../ui/Avatar';
import { Logo, LogoMark } from '../ui/Logo';
import { NAV, NavGroup, NavItem, SideEntry, isActive, isGroup, isGroupActive, navRole } from './navConfig';

function useBadges() {
  const { user } = useAuth();
  const unreadTotal = useChatOptional()?.unreadTotal ?? 0;
  const { pathname } = useLocation();
  const [notifications, setNotifications] = useState(0);
  useEffect(() => {
    if (!user) { setNotifications(0); return; }
    api.notifications.list().then(r => setNotifications(Number(r.unread) || 0)).catch(() => {});
  }, [user, pathname]);
  // Invitaciones a equipos de ONG sin responder (§305), en Perfil: solo las tiene un voluntario. Se vuelve a pedir
  // al cambiar de pantalla, como las notificaciones, para que aceptar o rechazar borre el contador.
  const [team, setTeam] = useState(0);
  useEffect(() => {
    if (user?.role !== 'volunteer') { setTeam(0); return; }
    api.team.mine().then(r => setTeam(r.memberships.filter(m => m.status === 'invited').length)).catch(() => {});
  }, [user, pathname]);
  return { messages: unreadTotal, notifications, team };
}

function Badge({ n, className = '' }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span aria-hidden="true" className={`min-w-[18px] h-[18px] px-1 rounded-full bg-critical text-on-ink text-xs font-bold flex items-center justify-center ${className}`}>
      {n > 9 ? '9+' : n}
    </span>
  );
}

function ItemIcon({ item, active, size }: { item: Pick<NavItem, 'icon' | 'fill' | 'avatar'>; active: boolean; size: number }) {
  const { user } = useAuth();
  if (item.avatar && user) {
    // El aro del ítem activo sigue la forma del avatar: redondo para una persona, cuadrado redondeado para una organización.
    const org = user.role !== 'volunteer';
    return (
      <span className={`inline-flex ${org ? 'rounded-[28%]' : 'rounded-full'} ${active ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''}`}>
        <Avatar src={user.avatar} name={user.name} kind={org ? 'org' : 'person'} size={size} />
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
const ITEM = 'group relative flex flex-shrink-0 items-center gap-3.5 h-11 px-3 rounded-[10px] text-[15px] transition-colors hover:bg-surface-soft';

// Con nombres desde 1024 px (lg). Los grupos se comportan distinto según el ancho, así que hace falta saberlo en JS
// además de en CSS. Sin matchMedia (tests viejos, navegadores raros) se asume la barra con nombres.
const useWide = () => useMediaQuery('(min-width: 1024px)', true);

function SideLink({ item, badges }: { item: NavItem; badges: Record<string, number> }) {
  const { pathname, hash } = useLocation();
  const { openAuthModal } = useAuth();
  const active = isActive(item, pathname, hash);
  const inner = (
    <>
      <span className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
        <ItemIcon item={item} active={active} size={item.avatar ? 26 : 24} />
        {item.badge && <Badge n={badges[item.badge] ?? 0} className="absolute -top-1.5 -right-2 lg:hidden" />}
      </span>
      <span className={`hidden lg:block flex-1 text-left truncate ${active ? 'font-bold text-ink' : 'text-ink-soft'}`}>{item.label}</span>
      {item.badge && <Badge n={badges[item.badge] ?? 0} className="hidden lg:flex" />}
    </>
  );
  const c = `${ITEM} ${active ? 'bg-surface-soft text-ink' : 'text-ink-soft'}`;
  return item.auth ? (
    <button type="button" aria-label={item.label} onClick={() => openAuthModal()} className={c}>{inner}</button>
  ) : (
    <Link to={item.to} aria-label={item.label} aria-current={active ? 'page' : undefined} className={c}>{inner}</Link>
  );
}

// Grupo que se despliega (§320). Con nombres es un acordeón: la lista va debajo, con sangría. Con solo íconos es un
// panel flotante al costado (position: fixed, para que no lo recorte el scroll de la barra); se cierra con Escape
// (el foco vuelve al botón), con un clic afuera, al sacar el foco con Tab o al cambiar de pantalla.
function SideGroup({ group, id, wide, expanded, onToggle, onClose }: {
  group: NavGroup; id: string; wide: boolean; expanded: boolean; onToggle: () => void; onClose: () => void;
}) {
  const { pathname, hash } = useLocation();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});
  const active = isGroupActive(group, pathname, hash);
  const floating = !wide && expanded;

  // Listeners y no manejadores en el <div> (Sonar S6848, §323: un div con onKeyDown parece un control sin serlo).
  useEffect(() => {
    if (!floating) return;
    const el = box.current;
    const onDown = (e: MouseEvent) => { if (!el?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); button.current?.focus(); } };
    // Solo si el foco va a otro lado conocido: sin relatedTarget (Safari al tocar un link) cerrar perdería el clic.
    const onOut = (e: FocusEvent) => { if (e.relatedTarget && !el?.contains(e.relatedTarget as Node)) onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    el?.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      el?.removeEventListener('focusout', onOut);
    };
  }, [floating, onClose]);

  const toggle = () => {
    if (!wide && !expanded && button.current) {
      const r = button.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 12 });
    }
    onToggle();
  };

  return (
    <div ref={box} className="flex-shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={group.label}
        aria-expanded={expanded}
        aria-controls={wide || expanded ? id : undefined}
        onClick={toggle}
        className={`${ITEM} w-full ${active && !(wide && expanded) ? 'bg-surface-soft text-ink' : 'text-ink-soft'}`}
      >
        <span className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
          <ItemIcon item={group} active={active} size={group.avatar ? 26 : 24} />
        </span>
        <span className={`hidden lg:block flex-1 text-left truncate ${active ? 'font-bold text-ink' : 'text-ink-soft'}`}>{group.label}</span>
        <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" className={`hidden lg:block flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {wide ? (
        <ul id={id} hidden={!expanded} className="flex flex-col gap-0.5 mt-0.5">
          {group.children.map(c => {
            const on = isActive(c, pathname, hash);
            return (
              <li key={c.to}>
                <Link
                  to={c.to}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center h-9 pl-[50px] pr-3 rounded-[10px] text-[14px] transition-colors hover:bg-surface-soft truncate ${on ? 'bg-surface-soft font-bold text-ink' : 'text-ink-soft'}`}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : floating && (
        <div
          id={id}
          role="group"
          aria-label={group.label}
          style={pos}
          className="fixed z-40 w-56 p-1.5 rounded-xl bg-surface border border-hairline shadow-lg"
        >
          <p className="px-3 pt-1.5 pb-1 text-xs font-bold text-ink-muted">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.children.map(c => {
              const on = isActive(c, pathname, hash);
              const Icon = c.icon;
              return (
                <li key={c.to}>
                  <Link
                    to={c.to}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-3 h-10 px-3 rounded-[10px] text-[14px] transition-colors hover:bg-surface-soft ${on ? 'bg-surface-soft font-bold text-ink' : 'text-ink-soft'}`}
                  >
                    <Icon size={18} strokeWidth={on ? 2.25 : 1.75} aria-hidden="true" className="flex-shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const groupId = (label: string) => `nav-${label.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-')}`;

function SideNav({ items, badges, role }: { items: SideEntry[]; badges: Record<string, number>; role: string }) {
  const { pathname, hash } = useLocation();
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const { choice, setChoice } = useTheme();
  const dark = choice === 'dark' || (choice === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  const roleTag = role === 'ngo' ? 'Panel de la ONG' : role === 'company' ? 'Panel de la empresa' : '';
  const wide = useWide();

  // Acordeón de a un grupo abierto (con tres abiertos, en una notebook de 633 px de alto la barra desbordaba): el de
  // la pantalla actual. Se recalcula solo al cambiar de pantalla, para que se pueda cerrar a mano el grupo en el que
  // estás. El panel flotante (solo íconos) se cierra al cambiar de pantalla.
  const groups = items.filter(isGroup);
  const activeGroup = () => groups.find(g => isGroupActive(g, pathname, hash))?.label ?? null;
  const [open, setOpen] = useState<string | null>(activeGroup);
  const [floating, setFloating] = useState<string | null>(null);
  useEffect(() => {
    const now = activeGroup();
    if (now) setOpen(now);
    setFloating(null);
  }, [pathname, hash]);
  const closeFloating = useRef(() => setFloating(null)).current;

  return (
    <aside className="hidden md:flex sticky top-0 h-screen flex-shrink-0 flex-col gap-4 py-4 px-3 bg-surface border-r border-hairline z-30 w-[72px] lg:w-[244px]">
      <Link to={role === 'visitor' ? '/' : '/feed'} aria-label="VoluntariAR, inicio" className="px-1.5 lg:px-3 h-8 flex items-center">
        <span className="lg:hidden"><LogoMark size={32} /></span>
        <span className="hidden lg:inline-flex"><Logo /></span>
      </Link>
      {roleTag && <p className="hidden lg:block -mt-3 px-3 text-xs text-ink-muted">{roleTag}</p>}

      <nav aria-label="Principal" className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] lg:[scrollbar-width:thin]">
        {items.map(entry => isGroup(entry) ? (
          <SideGroup
            key={entry.label}
            group={entry}
            id={groupId(entry.label)}
            wide={wide}
            expanded={(wide ? open : floating) === entry.label}
            onToggle={() => (wide ? setOpen : setFloating)(g => (g === entry.label ? null : entry.label))}
            onClose={closeFloating}
          />
        ) : (
          <SideLink key={entry.to} item={entry} badges={badges} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setChoice(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          className={`${ITEM} text-ink-soft`}
        >
          <span className="w-6 h-6 flex items-center justify-center">{dark ? <Sun size={22} strokeWidth={1.75} /> : <Moon size={22} strokeWidth={1.75} />}</span>
          <span className="hidden lg:block text-left">{dark ? 'Tema claro' : 'Tema oscuro'}</span>
        </button>
        {user ? (
          <button type="button" aria-label="Cerrar sesión" onClick={() => { logout(); navigate('/'); }} className={`${ITEM} text-ink-soft`}>
            <span className="w-6 h-6 flex items-center justify-center"><LogOut size={22} strokeWidth={1.75} /></span>
            <span className="hidden lg:block text-left">Cerrar sesión</span>
          </button>
        ) : (
          <button type="button" aria-label="Crear cuenta" onClick={() => openAuthModal('Creá tu cuenta gratis y empezá a ayudar hoy', 'register')} className={`${ITEM} text-ink font-semibold`}>
            <span className="w-6 h-6 flex items-center justify-center"><LogIn size={22} strokeWidth={1.75} /></span>
            <span className="hidden lg:block text-left">Crear cuenta</span>
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
          <Link to="/notifications" aria-label={badges.notifications ? `Notificaciones, ${badges.notifications} sin leer` : 'Notificaciones'} className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center text-ink">
            <Bell size={24} strokeWidth={1.75} aria-hidden="true" />
            <Badge n={badges.notifications} className="absolute top-1.5 right-1" />
          </Link>
          <Link to="/messages" aria-label={badges.messages ? `Mensajes, ${badges.messages} sin leer` : 'Mensajes'} className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center text-ink">
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

// Una pantalla nueva arranca arriba: antes se quedaba el scroll de la anterior (D27, §247). "Atrás" (POP) y los
// links a un #ancla no se tocan. No es <ScrollRestoration>: ese necesita un router de datos y los tests usan MemoryRouter.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === 'POP' || hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);
  return null;
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
        <ScrollToTop />
        <Outlet />
      </div>
      <TabBar items={set.tabs} badges={badges} />
      <AuthModal />
    </div>
  );
}
