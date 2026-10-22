// src/app/components/MessagesScreen.test.tsx — la lista de conversaciones (TP de Calidad, cobertura del frontend, §210).
// Actualizado en el rediseño (§240, DESIGN.md → Mensajes): el contador numérico pasó a ser un punto (con la cantidad
// en su nombre accesible), arriba está el asistente fijado y hay un buscador.
// Criterio de aceptación (antes de escribir los casos; el componente estaba en 0 %):
//  - sin conversaciones: "Todavía no tenés conversaciones" con la ayuda según el rol (ONG: escribirle a un voluntario
//    inscripto; los demás: escribirle a una ONG);
//  - cada conversación muestra la foto o las iniciales, el nombre, "Vos: " si el último mensaje es propio, y un punto
//    de no leídos (que dice cuántos), con el nombre en negrita solo si hay no leídos;
//  - tocar una conversación lleva al hilo con la ruta del rol: /messages, /ngo/messages o /company/messages; el
//    asistente lleva a <base>/asistente;
//  - el buscador filtra por nombre (sin importar tildes ni mayúsculas) y, si no hay nada, lo dice.
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
    expect(screen.getByText('Todavía no tenés conversaciones')).toBeInTheDocument();
    expect(screen.getByText('Escribile a una ONG desde su perfil.')).toBeInTheDocument();
  });

  test('ONG: la ayuda de escribirle a un voluntario inscripto', () => {
    state.user = { role: 'ngo' };
    render(<MessagesScreen />);
    expect(screen.getByText('Escribile a un voluntario inscripto desde el detalle de un voluntariado.')).toBeInTheDocument();
  });
});

describe('MessagesScreen: con conversaciones', () => {
  test('foto o iniciales, "Vos: " si el último es propio, y sin punto si está todo leído', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: 'https://x/ana.jpg' }, last_from_me: true, last_message: 'Nos vemos' }),
      conv({ user: { id: 'u2', name: 'Beto Ruiz', avatar: null } }),
    ];
    const { container } = render(<MessagesScreen />);
    expect(container.querySelector('img[src="https://x/ana.jpg"]')).toBeInTheDocument();
    expect(screen.getByText('BR')).toBeInTheDocument();   // iniciales de Beto, sin foto
    expect(screen.getByText(/Vos: Nos vemos/)).toBeInTheDocument();
    expect(screen.queryByText(/^Vos: Hola/)).not.toBeInTheDocument();
    expect(screen.getByText('Ana Paz').className).toContain('font-semibold');
    expect(screen.queryByRole('img', { name: /sin leer/ })).not.toBeInTheDocument();
  });

  test('no leídos: un punto que dice cuántos, y el nombre en negrita', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: null }, unread: 3 }),
      conv({ user: { id: 'u2', name: 'Beto Ruiz', avatar: null }, unread: 12 }),
    ];
    render(<MessagesScreen />);
    expect(screen.getByRole('img', { name: '3 sin leer' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '12 sin leer' })).toBeInTheDocument();
    expect(screen.getByText('Ana Paz').className).toContain('font-bold');
  });

  test('una ONG o empresa tiene avatar cuadrado; un voluntario, redondo', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: null, role: 'volunteer' } }),
      conv({ user: { id: 'n1', name: 'Fundación Verde', avatar: null, role: 'ngo' } }),
    ];
    render(<MessagesScreen />);
    expect(screen.getByText('AP')).toHaveStyle({ borderRadius: '9999px' });
    expect(screen.getByText('FV')).toHaveStyle({ borderRadius: '28%' });
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

  test.each([
    ['volunteer', '/messages/asistente'],
    ['ngo', '/ngo/messages/asistente'],
    ['company', '/company/messages/asistente'],
  ])('rol %s: el asistente fijado lleva a %s', (role, ruta) => {
    state.user = { role };
    render(<MessagesScreen />);
    expect(screen.getByRole('img', { name: 'Fijado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Asistente VoluntariAR/ }));
    expect(navigate).toHaveBeenCalledWith(ruta);
  });

  test('el buscador filtra por nombre sin importar tildes ni mayúsculas; sin resultados lo dice', () => {
    state.conversations = [
      conv({ user: { id: 'u1', name: 'Ana Paz', avatar: null } }),
      conv({ user: { id: 'u2', name: 'José Ruiz', avatar: null } }),
    ];
    render(<MessagesScreen />);
    const buscar = screen.getByRole('searchbox', { name: 'Buscar conversaciones' });
    fireEvent.change(buscar, { target: { value: 'JOSE' } });
    expect(screen.getByText('José Ruiz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Paz')).not.toBeInTheDocument();
    fireEvent.change(buscar, { target: { value: 'zzz' } });
    expect(screen.getByText('No encontramos esa conversación')).toBeInTheDocument();
    expect(screen.queryByText(/Escribile a/)).not.toBeInTheDocument();
    fireEvent.change(buscar, { target: { value: '   ' } });
    expect(screen.getByText('Ana Paz')).toBeInTheDocument();
  });
});
