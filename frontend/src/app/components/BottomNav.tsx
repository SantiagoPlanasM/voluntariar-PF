import { Link, useLocation } from 'react-router';
import { Home, Search, ClipboardList, User, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { COMPANY_NAV_LINKS } from './CompanyBottomNav';
import { NGO_NAV_LINKS } from './NGOBottomNav';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';

export function BottomNav() {
  const { pathname } = useLocation();
  const { user }      = useAuth();
  const { unreadTotal } = useChat();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.notifications.list()
      .then(r => setUnread(r.unread))
      .catch(() => {});
  }, [user, pathname]);

  let links = [
    { to: '/feed',          icon: Home,          label: 'Inicio',       chatBadge: false },
    { to: '/explore',       icon: Search,        label: 'Explorar',     chatBadge: false },
    { to: '/participation', icon: ClipboardList, label: 'Mis acciones', chatBadge: false },
    { to: '/messages',      icon: MessageCircle, label: 'Mensajes',     chatBadge: true },
    { to: '/profile',       icon: User,          label: 'Perfil',       chatBadge: false },
  ];
  let activeBg = 'bg-emerald-100';
  let activeColor = 'text-emerald-600';

  if (user?.role === 'company') {
    activeBg = 'bg-violet-100';
    activeColor = 'text-violet-600';
    // La misma lista que la barra del panel de empresa (REVISION S7: antes no tenía "Panel").
    links = COMPANY_NAV_LINKS.map(l => ({ ...l, chatBadge: !!l.chatBadge }));
  } else if (user?.role === 'ngo') {
    activeBg = 'bg-blue-100';
    activeColor = 'text-blue-600';
    // La misma lista que la barra del panel de la ONG (§121, decisión del usuario).
    links = NGO_NAV_LINKS.map(l => ({ ...l, chatBadge: !!l.chatBadge }));
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50 safe-area-pb">
      <div className="flex">
        {links.map(({ to, icon: Icon, label, chatBadge }) => {
          const active = pathname === to || (to.includes('/messages') && pathname.includes('/messages'));
          const count = chatBadge ? unreadTotal : 0;
          return (
            <Link key={to} to={to} className="flex-1 flex flex-col items-center py-2.5 gap-0.5 group relative">
              <div className={`w-10 h-6 rounded-full flex items-center justify-center transition-all ${active ? activeBg : 'group-hover:bg-gray-100'}`}>
                <Icon className={`w-4 h-4 ${active ? activeColor : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              {count > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-12px)] w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
              <span className={`text-[10px] font-medium ${active ? activeColor : 'text-gray-400'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
