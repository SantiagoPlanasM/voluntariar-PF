import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Plus, User, LogOut, MessageCircle, Handshake, Search } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';

// Única lista de la barra inferior de la ONG: la usa también BottomNav en las pantallas públicas (§121,
// decisión del usuario). "Explorar" es el único acceso de la ONG a /explore en el celular.
export const NGO_NAV_LINKS = [
  { to: '/ngo/dashboard',   icon: LayoutDashboard, label: 'Panel' },
  { to: '/ngo/create',      icon: Plus,            label: 'Crear' },
  { to: '/ngo/patrocinios', icon: Handshake,       label: 'Sponsors' },
  { to: '/explore',         icon: Search,          label: 'Explorar' },
  { to: '/ngo/messages',    icon: MessageCircle,   label: 'Mensajes', chatBadge: true },
  { to: '/ngo/profile',     icon: User,            label: 'Mi ONG' },
];
const links = NGO_NAV_LINKS;

export function NGOBottomNav() {
  const { pathname } = useLocation();
  const { logout }   = useAuth();
  const { unreadTotal } = useChat();
  const navigate     = useNavigate();

  const handleLogout = () => {
    if (window.confirm('¿Querés cerrar sesión?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch">
        {links.map(({ to, icon: Icon, label, chatBadge }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          const count = chatBadge ? unreadTotal : 0;
          return (
            <Link key={to} to={to} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 group min-w-0 relative">
              {label === 'Crear' ? (
                <div className={`w-11 h-8 rounded-2xl flex items-center justify-center transition-all ${
                  active ? 'bg-blue-600 shadow-md shadow-blue-200' : 'bg-blue-100 group-active:bg-blue-200'
                }`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-blue-600'}`} strokeWidth={2.5} />
                </div>
              ) : (
                <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all relative ${
                  active ? 'bg-blue-50' : 'group-active:bg-gray-100'
                }`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </div>
              )}
              <span className={`text-[10px] font-semibold truncate max-w-full px-1 ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}>{label}</span>
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 border-l border-gray-100 active:bg-red-50 transition-colors"
        >
          <div className="w-10 h-7 rounded-xl bg-red-50 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-red-500" strokeWidth={2} />
          </div>
          <span className="text-[10px] font-semibold text-red-500">Salir</span>
        </button>
      </div>
    </nav>
  );
}
