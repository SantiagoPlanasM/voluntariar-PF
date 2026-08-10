import { Outlet, useLocation, Link, useNavigate } from 'react-router';
import { BottomNav } from './BottomNav';
import { AuthModal } from './AuthModal';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Home, Search, ClipboardList, User, Heart,
  LogOut, Bell, MessageCircle,
} from 'lucide-react';

export function Root() {
  const isPublic = useLocation().pathname === '/';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className={`flex-1 flex flex-col w-full ${!isPublic ? 'pb-16 md:pb-0' : ''}`}>
        <Outlet />
      </div>
      {!isPublic && (
        <>
          <div className="md:hidden"><BottomNav /></div>
          <div className="hidden md:block"><SidebarNav /></div>
        </>
      )}
      <AuthModal />
    </div>
  );
}

// ── Sidebar voluntario ────────────────────────────────────────────────────
function SidebarNav() {
  const { pathname }      = useLocation();
  const { user, logout }  = useAuth();
  const { unreadTotal }   = useChat();
  const navigate          = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.notifications.list().then(r => setUnread(r.unread)).catch(() => {});
  }, [user, pathname]);

  const links = [
    { to: '/feed',          icon: Home,          label: 'Inicio' },
    { to: '/explore',       icon: Search,        label: 'Explorar' },
    { to: '/participation', icon: ClipboardList, label: 'Participaciones' },
    { to: '/messages',      icon: MessageCircle, label: 'Mensajes', badge: unreadTotal },
    { to: '/notifications', icon: Bell,          label: 'Notificaciones', badge: unread },
    { to: '/profile',       icon: User,          label: 'Mi Perfil' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-100 flex-col z-30 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-black text-lg text-gray-900">Voluntariar</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label, badge }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative ${
                active ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-emerald-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        {user && (
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
        )}
        <button onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          <LogOut className="w-5 h-5" strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

