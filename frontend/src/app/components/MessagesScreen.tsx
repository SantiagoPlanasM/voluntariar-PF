import { useNavigate } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';
import { timeAgo } from '../../lib/format';

export function MessagesScreen() {
  const { user } = useAuth();
  const { conversations } = useChat();
  const navigate = useNavigate();

  const base = user?.role === 'ngo' ? '/ngo/messages' : '/messages';

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-5">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Mensajes</h1>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <MessageCircle className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">Todavía no tenés conversaciones.</p>
          <p className="text-xs text-gray-400 mt-1">
            {user?.role === 'ngo'
              ? 'Escribile a un voluntario inscripto desde el detalle de un proyecto.'
              : 'Escribile a una ONG desde su perfil.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map(c => (
            <button key={c.user.id} onClick={() => navigate(`${base}/${c.user.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors text-left">
              {c.user.avatar
                ? <img src={c.user.avatar} alt={c.user.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">
                    {c.user.name[0]}
                  </div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${c.unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                    {c.user.name}
                  </p>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(c.last_at)}</span>
                </div>
                <p className={`text-xs truncate ${c.unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {c.last_from_me ? 'Vos: ' : ''}{c.last_message}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="w-5 h-5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {c.unread > 9 ? '9+' : c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
