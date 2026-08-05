import { Outlet, useLocation, Link, useNavigate } from 'react-router';
import { BottomNav } from './BottomNav';
import { NGOBottomNav } from './NGOBottomNav';
import { AuthModal } from './AuthModal';
import { useAuth } from '../../lib/AuthContext';
import {
  Home, Search, ClipboardList, User, Heart,
  LayoutDashboard, Plus, LogOut,
} from 'lucide-react';

export function Root() {
  const { pathname } = useLocation();
  const isNGO    = pathname.startsWith('/ngo');
  const isPublic = pathname === '/';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className={`flex-1 flex flex-col w-full ${!isPublic ? 'pb-16 md:pb-0' : ''}`}>
        <Outlet />
      </div>
      {!isPublic && (
        <>
          <div className="md:hidden">
            {isNGO ? <NGOBottomNav /> : <BottomNav />}
          </div>
          <div className="hidden md:block">
            {isNGO ? <NGOSidebarNav /> : <SidebarNav />}
          </div>
        </>
      )}
      <AuthModal />
    </div>
  );
}

// ── Sidebar voluntario ────────────────────────────────────────────────────
function SidebarNav() {
  const { pathname } = useLocation();
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/feed',          icon: Home,          label: 'Inicio' },
    { to: '/explore',       icon: Search,        label: 'Explorar' },
    { to: '/participation', icon: ClipboardList, label: 'Participaciones' },
    { to: '/profile',       icon: User,          label: 'Mi Perfil' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-100 flex-col z-30 shadow-sm">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-black text-lg text-gray-900">Voluntariar</span>
        </div>
      </div>

      {/* Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon className={`w-5 h-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">{user.name[0]}</div>
              }
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
              <LogOut className="w-5 h-5" strokeWidth={1.8} />
              Cerrar sesión
            </button>
          </>
        ) : (
          <button
            onClick={() => openAuthModal('Iniciá sesión para continuar')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors">
            <LogOut className="w-5 h-5 rotate-180" strokeWidth={1.8} />
            Iniciar sesión
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Sidebar ONG ───────────────────────────────────────────────────────────
function NGOSidebarNav() {
  const { pathname } = useLocation();
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/ngo/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ngo/create',    icon: Plus,            label: 'Nuevo Voluntariado' },
    { to: '/ngo/profile',   icon: User,            label: 'Mi ONG' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-100 flex-col z-30 shadow-sm">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-black text-lg text-gray-900">Voluntariar</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 ml-10">Panel ONG</p>
      </div>

      {/* Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">{user.name[0]}</div>
              }
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
              <LogOut className="w-5 h-5" strokeWidth={1.8} />
              Cerrar sesión
            </button>
          </>
        ) : (
          <button
            onClick={() => openAuthModal('Iniciá sesión para continuar')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            <LogOut className="w-5 h-5 rotate-180" strokeWidth={1.8} />
            Iniciar sesión
          </button>
        )}
      </div>
    </aside>
  );
}
