// src/app/components/ChatSend.test.tsx
//
// Decisión del usuario (§92): el chat manda SIEMPRE por REST. Antes, con el WebSocket conectado, ChatThread
// mandaba por el socket y borraba el borrador; si el servidor rechazaba el mensaje (error, límite de frecuencia
// de §87, destinatario inválido) la respuesta {type:'error'} no la escuchaba nadie y el mensaje se perdía sin
// aviso. Por REST, el error vuelve en la misma respuesta: se muestra y el borrador se restaura.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const { socketSend } = vi.hoisted(() => ({ socketSend: vi.fn(() => true) }));
vi.mock('../../lib/AuthContext', () => {
  const auth = { user: { id: 'u-me', name: 'María', role: 'volunteer' } };
  return { useAuth: () => auth };
});
// Socket "conectado": el código viejo lo usaba en vez de REST (sendViaSocket devolvía true).
vi.mock('../../lib/ChatContext', () => ({
  useChat: () => ({ onMessage: () => () => {}, sendViaSocket: socketSend, refreshConversations: () => {} }),
}));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: { ...actual.api, messages: { ...actual.api.messages,
      thread: vi.fn().mockResolvedValue({ messages: [], other: { id: 'u-juan', name: 'Juan' } }),
      markRead: vi.fn().mockResolvedValue({}), send: vi.fn() } },
  };
});

import { api, ApiError } from '../../lib/api';
import { ChatThread } from './ChatThread';

const mount = () => render(
  <MemoryRouter initialEntries={['/messages/u-juan']}>
    <Routes><Route path="/messages/:userId" element={<ChatThread />} /></Routes>
  </MemoryRouter>
);
const write = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Mensaje' }), { target: { value: text } });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  socketSend.mockClear();
  vi.mocked(api.messages.send).mockReset();
});

describe('ChatThread: enviar', () => {
  test('con el socket conectado igual manda por REST y muestra el mensaje guardado', async () => {
    vi.mocked(api.messages.send).mockResolvedValue({ message: {
      id: 'm1', sender_id: 'u-me', receiver_id: 'u-juan', body: 'Hola Juan', read: false, created_at: '2026-10-15T12:00:00Z' } } as never);
    mount();
    await screen.findByRole('heading', { name: 'Juan' });
    write('Hola Juan');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(api.messages.send).toHaveBeenCalledWith('u-juan', 'Hola Juan'));
    expect(socketSend).not.toHaveBeenCalled();
    expect(await screen.findByText('Hola Juan')).toBeInTheDocument();
  });

  test('si el servidor lo rechaza, se ve el error y el borrador vuelve (no se pierde)', async () => {
    vi.mocked(api.messages.send).mockRejectedValue(new ApiError('Estás enviando mensajes muy rápido. Esperá unos segundos.', 429));
    mount();
    await screen.findByRole('heading', { name: 'Juan' });
    write('Mensaje importante');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('Estás enviando mensajes muy rápido. Esperá unos segundos.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensaje' })).toHaveValue('Mensaje importante');
  });
});
