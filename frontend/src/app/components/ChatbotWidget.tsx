import { useState, useRef, useEffect } from 'react';
import { MessageCircleQuestion, X, Send, Loader2 } from 'lucide-react';
import { api, Faq } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

type ChatEntry =
  | { from: 'user'; text: string }
  | { from: 'bot'; text: string; suggestions?: { id: string; pregunta: string }[] };

// Mapea el rol de la sesión a la categoría de FAQ más relevante — mismo
// criterio de categorías que se cargó en scripts/migrate.js. No filtra para
// 'company' (todavía no tiene FAQs propias, se le muestra el pool general+ONG).
function categoriaPorRol(role?: string): string | undefined {
  if (role === 'ngo') return 'ngo';
  if (role === 'volunteer') return 'voluntario';
  return undefined;
}

export function ChatbotWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [suggestions, setSuggestions] = useState<Faq[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const categoria = categoriaPorRol(user?.role);

  useEffect(() => {
    if (open && history.length === 0) {
      api.faqs.list(categoria).then(({ faqs }) => setSuggestions(faqs.slice(0, 4))).catch(() => {});
    }
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [history]);

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
      setHistory(h => [...h, { from: 'bot', text: 'Uy, no pude procesar tu pregunta. Probá de nuevo en un momento.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-white">
              <MessageCircleQuestion className="w-5 h-5" />
              <span className="font-bold text-sm">Ayuda rápida</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {history.length === 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Preguntame algo o elegí una de estas:</p>
                <div className="space-y-1.5">
                  {suggestions.map(f => (
                    <button key={f.id} onClick={() => ask(f.pregunta)}
                      className="w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors">
                      {f.pregunta}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {history.map((entry, i) => (
              <div key={i} className={entry.from === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  entry.from === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  <p>{entry.text}</p>
                  {entry.from === 'bot' && entry.suggestions && entry.suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entry.suggestions.map(s => (
                        <button key={s.id} onClick={() => ask(s.pregunta)}
                          className="block w-full text-left text-xs px-2 py-1.5 bg-white hover:bg-emerald-50 rounded-lg transition-colors">
                          {s.pregunta}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
              placeholder="Escribí tu pregunta..."
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button onClick={() => ask(input)} disabled={asking || !input.trim()}
              className="w-9 h-9 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl flex-shrink-0 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl flex items-center justify-center z-40 transition-colors"
        title="Ayuda rápida"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircleQuestion className="w-6 h-6" />}
      </button>
    </>
  );
}
