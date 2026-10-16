// src/lib/cv.ts
//
// CV del voluntario en el frontend (PLAN_FALTANTE.md, Etapa 5, §166). Los topes y mensajes son los del backend
// (backend/src/routes/voluntarios.js, PUT /api/voluntarios/me/cv): se chequean antes de subir para no gastar el pedido.
import { api } from './api';

export const CV_MAX_BYTES = 5 * 1024 * 1024;

/** null si el archivo se puede subir; si no, el mismo mensaje que daría el backend. */
export function checkCvFile(file: File): string | null {
  if (file.type !== 'application/pdf') return 'El CV tiene que ser un PDF';
  if (file.size > CV_MAX_BYTES) return 'El CV puede pesar hasta 5 MB';
  return null;
}

/**
 * Abre el CV de `userId` en una pestaña nueva. El link vence a los 10 minutos, así que se pide en el momento.
 * La pestaña se abre ANTES del pedido: abierta después de un `await`, el navegador la toma como ventana emergente
 * y la bloquea. Si no se pudo abrir, se va al link en la misma pestaña. Si el pedido falla, se cierra la pestaña
 * vacía y se relanza el error (la pantalla muestra el mensaje).
 */
export async function openCv(userId: string, assign: (url: string) => void = (url) => window.location.assign(url)): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const { url } = await api.voluntarios.cv.link(userId);
    if (tab) tab.location.href = url; else assign(url);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
