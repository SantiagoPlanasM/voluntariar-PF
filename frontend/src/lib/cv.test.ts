// src/lib/cv.test.ts
//
// Cliente del CV (PLAN_FALTANTE.md, Etapa 5; backend en PROJECT_ANALYSIS §165): los métodos de api.ts, la
// validación previa del archivo (los mismos topes y mensajes que el backend) y `openCv`, que abre el link que vence.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import { CV_MAX_BYTES, checkCvFile, openCv } from './cv';

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

describe('api.voluntarios.cv', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { localStorage.setItem('v_token', 'tok'); fetchMock = vi.fn(() => json({ has_cv: true })); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  const last = () => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url: String(url), init: init as RequestInit, headers: new Headers((init as RequestInit).headers) };
  };

  test('upload: PUT multipart a /voluntarios/me/cv, sin Content-Type', async () => {
    const form = new FormData();
    expect(await api.voluntarios.cv.upload(form)).toEqual({ has_cv: true });
    const { url, init, headers } = last();
    expect(url).toMatch(/\/voluntarios\/me\/cv$/);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(form);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer tok');
  });

  test('remove: DELETE a /voluntarios/me/cv', async () => {
    fetchMock.mockImplementation(() => json({ has_cv: false }));
    expect(await api.voluntarios.cv.remove()).toEqual({ has_cv: false });
    expect(last().url).toMatch(/\/voluntarios\/me\/cv$/);
    expect(last().init.method).toBe('DELETE');
  });

  test('link: GET a /voluntarios/:userId/cv (con el id codificado)', async () => {
    fetchMock.mockImplementation(() => json({ url: 'https://x/cv', expires_at: '2026-10-16T12:10:00.000Z' }));
    expect(await api.voluntarios.cv.link('user 3')).toEqual({ url: 'https://x/cv', expires_at: '2026-10-16T12:10:00.000Z' });
    expect(last().url).toMatch(/\/voluntarios\/user%203\/cv$/);
  });
});

describe('checkCvFile(): lo mismo que rechaza el backend, antes de subir', () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'cv', { type });
  test('PDF de hasta 5 MB → null', () => {
    expect(checkCvFile(file('application/pdf', 10))).toBeNull();
    expect(checkCvFile(file('application/pdf', CV_MAX_BYTES))).toBeNull();
  });
  test('otro tipo → "El CV tiene que ser un PDF"', () => {
    expect(checkCvFile(file('image/jpeg', 10))).toBe('El CV tiene que ser un PDF');
    expect(checkCvFile(file('', 10))).toBe('El CV tiene que ser un PDF');
  });
  test('más de 5 MB → "El CV puede pesar hasta 5 MB"', () => {
    expect(CV_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(checkCvFile(file('application/pdf', CV_MAX_BYTES + 1))).toBe('El CV puede pesar hasta 5 MB');
  });
});

describe('openCv(): abre el link firmado en una pestaña nueva', () => {
  let tab: { location: { href: string }; close: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  });
  afterEach(() => vi.restoreAllMocks());

  test('abre la pestaña ANTES de pedir el link (si no, el navegador la bloquea) y después la lleva al link', async () => {
    let resolve!: (v: { url: string; expires_at: string }) => void;
    vi.spyOn(api.voluntarios.cv, 'link').mockReturnValue(new Promise((r) => { resolve = r; }));
    const p = openCv('u-3');
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(tab.location.href).toBe('');
    resolve({ url: 'https://api.cloudinary.com/v1_1/demo/raw/download?x=1', expires_at: '' });
    await p;
    expect(api.voluntarios.cv.link).toHaveBeenCalledWith('u-3');
    expect(tab.location.href).toBe('https://api.cloudinary.com/v1_1/demo/raw/download?x=1');
  });

  test('si el pedido falla: cierra la pestaña vacía y relanza el error (con su mensaje)', async () => {
    vi.spyOn(api.voluntarios.cv, 'link').mockRejectedValue(new Error('CV no disponible'));
    await expect(openCv('u-3')).rejects.toThrow('CV no disponible');
    expect(tab.close).toHaveBeenCalled();
  });

  test('si el navegador no dejó abrir la pestaña: va al link en la misma', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const assign = vi.fn();
    vi.spyOn(api.voluntarios.cv, 'link').mockResolvedValue({ url: 'https://x/cv', expires_at: '' });
    await openCv('u-3', assign);
    expect(assign).toHaveBeenCalledWith('https://x/cv');
  });
});
