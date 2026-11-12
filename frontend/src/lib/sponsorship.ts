// src/lib/sponsorship.ts
//
// Etiquetas y colores de los 3 estados de un patrocinio (Patrocinio['estado']).
//
// Única fuente: la usan CompanyDashboard.tsx, CompanyOwnProfile.tsx y
// NGOPatrocinios.tsx (las dos últimas tenían copias idénticas hasta REVISION S7).
// Cualquier pantalla nueva importa de acá en vez de copiar los mapas.
import type { Patrocinio, SponsorshipPoint, SponsorshipPointSnapshot, SponsorshipVersion } from './api';
import type { PointFields } from './sponsorshipDraft';

/** Los tipos de un punto del acuerdo, como se leen (acuerdo, historial y propuesta). */
export const POINT_TYPE_LABEL: Record<SponsorshipPoint['type'], string> = {
  money: 'Dinero', supplies: 'Insumos', volunteers: 'Voluntarios de la empresa', outreach: 'Difusión', other: 'Otro',
};
export const formatMoney = (n: number) => `$ ${n.toLocaleString('es-AR')}`;

/** El formulario de un punto (SponsorshipPointForm): `id` null es uno nuevo; si no, el id del punto que se edita. */
export type PointFormValue = { id: string | null; type: SponsorshipPoint['type']; detail: string; amount: string };
export const newPointForm = (): PointFormValue => ({ id: null, type: 'supplies', detail: '', amount: '' });
export const editPointForm = (pt: { id: string } & PointFields): PointFormValue =>
  ({ id: pt.id, type: pt.type, detail: pt.detail, amount: pt.amount == null ? '' : String(pt.amount) });
/** Lo que va al borrador: el monto solo en dinero (lo valida el backend al guardar). */
export const formFields = (f: PointFormValue): PointFields =>
  ({ type: f.type, detail: f.detail, amount: f.type === 'money' ? Number(f.amount) : null });

export type SponsorshipState = Patrocinio['estado'];

export const SPONSORSHIP_BADGE: Record<SponsorshipState, string> = {
  propuesto: 'bg-amber-50 text-amber-700',
  aceptado:  'bg-emerald-50 text-emerald-700',
  rechazado: 'bg-red-50 text-red-600',
};

export const SPONSORSHIP_LABEL: Record<SponsorshipState, string> = {
  propuesto: 'Pendiente',
  aceptado:  'Aceptado',
  rechazado: 'Rechazado',
};

/** Qué le pasó a un punto que sigue en el acuerdo desde la versión aceptada: nuevo, o editado (con cómo estaba). */
export type PointChangeSince = { kind: 'add' } | { kind: 'edit'; before: SponsorshipPointSnapshot | null };

/**
 * Qué cambió en el acuerdo después de la versión `accepted` (§325), con el historial de GET …/historial (de la más
 * nueva a la más vieja). `points`: los puntos que siguen y cambiaron; `removed`: los que se quitaron, como estaban
 * cuando se aceptó. Un punto agregado y quitado después no cuenta (nunca se vio); uno agregado y editado sigue nuevo.
 */
export function changesSince(versions: SponsorshipVersion[], accepted: number) {
  const points = new Map<string, PointChangeSince>();
  const removed: SponsorshipPointSnapshot[] = [];
  const later = versions.filter(v => v.version > accepted).sort((a, b) => a.version - b.version);
  for (const { changes } of later) {
    for (const c of changes) {
      const seen = points.get(c.point_id);
      if (c.action === 'add') points.set(c.point_id, { kind: 'add' });
      else if (c.action === 'edit') { if (!seen) points.set(c.point_id, { kind: 'edit', before: c.before }); }
      else {
        points.delete(c.point_id);
        if (seen?.kind === 'add') continue;
        const was = seen?.kind === 'edit' ? seen.before : c.before;
        if (was) removed.push(was);
      }
    }
  }
  return { points, removed, count: points.size + removed.length };
}
