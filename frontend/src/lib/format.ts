// src/lib/format.ts
// Utilidades de formato compartidas. Extraídas de los componentes que las
// usaban (empezando por timeAgo, que vivía inline en MessagesScreen.tsx)
// para poder testearlas sin tener que renderizar un componente completo.

/** "hace cuánto" en español, a partir de un timestamp del backend
 *  (formato "YYYY-MM-DD HH:MM:SS", sin zona horaria — se asume UTC, que es
 *  lo que devuelve tanto SQLite como Postgres en este proyecto). */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/** Hora local en formato "HH:MM" a partir de un timestamp del backend. */
export function formatTime(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
