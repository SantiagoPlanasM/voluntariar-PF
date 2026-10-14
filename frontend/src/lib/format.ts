// src/lib/format.ts
// Utilidades de formato compartidas. Extraídas de los componentes que las
// usaban (empezando por timeAgo, que vivía inline en MessagesScreen.tsx)
// para poder testearlas sin tener que renderizar un componente completo.

/** Milisegundos de un timestamp del backend, o NaN si no es una fecha. Acepta los dos formatos que
 *  circulan: el viejo "YYYY-MM-DD HH:MM:SS" (sin zona, siempre UTC) y ISO 8601 completo, con o sin
 *  zona ("...T12:30:45.000Z", "...-03:00"). Un string sin zona se asume UTC; uno con zona se respeta.
 *  (Antes se le pegaba una "Z" a todo, así que un ISO con "Z" daba una fecha inválida.) */
export function parseBackendDate(value: string): number {
  const s = value.trim().replace(' ', 'T');
  // La zona solo se busca DESPUÉS de la hora: el "-10" de "2026-08-10" no es un offset.
  const hasZone = /T.*(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s);
  return new Date(hasZone || !s.includes('T') ? s : s + 'Z').getTime();
}

/** "hace cuánto" en español, a partir de un timestamp del backend (ver parseBackendDate). */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = parseBackendDate(iso);
  if (Number.isNaN(ms)) return '';
  const diffMs = Date.now() - ms;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/** Hora local en formato "HH:MM" a partir de un timestamp del backend (ver parseBackendDate), o "" si no es
 *  una fecha. (Antes le pegaba una "Z" a todo: con el ISO que llega de Postgres mostraba "Invalid Date".) */
export function formatTime(iso: string): string {
  const ms = parseBackendDate(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/** Fecha sin hora ("YYYY-MM-DD", p. ej. la de un KPI) como "01 oct 2026". Se arma como fecha LOCAL: con
 *  `new Date('2026-10-01')` es medianoche UTC, que en Córdoba (UTC-3) todavía es el 30 de septiembre, y se
 *  mostraba un día antes (REVISION F2). Un timestamp completo se toma por su instante (parseBackendDate);
 *  algo que no es fecha → "". */
export function formatDateOnly(value: string): string {
  const opts = { day: '2-digit', month: 'short', year: 'numeric' } as const;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-AR', opts);
  const ms = parseBackendDate(value);
  return Number.isNaN(ms) ? '' : new Date(ms).toLocaleDateString('es-AR', opts);
}

/** Recorta un texto largo para mostrarlo con "ver más". Corta por cantidad de caracteres (`max`) y también
 *  por cantidad de líneas (`maxLines`): un texto cortito pero con muchos saltos de línea ocupa mucho alto.
 *  Corta en el límite de una palabra (salvo que la primera palabra sea larguísima) y agrega "…". */
export function truncateText(text: string, max: number, maxLines = 4): { text: string; truncated: boolean } {
  const lines = text.split('\n');
  const tooManyLines = lines.length > maxLines;
  const byLines = tooManyLines ? lines.slice(0, maxLines).join('\n') : text;
  if (!tooManyLines && byLines.length <= max) return { text, truncated: false };

  let cut = byLines;
  if (cut.length > max) {
    cut = cut.slice(0, max);
    const next = byLines[max];
    if (next && !/\s/.test(next)) {
      // El corte cayó a la mitad de una palabra: retrocede hasta el último espacio, salvo que eso deje un
      // texto demasiado corto (una palabra larguísima al principio).
      const lastSpace = cut.search(/\s\S*$/);
      if (lastSpace > max * 0.4) cut = cut.slice(0, lastSpace);
    }
  }
  return { text: cut.replace(/\s+$/, '') + '…', truncated: true };
}

/** Mensaje de error para mostrarle al usuario. Los errores del servidor ya vienen en español y dicen algo
 *  útil ("Publicaste demasiado, esperá un rato"), así que se muestran tal cual. Un fallo de red de `fetch`
 *  es un TypeError en inglés ("Failed to fetch"): ese se reemplaza por `fallback`. */
export function userMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
