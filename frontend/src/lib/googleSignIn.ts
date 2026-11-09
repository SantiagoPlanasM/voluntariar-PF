// src/lib/googleSignIn.ts — botón "Continuar con Google" (PROJECT_ANALYSIS.md §314).
//
// Usa Google Identity Services: el script de Google dibuja su propio botón y, al elegir la cuenta, devuelve un ID
// token (la "credencial") que el backend verifica (POST /api/auth/google). Sin VITE_GOOGLE_CLIENT_ID no se carga
// nada y no hay botón. El script se pide una sola vez, y solo cuando se abre el acceso.

export const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface GsiIdApi {
  initialize(cfg: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: string }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
const gsi = () => (window as unknown as { google?: { accounts?: { id?: GsiIdApi } } }).google?.accounts?.id;

/** El "ID de cliente" de OAuth (no es secreto). Vacío = sin login con Google. */
export const googleClientId = (): string => String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

let loading: Promise<void> | null = null;

/** Carga el script de Google una sola vez. Si falla, lo saca para poder reintentar la próxima vez. */
export function loadGoogleScript(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      loading = null;
      reject(new Error('No se pudo cargar el inicio de sesión con Google'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Solo para los tests: olvida que el script ya se pidió. */
export function resetGoogleScriptForTests() { loading = null; }

/**
 * Dibuja el botón de Google en `el`. `onCredential` recibe el ID token cuando la persona elige su cuenta.
 * Devuelve false si no hay client id o si Google no quedó disponible (el que llama no muestra nada).
 */
export async function renderGoogleButton(el: HTMLElement, onCredential: (credential: string) => void, clientId = googleClientId()): Promise<boolean> {
  if (!clientId) return false;
  await loadGoogleScript();
  const id = gsi();
  if (!id) return false;
  id.initialize({
    client_id: clientId,
    ux_mode: 'popup',
    callback: (r) => { if (r?.credential) onCredential(r.credential); },
  });
  id.renderButton(el, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'es', width: Math.min(el.clientWidth || 320, 400) });
  return true;
}
