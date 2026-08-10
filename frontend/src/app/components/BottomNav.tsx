import { Link, useLocation } from 'react-router';
import { Home, Search, ClipboardList, User, Bell, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';

const links = [
  { to: '/feed',          icon: Home,          label: 'Inicio' },
  { to: '/explore',       icon: Search,        label: 'Explorar' },
  { to: '/participation', icon: ClipboardList, label: 'Mis acciones' },
  { to: '/messages',      icon: MessageCircle, label: 'Mensajes', chatBadge: true },
  { to: '/notifications', icon: Bell,          label: 'Alertas', badge: true },
  { to: '/profile',       icon: User,          label: 'Perfil' },
];

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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50 safe-area-pb">
      <div className="flex">
        {links.map(({ to, icon: Icon, label, badge, chatBadge }) => {
          const active = pathname === to || (to === '/messages' && pathname.startsWith('/messages/'));
          const count = chatBadge ? unreadTotal : (badge ? unread : 0);
          return (
            <Link key={to} to={to} className="flex-1 flex flex-col items-center py-2.5 gap-0.5 group relative">
              <div className={`w-10 h-6 rounded-full flex items-center justify-center transition-all ${active ? 'bg-emerald-100' : 'group-hover:bg-gray-100'}`}>
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-gray-400'}`} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              {count > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-12px)] w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
              <span className={`text-[10px] font-medium ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
