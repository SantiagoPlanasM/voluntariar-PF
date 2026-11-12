// src/lib/sponsorshipDraft.ts — el borrador del acuerdo de patrocinio (§327).
//
// Decisión del usuario (11/11): agregar, editar o quitar puntos no crea una versión al instante; los cambios de una
// parte quedan acá hasta "Guardar cambios", que los manda juntos (POST …/cambios) como UNA versión. Funciones puras:
// cada una devuelve un borrador nuevo. Los puntos nuevos se identifican como `new:<clave>` hasta guardarse.
import type { SponsorshipChangeInput, SponsorshipPoint } from './api';

export type PointFields = { type: SponsorshipPoint['type']; detail: string; amount: number | null };
export interface Draft {
  adds: ({ key: string } & PointFields)[];
  edits: Record<string, PointFields>;
  removes: string[];
}

const NEW = 'new:';
export const isNew = (id: string) => id.startsWith(NEW);
export const newId = (key: string) => NEW + key;
export const emptyDraft = (): Draft => ({ adds: [], edits: {}, removes: [] });
export const draftCount = (d: Draft) => d.adds.length + Object.keys(d.edits).length + d.removes.length;

/** Los campos como se guardan: detalle sin espacios de más y monto solo en dinero. */
const clean = (f: PointFields): PointFields =>
  ({ type: f.type, detail: f.detail.trim(), amount: f.type === 'money' ? f.amount : null });
const same = (p: PointFields, q: PointFields) => p.type === q.type && p.detail === q.detail && p.amount === q.amount;

export function addPoint(d: Draft, key: string, fields: PointFields): Draft {
  return { ...d, adds: [...d.adds, { key, ...clean(fields) }] };
}

/** Edita un punto guardado (`original`) o uno nuevo (`new:<clave>`). Volver a como estaba deja de ser un cambio. */
export function editPoint(d: Draft, original: SponsorshipPoint | undefined, id: string, fields: PointFields): Draft {
  const f = clean(fields);
  if (isNew(id)) return { ...d, adds: d.adds.map(x => (newId(x.key) === id ? { key: x.key, ...f } : x)) };
  const edits = { ...d.edits };
  if (original && same(clean({ type: original.type, detail: original.detail, amount: original.amount }), f)) delete edits[id];
  else edits[id] = f;
  return { ...d, edits };
}

/** Quita un punto: uno nuevo sale del borrador; uno guardado pierde su edición y queda para quitar. */
export function removePoint(d: Draft, id: string): Draft {
  if (isNew(id)) return { ...d, adds: d.adds.filter(x => newId(x.key) !== id) };
  const edits = { ...d.edits };
  delete edits[id];
  return { ...d, edits, removes: d.removes.includes(id) ? d.removes : [...d.removes, id] };
}

export function undoRemove(d: Draft, id: string): Draft {
  return { ...d, removes: d.removes.filter(x => x !== id) };
}

// `clean` ya dejó el monto en null fuera de dinero: `undefined` no viaja en el JSON.
const body = (f: PointFields) => ({ type: f.type, detail: f.detail, amount: f.amount ?? undefined });

/** El lote para POST …/cambios: agregados, editados y quitados. */
export function toChanges(d: Draft): SponsorshipChangeInput[] {
  return [
    ...d.adds.map(({ key: _key, ...f }) => ({ action: 'add' as const, ...body(f) })),
    ...Object.entries(d.edits).map(([point_id, f]) => ({ action: 'edit' as const, point_id, ...body(f) })),
    ...d.removes.map(point_id => ({ action: 'remove' as const, point_id })),
  ];
}
