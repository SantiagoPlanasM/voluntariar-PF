// src/lib/AuthContext.test.tsx
//
// Al recargar con un token guardado, AuthProvider verifica la sesión con GET /auth/me. Antes borraba el
// token ante CUALQUIER error: con Render "dormido" (502), sin red o con un 500, el usuario perdía la
// sesión (REVISION.md F4). Ahora solo la cierra si la sesión de verdad no vale: 401 (token inválido o
// vencido) o 404 (el usuario ya no existe). En cualquier otro caso conserva el token y el usuario
// guardado en localStorage.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const cached = { id: 'u1', name: 'María Guardada', email: 'maria@example.com', role: 'volunteer' };
const fresh = { id: 'u1', name: 'María del Servidor', email: 'maria@example.com', role: 'volunteer' };

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
const html = (status: number) =>
  Promise.resolve({
    ok: status < 400, status, json: async () => { throw new SyntaxError('Unexpected token <'); },
  } as unknown as Response);

function Probe() {
  const { user, token, initializing } = useAuth();
  if (initializing) return <p>verificando</p>;
  return <p>{user ? user.name : 'sin usuario'} | {token ? 'con token' : 'sin token'}</p>;
}

const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

describe('AuthProvider: verificación de la sesión al recargar', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.setItem('v_token', 'tok-123');
    localStorage.setItem('v_user', JSON.stringify(cached));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  const settled = () => waitFor(() => expect(screen.queryByText('verificando')).not.toBeInTheDocument());

  test('/auth/me OK → usa el usuario del servidor', async () => {
    fetchMock.mockImplementation(() => json({ user: fresh }));
    mount();
    await settled();
    expect(screen.getByText('María del Servidor | con token')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('v_user')!).name).toBe('María del Servidor');
  });

  test('401 (token vencido) → cierra la sesión', async () => {
    fetchMock.mockImplementation(() => json({ error: 'Token inválido o expirado' }, 401));
    mount();
    await settled();
    expect(screen.getByText('sin usuario | sin token')).toBeInTheDocument();
    expect(localStorage.getItem('v_token')).toBeNull();
    expect(localStorage.getItem('v_user')).toBeNull();
  });

  test('404 (el usuario ya no existe) → cierra la sesión', async () => {
    fetchMock.mockImplementation(() => json({ error: 'Usuario no encontrado' }, 404));
    mount();
    await settled();
    expect(screen.getByText('sin usuario | sin token')).toBeInTheDocument();
    expect(localStorage.getItem('v_token')).toBeNull();
  });

  test.each([
    ['502 en HTML (Render dormido)', () => html(502)],
    ['500 con JSON', () => json({ error: 'Error interno del servidor' }, 500)],
    ['sin red (TypeError de fetch)', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s → NO cierra la sesión: conserva el token y el usuario guardado', async (_, impl) => {
    fetchMock.mockImplementation(impl);
    mount();
    await settled();
    expect(screen.getByText('María Guardada | con token')).toBeInTheDocument();
    expect(localStorage.getItem('v_token')).toBe('tok-123');
    expect(localStorage.getItem('v_user')).not.toBeNull();
  });

  test('sin token guardado no llama a /auth/me', async () => {
    localStorage.clear();
    mount();
    await settled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('sin usuario | sin token')).toBeInTheDocument();
  });
});
