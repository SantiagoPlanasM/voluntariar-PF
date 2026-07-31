import { Link, useLocation } from 'react-router';
import { Home, Search, ClipboardList, User } from 'lucide-react';

const links = [
  { to: '/feed',          icon: Home,          label: 'Inicio' },
  { to: '/explore',       icon: Search,        label: 'Explorar' },
  { to: '/participation', icon: ClipboardList, label: 'Participaciones' },
  { to: '/profile',       icon: User,          label: 'Perfil' },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50 safe-area-pb">
      <div className="flex">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className="flex-1 flex flex-col items-center py-2.5 gap-0.5 group">
              <div className={`w-10 h-6 rounded-full flex items-center justify-center transition-all ${active?'bg-emerald-100':'group-hover:bg-gray-100'}`}>
                <Icon className={`w-4 h-4 ${active?'text-emerald-600':'text-gray-400'}`} strokeWidth={active?2.5:1.8}/>
              </div>
              <span className={`text-[10px] font-medium ${active?'text-emerald-600':'text-gray-400'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
