// src/app/components/MessagesScreen.test.tsx — la lista de conversaciones (TP de Calidad, cobertura del frontend, §210).
// Criterio de aceptación (antes de escribir los casos; el componente estaba en 0 %):
//  - sin conversaciones: "Todavía no tenés conversaciones." con la ayuda según el rol (ONG: escribirle a un voluntario
//    inscripto; los demás: escribirle a una ONG);
//  - cada conversación muestra la foto o la inicial, el nombre, "Vos: " si el último mensaje es propio, y un contador de
//    no leídos (con "9+" a partir de 10), y el nombre en negrita solo si hay no leídos;
//  - tocar una conversación lleva al hilo con la ruta del rol: /messages, /ngo/messages o /company/messages.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { state, navigate } = vi.hoisted(() => ({
  state: { user: null as null | { role: string }, conversations: [] as unknown[] },
  navigate: vi.fn(),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../../lib/ChatContext', () => ({ useChat: () => ({ conversations: state.conversations }) }));
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));

import { MessagesScreen } from './MessagesScreen';

const conv = (over: Record<string, unknown> = {}) => ({
  user: { id: 'u1', name: 'Ana Paz', avatar: null }, last_message: 'Hola, ¿cómo va?', last_at: new Date().toISOString(),
  last_from_me: false, unread: 0, ...over,
});

beforeEach(() => { navigate.mockReset(); state.user = { role: 'volunteer' }; state.conversations = []; });

describe('MessagesScreen: sin conversaciones', () => {
  test('voluntario: el aviso y la ayuda de escribirle a una ONG', () => {
    // Arrange: sin conversaciones, rol voluntario. Act:
    render(<MessagesScreen />);
    // Assert
    expect(screen.getByText('Todavía no tenés conversaciones.')).toBeInTheDocument();
    expect(screen.getByText('Escribile a una ONG desde su perfil.')).toBeInTheDocument();
  });

  test('ONG: la ayuda de escribirle a un voluntario inscripto', () => {
    state.user = { role: 'ngo' };
    render(<MessagesScreen />);
    expect(screen.getByText('Escribile a un voluntario inscripto desde el detalle de un proyecto.')).toBeInTheDocument();
  });
});

describe('MessagesScreen: con conversaciones', () => {
  test('foto o inicial, "Vos: " si el último es propio, y sin contador si está todo leído', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: 'https://x/ana.jpg' }, last_from_me: true, last_message: 'Nos vemos' }),
      conv({ user: { id: 'u2', name: 'Beto Ruiz', avatar: null } }),
    ];
    render(<MessagesScreen />);
    expect(screen.getByRole('img', { name: 'Ana Paz' })).toHaveAttribute('src', 'https://x/ana.jpg');
    expect(screen.getByText('B')).toBeInTheDocument();   // inicial de Beto, sin foto
    expect(screen.getByText(/Vos: Nos vemos/)).toBeInTheDocument();
    expect(screen.queryByText(/^Vos: Hola/)).not.toBeInTheDocument();
    expect(screen.getByText('Ana Paz').className).toContain('font-semibold');
  });

  test('no leídos: número exacto hasta 9, "9+" desde 10, y el nombre en negrita', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: null }, unread: 3 }),
      conv({ user: { id: 'u2', name: 'Beto Ruiz', avatar: null }, unread: 12 }),
    ];
    render(<MessagesScreen />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('9+')).toBeInTheDocument();
    expect(screen.getByText('Ana Paz').className).toContain('font-bold');
  });

  test('el límite: 9 se muestra tal cual, 10 ya es "9+"', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: null }, unread: 9 }),
      conv({ user: { id: 'u2', name: 'Beto Ruiz', avatar: null }, unread: 10 }),
    ];
    render(<MessagesScreen />);
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('9+')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });

  test.each([
    ['volunteer', '/messages/u1'],
    ['ngo', '/ngo/messages/u1'],
    ['company', '/company/messages/u1'],
  ])('rol %s: tocar la conversación lleva a %s', (role, ruta) => {
    state.user = { role };
    state.conversations = [conv()];
    render(<MessagesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Ana Paz/ }));
    expect(navigate).toHaveBeenCalledWith(ruta);
  });
});
