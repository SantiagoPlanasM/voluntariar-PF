import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api, BASE, ChatMessage, Conversation } from './api';

interface ChatContextValue {
  conversations: Conversation[];
  unreadTotal: number;
  connected: boolean;
  refreshConversations: () => void;
  /** Se suscribe a mensajes entrantes por WS. Devuelve la función para desuscribirse. */
  onMessage: (cb: (m: ChatMessage) => void) => () => void;
  /** Intenta mandar por el socket abierto; devuelve false si no hay conexión (usar REST como fallback). */
  sendViaSocket: (to: string, body: string) => boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [connected, setConnected]         = useState(false);
  const wsRef        = useRef<WebSocket | null>(null);
  const listenersRef  = useRef<Set<(m: ChatMessage) => void>>(new Set());

  const refreshConversations = useCallback(() => {
    if (!user) { setConversations([]); return; }
    api.messages.conversations().then(r => setConversations(r.conversations)).catch(() => {});
  }, [user]);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // Conexión de WebSocket: se abre al loguearse, se cierra al desloguearse.
  // Si se corta sola (reinicio del server, blip de red, la laptop se
  // suspende y despierta), reconecta sola con backoff exponencial — antes
  // no había reconexión y el usuario dejaba de recibir mensajes en tiempo
  // real hasta recargar la página a mano.
  useEffect(() => {
    if (!user || !token) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      return;
    }

    // BASE es algo como "http://localhost:3001/api" — el WS vive en la raíz del
    // mismo host/puerto, en /ws (no bajo /api).
    const wsUrl = BASE.replace(/\/api\/?$/, '').replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(token)}`;

    let closedByEffect = false;      // true solo si se desmonta/desloguea a propósito
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { setConnected(true); attempt = 0; };

      ws.onclose = () => {
        setConnected(false);
        if (closedByEffect) return; // cierre intencional (logout/unmount) — no reconectar
        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000); // 1s, 2s, 4s, 8s, tope 10s
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => setConnected(false);

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'message') {
            refreshConversations();
            listenersRef.current.forEach(cb => cb(data.message));
          }
        } catch { /* mensaje no-JSON, ignorar */ }
      };
    }

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, token, refreshConversations]);

  const onMessage = useCallback((cb: (m: ChatMessage) => void) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  const sendViaSocket = useCallback((to: string, body: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return false;
    ws.send(JSON.stringify({ type: 'send', to, body }));
    return true;
  }, []);

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <ChatContext.Provider value={{ conversations, unreadTotal, connected, refreshConversations, onMessage, sendViaSocket }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat debe usarse dentro de <ChatProvider>');
  return ctx;
}