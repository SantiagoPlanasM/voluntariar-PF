// Asistente de ayuda (FAQ). Antes era un botón flotante en todas las pantallas; ahora vive como la primera
// conversación fijada de Mensajes (DESIGN.md → Asistente). La lógica es la misma: preguntas frecuentes por
// categoría de rol, con sugerencias cuando no hay una coincidencia exacta.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Send } from 'lucide-react';
import { api, Faq } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { LogoMark } from '../ui/Logo';

type ChatEntry =
  | { from: 'user'; text: string }
  | { from: 'bot'; text: string; suggestions?: { id: string; pregunta: string }[] };

// Mismo criterio de categorías que se cargó en scripts/migrate.js. No filtra para 'company' (todavía no tiene
// FAQs propias: se le muestra el pool general + ONG).
function categoriaPorRol(role?: string): string | undefined {
  if (role === 'ngo') return 'ngo';
  if (role === 'volunteer') return 'voluntario';
  return undefined;
}

export function messagesBase(role?: string) {
  return role === 'ngo' ? '/ngo/messages' : role === 'company' ? '/company/messages' : '/messages';
}

export function AssistantScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [suggestions, setSuggestions] = useState<Faq[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const categoria = categoriaPorRol(user?.role);

  useEffect(() => {
    api.faqs.list(categoria).then(({ faqs }) => setSuggestions(faqs.slice(0, 4))).catch(() => {});
  }, [categoria]);

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [history, asking]);

  const ask = async (question: string) => {
    if (!question.trim() || asking) return;
    setHistory(h => [...h, { from: 'user', text: question }]);
    setInput('');
    setAsking(true);
    try {
      const res = await api.faqs.ask(question, categoria);
      if (res.matched && res.best) {
        setHistory(h => [...h, { from: 'bot', text: res.best!.respuesta }]);
      } else {
        setHistory(h => [...h, {
          from: 'bot',
          text: 'No encontré una respuesta exacta. Probá con alguna de estas preguntas:',
          suggestions: res.suggestions || [],
        }]);
      }
    } catch {
      setHistory(h => [...h, { from: 'bot', text: 'No pude procesar tu pregunta. Probá de nuevo en un momento.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col h-[calc(100dvh-56px)] md:h-screen bg-canvas">
      <header className="flex items-center gap-3 px-2 h-14 border-b border-hairline flex-shrink-0">
        <Link to={messagesBase(user?.role)} aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
          <ArrowLeft size={22} strokeWidth={1.75} />
        </Link>
        <LogoMark size={32} />
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-tight">Asistente VoluntariAR</h1>
          <p className="text-[13px] text-ink-muted leading-tight">Dudas sobre voluntariados, donaciones y tu cuenta</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        <div className="self-start max-w-[75%] px-3.5 py-2.5 rounded-[20px] rounded-bl-[6px] bg-surface-soft text-[15px] leading-snug">
          Hola, soy el asistente. Preguntame lo que quieras o elegí una de estas:
        </div>
        {history.length === 0 && (
          <div className="flex flex-col gap-2 items-start">
            {suggestions.map(f => (
              <button key={f.id} type="button" onClick={() => ask(f.pregunta)}
                className="text-left text-[15px] px-3.5 py-2.5 rounded-[20px] border border-hairline hover:bg-surface-soft transition-colors max-w-[85%]">
                {f.pregunta}
              </button>
            ))}
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} className={`flex ${entry.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-3.5 py-2.5 rounded-[20px] text-[15px] leading-snug ${
              entry.from === 'user' ? 'bg-ink text-on-ink rounded-br-[6px]' : 'bg-surface-soft text-ink rounded-bl-[6px]'
            }`}>
              <p className="whitespace-pre-wrap break-words">{entry.text}</p>
              {entry.from === 'bot' && entry.suggestions && entry.suggestions.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {entry.suggestions.map(s => (
                    <button key={s.id} type="button" onClick={() => ask(s.pregunta)}
                      className="text-left text-[13px] px-3 py-2 rounded-[10px] bg-canvas hover:bg-surface-pressed transition-colors">
                      {s.pregunta}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {asking && (
          <div role="status" aria-label="Escribiendo" className="self-start px-4 py-3 rounded-[20px] rounded-bl-[6px] bg-surface-soft flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse [animation-delay:300ms]" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); void ask(input); }} className="flex items-center gap-2 px-3 py-2 border-t border-hairline flex-shrink-0">
        <input
          aria-label="Tu pregunta"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribí tu pregunta…"
          className="flex-1 h-11 bg-surface-soft rounded-full px-4 text-[15px] focus:outline-none focus:bg-surface focus:ring-[1.5px] focus:ring-ink"
        />
        {input.trim() && (
          <button type="submit" disabled={asking} aria-label="Enviar pregunta" className="h-11 px-2 text-[15px] font-bold text-ink disabled:opacity-40">
            Enviar
          </button>
        )}
        {!input.trim() && <span className="w-11 h-11 flex items-center justify-center text-ink-muted" aria-hidden="true"><Send size={20} strokeWidth={1.75} /></span>}
      </form>
    </div>
  );
}
