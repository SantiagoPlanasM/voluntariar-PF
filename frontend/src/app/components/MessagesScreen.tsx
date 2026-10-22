import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Pin, Search } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';
import { timeAgo, normalizeText } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { LogoMark } from '../ui/Logo';
import { messagesBase } from './AssistantScreen';

export function MessagesScreen() {
  const { user } = useAuth();
  const { conversations } = useChat();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const base = messagesBase(user?.role);
  const shown = q.trim()
    ? conversations.filter(c => normalizeText(c.user.name).includes(normalizeText(q)))
    : conversations;

  return (
    <div className="max-w-2xl mx-auto w-full bg-canvas min-h-screen">
      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.3px]">Mensajes</h1>
        <label className="h-10 px-3.5 rounded-[10px] bg-surface-soft flex items-center gap-2 text-ink-muted">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar conversaciones"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar"
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
      </div>

      {/* El asistente va fijado arriba de todo (reemplaza al botón flotante). */}
      <button type="button" onClick={() => navigate(`${base}/asistente`)} className="w-full h-[72px] px-4 flex items-center gap-3 text-left hover:bg-surface-soft transition-colors">
        <LogoMark size={56} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold">Asistente VoluntariAR</span>
          <span className="block text-[13px] text-ink-muted truncate">Preguntame lo que quieras sobre voluntariados</span>
        </span>
        <Pin size={16} strokeWidth={1.75} className="text-ink-muted" aria-label="Fijado" role="img" />
      </button>

      {shown.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-[15px] font-semibold">{q ? 'No encontramos esa conversación' : 'Todavía no tenés conversaciones'}</p>
          {!q && (
            <p className="text-[13px] text-ink-muted mt-1">
              {user?.role === 'ngo'
                ? 'Escribile a un voluntario inscripto desde el detalle de un voluntariado.'
                : 'Escribile a una ONG desde su perfil.'}
            </p>
          )}
        </div>
      ) : (
        <ul>
          {shown.map(c => {
            const unread = c.unread > 0;
            const kind = c.user.role === 'volunteer' ? 'person' : 'org';
            return (
              <li key={c.user.id}>
                <button type="button" onClick={() => navigate(`${base}/${c.user.id}`)}
                  className="w-full h-[72px] px-4 flex items-center gap-3 text-left hover:bg-surface-soft transition-colors">
                  <Avatar src={c.user.avatar} name={c.user.name} kind={kind} size={56} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-[15px] truncate ${unread ? 'font-bold' : 'font-semibold'}`}>{c.user.name}</span>
                      <span className="text-[13px] text-ink-muted flex-shrink-0">{timeAgo(c.last_at)}</span>
                    </span>
                    <span className={`block text-[13px] truncate ${unread ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
                      {c.last_from_me ? 'Vos: ' : ''}{c.last_message}
                    </span>
                  </span>
                  {unread && <span role="img" aria-label={`${c.unread} sin leer`} className="w-2 h-2 rounded-full bg-ink flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
