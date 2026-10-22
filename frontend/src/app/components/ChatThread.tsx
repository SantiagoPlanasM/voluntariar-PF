import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';
import { api, ChatMessage } from '../../lib/api';
import { formatTime } from '../../lib/format';

export function ChatThread() {
  const { userId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { onMessage, refreshConversations } = useChat();

  const [other, setOther]       = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [draft, setDraft]       = useState('');
  const [sending, setSending]   = useState(false);
  const [err, setErr]           = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const backTo = user?.role === 'ngo' ? '/ngo/messages' : user?.role === 'company' ? '/company/messages' : '/messages';

  useEffect(() => {
    if (!userId) return;
    // Si se cambia de conversación antes de que llegue la respuesta, esa respuesta (o su error) ya no es de
    // este hilo: se descarta. Antes, si llegaba última, pisaba al hilo nuevo (REVISION F15).
    let cancelled = false;
    setLoading(true);
    setErr('');
    api.messages.thread(userId)
      .then(r => { if (!cancelled) { setMessages(r.messages); setOther(r.other); } })
      .catch(e => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.messages.markRead(userId).then(refreshConversations).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return onMessage(m => {
      if (m.sender_id === userId || m.receiver_id === userId) {
        setMessages(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id === userId) api.messages.markRead(userId).then(refreshConversations).catch(() => {});
      }
    });
  }, [userId, onMessage, refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !userId || sending) return;
    setSending(true); setErr('');
    setDraft('');
    try {
      // Siempre por REST (decisión del usuario, PROJECT_ANALYSIS.md §92): si el servidor rechaza el mensaje, el
      // error vuelve acá y el borrador se restaura. Antes, con el socket abierto se mandaba por ahí y un rechazo
      // ({type:'error'}) no lo escuchaba nadie: el mensaje se perdía sin aviso. El socket queda para recibir.
      const { message } = await api.messages.send(userId, body);
      setMessages(prev => (prev.some(p => p.id === message.id) ? prev : [...prev, message]));
      refreshConversations();
    } catch (e: any) { setErr(e.message); setDraft(body); }
    finally { setSending(false); }
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col h-[calc(100dvh-56px)] md:h-screen bg-canvas">
      <header className="flex items-center gap-2 px-2 h-14 border-b border-hairline bg-canvas sticky top-0 z-10 flex-shrink-0">
        <button type="button" onClick={() => navigate(backTo)} aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
          <ArrowLeft size={22} strokeWidth={1.75} />
        </button>
        <Avatar src={other?.avatar} name={other?.name || '?'} kind={other && 'role' in other && (other as any).role !== 'volunteer' ? 'org' : 'person'} size={32} />
        <h1 className="text-[15px] font-semibold">{other?.name || 'Cargando…'}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
        {loading ? (
          <div role="status" aria-label="Cargando mensajes" className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-ink-muted" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[13px] text-ink-muted py-10">Todavía no hay mensajes. Escribí el primero.</p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2 rounded-[20px] text-[15px] leading-snug ${mine ? 'bg-ink text-on-ink rounded-br-[6px]' : 'bg-surface-soft text-ink rounded-bl-[6px]'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-xs mt-0.5 ${mine ? 'text-on-ink/70' : 'text-ink-muted'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {err && <p role="alert" className="text-[13px] text-critical px-4 pb-1">{err}</p>}

      <div className="flex items-center gap-2 px-3 py-2 border-t border-hairline bg-canvas flex-shrink-0">
        <input
          aria-label="Mensaje"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
          placeholder="Mensaje…"
          className="flex-1 h-11 bg-surface-soft rounded-full px-4 text-[15px] focus:outline-none focus:bg-surface focus:ring-[1.5px] focus:ring-ink"
        />
        <button type="button" onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Enviar mensaje"
          className="w-11 h-11 rounded-full bg-ink text-on-ink flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-opacity">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
