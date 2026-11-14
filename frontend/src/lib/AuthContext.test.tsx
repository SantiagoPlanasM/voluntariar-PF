// src/lib/AuthContext.test.tsx
//
// Al recargar con un token guardado, AuthProvider verifica la sesión con GET /auth/me. Antes borraba el
// token ante CUALQUIER error: con Render "dormido" (502), sin red o con un 500, el usuario perdía la
// sesión (REVISION.md F4). Ahora solo la cierra si la sesión de verdad no vale: 401 (token inválido o
// vencido) o 404 (el usuario ya no existe). En cualquier otro caso conserva el token y el usuario
// guardado en localStorage.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// §317: `isAdmin` sale de `is_admin` de /auth/me (al recargar y después de entrar). Solo decide si se muestra el
// panel de administración; la API lo vuelve a controlar (regla 15).
function AdminProbe() {
  const { user, isAdmin, initializing, login, logout } = useAuth();
  if (initializing) return <p>verificando</p>;
  return (
    <>
      <p>{user ? user.name : 'sin usuario'} | {isAdmin ? 'admin' : 'no admin'}</p>
      <button onClick={() => { void login('maria@example.com', 'x').catch(() => {}); }}>entrar</button>
      <button onClick={logout}>salir</button>
    </>
  );
}

describe('AuthProvider: isAdmin (§317)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  const path = (u: unknown) => String(u).replace(/^.*\/api/, '');

  test('al recargar: is_admin de /auth/me; al cerrar la sesión vuelve a false', async () => {
    localStorage.setItem('v_token', 'tok-123');
    localStorage.setItem('v_user', JSON.stringify(cached));
    fetchMock.mockImplementation(() => json({ user: fresh, is_admin: true }));
    render(<AuthProvider><AdminProbe /></AuthProvider>);
    expect(await screen.findByText('María del Servidor | admin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(screen.getByText('sin usuario | no admin')).toBeInTheDocument();
  });

  test('sin is_admin, o si /auth/me falla: no es admin', async () => {
    localStorage.setItem('v_token', 'tok-123');
    localStorage.setItem('v_user', JSON.stringify(cached));
    fetchMock.mockImplementation(() => json({ user: fresh }));
    const r = render(<AuthProvider><AdminProbe /></AuthProvider>);
    expect(await screen.findByText('María del Servidor | no admin')).toBeInTheDocument();
    r.unmount();
    localStorage.setItem('v_user', JSON.stringify(cached));   // el montaje anterior guardó el del servidor
    fetchMock.mockImplementation(() => json({ error: 'x' }, 500));
    render(<AuthProvider><AdminProbe /></AuthProvider>);
    expect(await screen.findByText('María Guardada | no admin')).toBeInTheDocument();
  });

  test('al entrar: pregunta a /auth/me si es admin (el login no lo trae)', async () => {
    fetchMock.mockImplementation((url: string) => path(url) === '/auth/login'
      ? json({ token: 'tok-9', user: fresh })
      : json({ user: fresh, is_admin: true }));
    render(<AuthProvider><AdminProbe /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'entrar' }));
    expect(await screen.findByText('María del Servidor | admin')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([u]) => path(u))).toEqual(['/auth/login', '/auth/me']);
  });

  test('si se cierra la sesión antes de que responda /auth/me, no queda como admin', async () => {
    let answer!: (r: Response) => void;
    fetchMock.mockImplementation((url: string) => path(url) === '/auth/login'
      ? json({ token: 'tok-9', user: fresh })
      : new Promise<Response>((r) => { answer = r; }));
    render(<AuthProvider><AdminProbe /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'entrar' }));
    await screen.findByText('María del Servidor | no admin');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'salir' }));
    answer({ ok: true, status: 200, json: async () => ({ user: fresh, is_admin: true }) } as Response);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('sin usuario | no admin')).toBeInTheDocument();
  });
});

// T6 (§335): `account` es la identidad de la organización (nombre y logo de `profile` en /auth/me) para dibujar el
// avatar de la cuenta en las barras. `user` es la persona que se registró: en una ONG o una empresa, sus iniciales
// no son las de la organización (hallazgo C9 del 12/11). Un voluntario no tiene `account`.
function AccountProbe() {
  const { user, account, initializing, login, logout, updateUser } = useAuth();
  if (initializing) return <p>verificando</p>;
  return (
    <>
      <p>{user ? user.name : 'sin usuario'} | {account ? `${account.name} · ${account.avatar ?? 'sin logo'}` : 'sin organización'}</p>
      <button onClick={() => { void login('ana@example.com', 'x').catch(() => {}); }}>entrar</button>
      <button onClick={logout}>salir</button>
      <button onClick={() => updateUser({ ...user!, avatar: 'https://img.test/nueva.png' })}>foto</button>
    </>
  );
}

describe('AuthProvider: account, la organización de la cuenta (§335)', () => {
  const ana = { id: 'u2', name: 'Ana Suárez', email: 'ana@example.com', role: 'ngo' };
  const ngoProfile = { id: 'n1', user_id: 'u2', nombre: 'Sustentando', foto_perfil: 'https://img.test/logo.png' };
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  const path = (u: unknown) => String(u).replace(/^.*\/api/, '');
  const reload = (me: unknown, status = 200) => {
    localStorage.setItem('v_token', 'tok-123');
    localStorage.setItem('v_user', JSON.stringify(ana));
    fetchMock.mockImplementation(() => json(me, status));
    return render(<AuthProvider><AccountProbe /></AuthProvider>);
  };

  test('ONG al recargar: nombre y logo de la organización; al cerrar la sesión se borra', async () => {
    reload({ user: ana, profile: ngoProfile });
    expect(await screen.findByText('Ana Suárez | Sustentando · https://img.test/logo.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(screen.getByText('sin usuario | sin organización')).toBeInTheDocument();
  });

  test('empresa sin logo: el nombre de la empresa, sin logo', async () => {
    reload({ user: { ...ana, role: 'company' }, profile: { id: 'e1', nombre: 'TechCorp', foto_perfil: null } });
    expect(await screen.findByText('Ana Suárez | TechCorp · sin logo')).toBeInTheDocument();
  });

  test('un voluntario no tiene organización, aunque su perfil traiga nombre y foto', async () => {
    reload({ user: { ...ana, role: 'volunteer' }, profile: { id: 'v1', nombre: 'Ana', foto_perfil: 'https://img.test/vieja.png', has_cv: false } });
    expect(await screen.findByText('Ana Suárez | sin organización')).toBeInTheDocument();
  });

  test.each([
    ['sin fila de perfil (profile: null)', { user: ana, profile: null }, 200],
    ['perfil sin nombre', { user: ana, profile: { id: 'n1', nombre: '', foto_perfil: 'https://img.test/logo.png' } }, 200],
    ['/auth/me falla (500)', { error: 'x' }, 500],
  ])('%s → sin organización (las barras usan al usuario)', async (_, me, status) => {
    reload(me, status);
    expect(await screen.findByText('Ana Suárez | sin organización')).toBeInTheDocument();
  });

  test('al entrar: la organización llega con /auth/me (el login no la trae)', async () => {
    fetchMock.mockImplementation((url: string) => path(url) === '/auth/login'
      ? json({ token: 'tok-9', user: ana })
      : json({ user: ana, profile: ngoProfile }));
    render(<AuthProvider><AccountProbe /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'entrar' }));
    expect(await screen.findByText('Ana Suárez | Sustentando · https://img.test/logo.png')).toBeInTheDocument();
  });

  test('si se cierra la sesión antes de que responda /auth/me, no queda la organización', async () => {
    let answer!: (r: Response) => void;
    fetchMock.mockImplementation((url: string) => path(url) === '/auth/login'
      ? json({ token: 'tok-9', user: ana })
      : new Promise<Response>((r) => { answer = r; }));
    render(<AuthProvider><AccountProbe /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'entrar' }));
    await screen.findByText('Ana Suárez | sin organización');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'salir' }));
    answer({ ok: true, status: 200, json: async () => ({ user: ana, profile: ngoProfile }) } as Response);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('sin usuario | sin organización')).toBeInTheDocument();
  });

  test('entrar con otra cuenta sin cerrar la anterior: no se arrastra la organización vieja', async () => {
    reload({ user: ana, profile: ngoProfile });
    await screen.findByText('Ana Suárez | Sustentando · https://img.test/logo.png');
    fetchMock.mockImplementation((url: string) => path(url) === '/auth/login'
      ? json({ token: 'tok-9', user: { ...ana, id: 'u3', name: 'Beto Díaz', role: 'company' } })
      : new Promise<Response>(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'entrar' }));
    expect(await screen.findByText('Beto Díaz | sin organización')).toBeInTheDocument();
  });

  test('cambiar la foto (updateUser) cambia también el logo: el backend guarda la misma en los dos lados', async () => {
    reload({ user: ana, profile: ngoProfile });
    await screen.findByText('Ana Suárez | Sustentando · https://img.test/logo.png');
    fireEvent.click(screen.getByRole('button', { name: 'foto' }));
    expect(screen.getByText('Ana Suárez | Sustentando · https://img.test/nueva.png')).toBeInTheDocument();
  });

  test('cambiar la foto de un voluntario no le inventa una organización', async () => {
    reload({ user: { ...ana, role: 'volunteer' }, profile: null });
    await screen.findByText('Ana Suárez | sin organización');
    fireEvent.click(screen.getByRole('button', { name: 'foto' }));
    expect(screen.getByText('Ana Suárez | sin organización')).toBeInTheDocument();
  });
});
