import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useChat } from '../../lib/ChatContext';
import { api, ChatMessage } from '../../lib/api';

function formatTime(iso: string) {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatThread() {
  const { userId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { onMessage, sendViaSocket, refreshConversations } = useChat();

  const [other, setOther]       = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [draft, setDraft]       = useState('');
  const [sending, setSending]   = useState(false);
  const [err, setErr]           = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const backTo = user?.role === 'ngo' ? '/ngo/messages' : '/messages';

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api.messages.thread(userId)
      .then(r => { setMessages(r.messages); setOther(r.other); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
    api.messages.markRead(userId).then(refreshConversations).catch(() => {});
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
      const sentViaSocket = sendViaSocket(userId, body);
      if (!sentViaSocket) {
        const { message } = await api.messages.send(userId, body);
        setMessages(prev => [...prev, message]);
      }
      refreshConversations();
    } catch (e: any) { setErr(e.message); setDraft(body); }
    finally { setSending(false); }
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => navigate(backTo)} className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        {other?.avatar
          ? <img src={other.avatar} alt={other.name} className="w-9 h-9 rounded-full object-cover" />
          : <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
              {other?.name?.[0] || '?'}
            </div>
        }
        <h1 className="text-sm font-bold text-gray-900">{other?.name || 'Cargando...'}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-10">Todavía no hay mensajes. ¡Escribí el primero!</p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                  mine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-gray-400'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {err && <p className="text-xs text-red-500 px-4 pb-1">{err}</p>}

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Escribí un mensaje..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button onClick={handleSend} disabled={!draft.trim() || sending}
          className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0 hover:bg-emerald-700 transition-colors">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
