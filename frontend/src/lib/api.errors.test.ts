// src/lib/api.errors.test.ts
//
// Errores del cliente HTTP (REVISION.md F4 + F5):
//   - F5: `req()` hacía `await res.json()` sin protección. Un 502/503 en HTML de un proxy (Render
//     "dormido", un balanceador) mostraba al usuario `Unexpected token '<' ...`.
//   - F4: el error no decía el código HTTP, así que AuthContext no podía distinguir "token inválido"
//     (401) de "el servidor no responde" y cerraba la sesión ante cualquier error. Ahora `req()` y
//     `upload()` lanzan `ApiError` con `status`.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './api';

// Respuesta cuyo cuerpo NO es JSON (p. ej. la página HTML de error de un proxy).
const htmlResponse = (status: number) =>
  Promise.resolve({
    ok: status < 400, status,
    json: async () => { throw new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON"); },
  } as unknown as Response);
const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

describe('req() / upload(): errores con status y sin mensajes técnicos', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  const caught = async (p: Promise<unknown>) => {
    try { await p; } catch (e) { return e; }
    throw new Error('se esperaba que fallara');
  };

  test('502 en HTML → ApiError 502 con mensaje en español (no "Unexpected token")', async () => {
    fetchMock.mockImplementation(() => htmlResponse(502));
    const e = await caught(api.auth.me());
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(502);
    expect((e as ApiError).message).toBe('El servidor no está disponible en este momento. Probá de nuevo en un rato.');
  });

  test('503 y 504 sin JSON también dicen que el servidor no está disponible', async () => {
    for (const status of [503, 504]) {
      fetchMock.mockImplementation(() => htmlResponse(status));
      const e = (await caught(api.projects.list())) as ApiError;
      expect(e.status).toBe(status);
      expect(e.message).toMatch(/no está disponible/);
    }
  });

  test('otro error sin JSON (500 en HTML) → "Error del servidor"', async () => {
    fetchMock.mockImplementation(() => htmlResponse(500));
    const e = (await caught(api.projects.list())) as ApiError;
    expect(e.status).toBe(500);
    expect(e.message).toBe('Error del servidor');
  });

  test('error con JSON → el mensaje del backend (ya viene en español) y su status', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ error: 'Token inválido o expirado' }, 401));
    const e = (await caught(api.auth.me())) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(401);
    expect(e.message).toBe('Token inválido o expirado');
  });

  test('200 con un cuerpo que no es JSON → ApiError, no un SyntaxError', async () => {
    fetchMock.mockImplementation(() => htmlResponse(200));
    const e = (await caught(api.projects.list())) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(200);
    expect(e.message).toBe('Respuesta inesperada del servidor');
  });

  test('una respuesta OK con JSON se devuelve tal cual', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ projects: [{ id: 'p1' }] }));
    await expect(api.projects.list()).resolves.toEqual({ projects: [{ id: 'p1' }] });
  });

  test('upload(): 502 en HTML → ApiError 502 con el mismo mensaje', async () => {
    fetchMock.mockImplementation(() => htmlResponse(502));
    const e = (await caught(api.posts.create(new FormData()))) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
    expect(e.message).toMatch(/no está disponible/);
  });

  test('un fallo de red sigue siendo el TypeError de fetch (userMessage lo reemplaza por su texto)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const e = await caught(api.auth.me());
    expect(e).toBeInstanceOf(TypeError);
    expect(e).not.toBeInstanceOf(ApiError);
  });
});
