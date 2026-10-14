// src/lib/ChatContext.test.tsx
//
// REVISION.md F10: si el servidor cerraba el WebSocket con 4001 (token inválido o vencido, ws/index.js),
// ChatContext reconectaba con backoff hasta 10 s PARA SIEMPRE: con ese token cada intento falla igual.
// Ahora con 4001 deja de reconectar; ante un corte normal (reinicio del server, red) sigue reconectando.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

// Referencias estables, como en la app: si useAuth devolviera un objeto nuevo en cada render, el efecto
// (que depende de user) reabriría el socket en cada render y el test contaría conexiones de más.
const auth = { user: { id: 'u1', name: 'María', email: 'm@example.com', role: 'volunteer' }, token: 'tok-123' };
vi.mock('./AuthContext', () => ({ useAuth: () => auth }));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    api: { ...actual.api, messages: { ...actual.api.messages, conversations: vi.fn().mockResolvedValue({ conversations: [] }) } },
  };
});

import { ChatProvider } from './ChatContext';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send() {}
  close() {}
  serverCloses(code: number) { this.readyState = 3; this.onclose?.({ code }); }
}

describe('ChatProvider: reconexión del WebSocket', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const mount = () => render(<ChatProvider><p>hijo</p></ChatProvider>);

  test('un corte normal (1006) reconecta', async () => {
    mount();
    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => FakeWebSocket.instances[0].serverCloses(1006));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  test('un cierre 4001 (token inválido o vencido) NO reconecta', async () => {
    mount();
    act(() => FakeWebSocket.instances[0].serverCloses(4001));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
