// src/lib/googleSignIn.test.ts — el botón "Continuar con Google" (§314): carga del script de Google Identity Services
// una sola vez y botón dibujado por Google. No se habla con Google: el script se simula.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleClientId, loadGoogleScript, renderGoogleButton, GSI_SRC, resetGoogleScriptForTests } from './googleSignIn';

type IdApi = { initialize: ReturnType<typeof vi.fn>; renderButton: ReturnType<typeof vi.fn> };
const win = window as unknown as { google?: { accounts?: { id?: IdApi } } };

describe('googleSignIn', () => {
  beforeEach(() => {
    resetGoogleScriptForTests();
    document.head.querySelectorAll('script').forEach((s) => s.remove());
    delete win.google;
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  // El script "carga": se dispara su onload con la API de Google ya puesta.
  const finishLoad = (ok = true) => {
    const s = document.head.querySelector(`script[src="${GSI_SRC}"]`) as HTMLScriptElement;
    if (ok) {
      win.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
      s.dispatchEvent(new Event('load'));
    } else {
      s.dispatchEvent(new Event('error'));
    }
  };

  test('googleClientId(): el de VITE_GOOGLE_CLIENT_ID, sin espacios; vacío si no está', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ' 123.apps.googleusercontent.com ');
    expect(googleClientId()).toBe('123.apps.googleusercontent.com');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    expect(googleClientId()).toBe('');
  });

  test('carga el script de Google una sola vez, async, aunque lo pidan varios', async () => {
    const a = loadGoogleScript();
    const b = loadGoogleScript();
    const scripts = document.head.querySelectorAll(`script[src="${GSI_SRC}"]`);
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).async).toBe(true);
    finishLoad();
    await expect(a).resolves.toBeUndefined();
    await expect(b).resolves.toBeUndefined();
    await loadGoogleScript();
    expect(document.head.querySelectorAll(`script[src="${GSI_SRC}"]`)).toHaveLength(1);
  });

  test('si el script no carga, rechaza y se puede reintentar (saca el script fallido)', async () => {
    const a = loadGoogleScript();
    finishLoad(false);
    await expect(a).rejects.toThrow();
    expect(document.head.querySelectorAll(`script[src="${GSI_SRC}"]`)).toHaveLength(0);
    const b = loadGoogleScript();
    finishLoad();
    await expect(b).resolves.toBeUndefined();
  });

  test('renderGoogleButton: inicializa con el client id y dibuja el botón en el elemento; la credencial llega al callback', async () => {
    const el = document.createElement('div');
    const onCredential = vi.fn();
    const p = renderGoogleButton(el, onCredential, 'mi-client-id');
    finishLoad();
    expect(await p).toBe(true);
    const id = win.google!.accounts!.id!;
    expect(id.initialize).toHaveBeenCalledTimes(1);
    const cfg = id.initialize.mock.calls[0][0];
    expect(cfg.client_id).toBe('mi-client-id');
    expect(id.renderButton).toHaveBeenCalledWith(el, expect.objectContaining({ text: 'continue_with', locale: 'es' }));
    cfg.callback({ credential: 'jwt-de-google' });
    expect(onCredential).toHaveBeenCalledWith('jwt-de-google');
    cfg.callback({});
    expect(onCredential).toHaveBeenCalledTimes(1);
  });

  test('sin client id no carga nada y devuelve false', async () => {
    expect(await renderGoogleButton(document.createElement('div'), vi.fn(), '')).toBe(false);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  test('si el script cargó pero no trae la API de Google, devuelve false', async () => {
    const p = renderGoogleButton(document.createElement('div'), vi.fn(), 'id');
    const s = document.head.querySelector(`script[src="${GSI_SRC}"]`) as HTMLScriptElement;
    s.dispatchEvent(new Event('load'));
    expect(await p).toBe(false);
  });
});
