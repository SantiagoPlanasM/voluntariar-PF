// src/app/components/ProfilePhotoPicker.test.tsx
//
// "Cambiar foto" del perfil propio (PLAN_FALTANTE.md, Etapa 2; backend en PROJECT_ANALYSIS §162). Un solo
// componente para voluntario, ONG y empresa: elige un archivo, lo comprime como Momentos (imageCompress), lo
// sube con PUT /api/auth/me/photo y actualiza la sesión (AuthContext + localStorage) para que la foto nueva se
// vea en toda la app. La compresión se reemplaza por un doble (jsdom no tiene canvas).
import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';

vi.mock('../../lib/imageCompress', async () => {
  const actual = await vi.importActual<typeof import('../../lib/imageCompress')>('../../lib/imageCompress');
  return { ...actual, compressImage: vi.fn() };
});
import { compressImage } from '../../lib/imageCompress';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

const me = { id: 'u1', name: 'María', email: 'maria@example.com', role: 'volunteer', avatar: 'https://old/a.png' };
const NEW_URL = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_480,h_480,c_fill,g_auto/v1/a.jpg';

function Avatar() {
  const { user } = useAuth();
  return <p>avatar: {user?.avatar ?? 'ninguno'}</p>;
}

const mount = (onUploaded = vi.fn()) => {
  render(<AuthProvider><ProfilePhotoPicker onUploaded={onUploaded} /><Avatar /></AuthProvider>);
  return onUploaded;
};
const sessionReady = () => screen.findByText('avatar: https://old/a.png');
const choose = (file: File) => fireEvent.change(screen.getByLabelText('Elegir una foto de perfil'), { target: { files: [file] } });
const photo = () => new File(['x'], 'yo.jpg', { type: 'image/jpeg' });

describe('api.auth.uploadPhoto', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { localStorage.setItem('v_token', 'tok-123'); fetchMock = vi.fn(() => json({ user: me })); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  test('PUT multipart a /auth/me/photo, con el token y SIN Content-Type', async () => {
    const form = new FormData();
    form.append('photo', photo());
    const r = await api.auth.uploadPhoto(form);
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    const headers = new Headers((init as RequestInit).headers);
    expect(String(url)).toMatch(/\/auth\/me\/photo$/);
    expect((init as RequestInit).method).toBe('PUT');
    expect((init as RequestInit).body).toBe(form);
    expect(headers.get('Authorization')).toBe('Bearer tok-123');
    expect(headers.has('Content-Type')).toBe(false);
    expect(r.user.id).toBe('u1');
  });

  test('un error del servidor llega con su mensaje', async () => {
    fetchMock.mockImplementation(() => json({ error: 'El archivo no es una imagen válida (JPEG, PNG o WebP)' }, 400));
    await expect(api.auth.uploadPhoto(new FormData())).rejects.toThrow('El archivo no es una imagen válida (JPEG, PNG o WebP)');
  });

  test('Momentos sigue subiendo con POST', async () => {
    await api.posts.create(new FormData());
    expect((fetchMock.mock.calls.at(-1)![1] as RequestInit).method).toBe('POST');
  });
});

describe('<ProfilePhotoPicker />', () => {
  let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;
  beforeEach(() => {
    // Sesión real: con token guardado, AuthProvider la verifica con GET /auth/me al montar.
    localStorage.setItem('v_token', 'tok-123');
    localStorage.setItem('v_user', JSON.stringify(me));
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      String(url).endsWith('/auth/me') ? json({ user: me }) : fetchMock(url, init));
    vi.mocked(compressImage).mockReset().mockImplementation(async (f: File) => new File(['chica'], 'chica.jpg', { type: 'image/jpeg' }));
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  test('botón accesible y input que acepta solo JPEG, PNG y WebP', async () => {
    mount();
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir una foto de perfil')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  test('elegir una foto: la comprime, sube la comprimida en el campo "photo", actualiza la sesión y avisa', async () => {
    fetchMock.mockImplementation(() => json({ user: { ...me, avatar: NEW_URL } }));
    const onUploaded = mount();
    await sessionReady();
    const original = photo();
    choose(original);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(NEW_URL));
    expect(compressImage).toHaveBeenCalledWith(original);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/me\/photo$/);
    const sent = (init as RequestInit).body as FormData;
    expect((sent.get('photo') as File).name).toBe('chica.jpg');
    expect(screen.getByText(`avatar: ${NEW_URL}`)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('v_user')!).avatar).toBe(NEW_URL);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('mientras sube: el botón queda deshabilitado y dice "Subiendo foto…"', async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { finish = r; }));
    mount();
    await sessionReady();
    choose(photo());
    const busy = await screen.findByRole('button', { name: 'Subiendo foto…' });
    expect(busy).toBeDisabled();
    finish({ ok: true, status: 200, json: async () => ({ user: { ...me, avatar: NEW_URL } }) } as Response);
    expect(await screen.findByRole('button', { name: 'Cambiar foto' })).toBeEnabled();
  });

  test('si el servidor la rechaza: muestra su mensaje y la foto de la sesión no cambia', async () => {
    fetchMock.mockImplementation(() => json({ error: 'La foto puede pesar hasta 8 MB' }, 413));
    const onUploaded = mount();
    await sessionReady();
    choose(photo());
    expect(await screen.findByRole('alert')).toHaveTextContent('La foto puede pesar hasta 8 MB');
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByText('avatar: https://old/a.png')).toBeInTheDocument();
  });

  test('si no se puede preparar (tipo no permitido): muestra el motivo y no sube nada', async () => {
    vi.mocked(compressImage).mockRejectedValue(new Error('Solo se aceptan fotos JPEG, PNG o WebP'));
    mount();
    await sessionReady();
    choose(new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se aceptan fotos JPEG, PNG o WebP');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sin red: mensaje de conexión', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    mount();
    await sessionReady();
    choose(photo());
    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i);
  });

  test('un intento nuevo borra el error anterior', async () => {
    fetchMock.mockImplementationOnce(() => json({ error: 'No pudimos subir la foto. Probá de nuevo en un momento.' }, 502))
      .mockImplementationOnce(() => json({ user: { ...me, avatar: NEW_URL } }));
    const onUploaded = mount();
    await sessionReady();
    choose(photo());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    choose(photo());
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(NEW_URL));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('cancelar el selector (sin archivo) no hace nada', async () => {
    mount();
    await sessionReady();
    fireEvent.change(screen.getByLabelText('Elegir una foto de perfil'), { target: { files: [] } });
    expect(compressImage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
