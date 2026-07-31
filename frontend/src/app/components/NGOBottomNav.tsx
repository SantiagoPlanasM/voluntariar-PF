import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Plus, User, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

const links = [
  { to: '/ngo/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ngo/create',    icon: Plus,            label: 'Crear' },
  { to: '/ngo/profile',   icon: User,            label: 'Mi ONG' },
];

export function NGOBottomNav() {
  const { pathname } = useLocation();
  const { logout }   = useAuth();
  const navigate     = useNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
      <div className="flex">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link key={to} to={to} className="flex-1 flex flex-col items-center py-2.5 gap-0.5 group">
              {label === 'Crear'
                ? <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-blue-600' : 'bg-blue-100 group-hover:bg-blue-200'}`}>
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-blue-600'}`} strokeWidth={2.5} />
                  </div>
                : <div className={`w-10 h-6 rounded-full flex items-center justify-center transition-all ${active ? 'bg-blue-100' : 'group-hover:bg-gray-100'}`}>
                    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
                  </div>
              }
              <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </Link>
          );
        })}

        {/* Botón logout en mobile */}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="flex-1 flex flex-col items-center py-2.5 gap-0.5 group">
          <div className="w-10 h-6 rounded-full flex items-center justify-center group-hover:bg-red-50 transition-all">
            <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-500" strokeWidth={1.8} />
          </div>
          <span className="text-[10px] font-medium text-red-400">Salir</span>
        </button>
      </div>
    </nav>
  );
}
