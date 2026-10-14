// src/lib/api.posts.test.ts
//
// Cliente de la API de Momentos. Lo que más importa: la subida de fotos va como multipart y NO debe
// fijar Content-Type (el navegador lo pone él, con el "boundary"; si se fuerza application/json el
// servidor nunca recibe los archivos). `req()` fija JSON siempre, por eso la subida usa un helper aparte.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

const okJson = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

describe('api.posts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.setItem('v_token', 'tok-123');
    fetchMock = vi.fn(() => okJson({}));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url: String(url), init: (init ?? {}) as RequestInit, headers: new Headers((init as RequestInit | undefined)?.headers) };
  };

  describe('create() — subida multipart', () => {
    test('manda el FormData tal cual, con el token, y SIN Content-Type', async () => {
      fetchMock.mockImplementation(() => okJson({ post: { id: 'p1' } }, 201));
      const form = new FormData();
      form.append('project_id', 'proj-1');
      form.append('photos', new Blob(['x'], { type: 'image/jpeg' }), 'a.jpg');

      const r = await api.posts.create(form);

      const { url, init, headers } = lastCall();
      expect(url).toMatch(/\/posts$/);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(form);
      expect(headers.get('Authorization')).toBe('Bearer tok-123');
      expect(headers.has('Content-Type')).toBe(false);
      expect(r.post.id).toBe('p1');
    });

    test('sin sesión no manda Authorization (el servidor responderá 401)', async () => {
      localStorage.clear();
      fetchMock.mockImplementation(() => okJson({ error: 'No autenticado' }, 401));
      await expect(api.posts.create(new FormData())).rejects.toThrow('No autenticado');
      expect(lastCall().headers.has('Authorization')).toBe(false);
    });

    test('un error del servidor se convierte en un Error con su mensaje', async () => {
      fetchMock.mockImplementation(() => okJson({ error: 'Cada foto puede pesar hasta 8 MB' }, 413));
      await expect(api.posts.create(new FormData())).rejects.toThrow('Cada foto puede pesar hasta 8 MB');
    });

    test('una respuesta de error que no es JSON (p. ej. la página de un proxy) no revienta con SyntaxError', async () => {
      fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response));
      // Desde F5 un 502/503/504 sin JSON dice que el servidor no está disponible (antes "Error del servidor").
      await expect(api.posts.create(new FormData())).rejects.toThrow('El servidor no está disponible');
    });
  });

  describe('list()', () => {
    test('arma la query solo con lo que se pasa', async () => {
      await api.posts.list();
      expect(lastCall().url).toMatch(/\/posts$/);

      await api.posts.list({ project_id: 'proj-1', limit: 12, offset: 24 });
      const u = new URL(lastCall().url);
      expect(u.pathname).toMatch(/\/posts$/);
      expect(Object.fromEntries(u.searchParams)).toEqual({ project_id: 'proj-1', limit: '12', offset: '24' });
    });

    test('un offset de 0 SÍ se manda (0 es un valor válido, no "ausente")', async () => {
      await api.posts.list({ offset: 0, limit: 5 });
      expect(new URL(lastCall().url).searchParams.get('offset')).toBe('0');
    });

    test('codifica los valores en la URL', async () => {
      await api.posts.list({ user_id: 'a b&c=d' });
      expect(new URL(lastCall().url).searchParams.get('user_id')).toBe('a b&c=d');
    });
  });

  describe('el resto de los métodos', () => {
    test('get / eligibleProjects', async () => {
      await api.posts.get('p1');
      expect(lastCall().url).toMatch(/\/posts\/p1$/);
      await api.posts.eligibleProjects();
      expect(lastCall().url).toMatch(/\/posts\/eligible-projects$/);
    });

    test('like (POST), unlike (DELETE) y remove (DELETE) usan el método correcto', async () => {
      await api.posts.like('p1');
      expect(lastCall().init.method).toBe('POST');
      expect(lastCall().url).toMatch(/\/posts\/p1\/like$/);

      await api.posts.unlike('p1');
      expect(lastCall().init.method).toBe('DELETE');
      expect(lastCall().url).toMatch(/\/posts\/p1\/like$/);

      await api.posts.remove('p1');
      expect(lastCall().init.method).toBe('DELETE');
      expect(lastCall().url).toMatch(/\/posts\/p1$/);
    });
  });
});
