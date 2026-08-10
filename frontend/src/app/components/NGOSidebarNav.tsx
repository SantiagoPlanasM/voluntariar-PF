import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Plus, User, LogOut, Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';

export function NGOSidebarNav() {
  const { pathname }     = useLocation();
  const { user, logout } = useAuth();
  const { unreadTotal }  = useChat();
  const navigate         = useNavigate();

  const links = [
    { to: '/ngo/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ngo/create',    icon: Plus,            label: 'Nuevo Voluntariado' },
    { to: '/ngo/messages',  icon: MessageCircle,   label: 'Mensajes', badge: unreadTotal },
    { to: '/ngo/profile',   icon: User,            label: 'Mi ONG' },
  ];

  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 sticky top-0 h-screen bg-white border-r border-gray-100 flex-col z-30 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-black text-lg text-gray-900">Voluntariar</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 ml-10">Panel ONG</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label, badge }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative ${
                active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
              <span className="flex-1">{label}</span>
              {!!badge && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">{user.name[0]}</div>
            }
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
