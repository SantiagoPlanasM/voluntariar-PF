// src/lib/applications.ts — la lógica de la pantalla de postulaciones (§319): filtros, conteos, el orden del lote y el
// resumen. Sin React, para probarla sola.
import type { BulkSummary, NgoEnrollment } from './api';
import { normalizeText, parseBackendDate } from './format';

export type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';
export type InterviewFilter = 'any' | 'scheduled' | 'none';
export type SortKey = 'newest' | 'oldest' | 'name';
export interface ApplicationFilters {
  /** '' = todos los voluntariados. */
  project: string;
  status: StatusFilter;
  interview: InterviewFilter;
  cvOnly: boolean;
  q: string;
  sort: SortKey;
}
export const DEFAULT_FILTERS: ApplicationFilters = { project: '', status: 'pending', interview: 'any', cvOnly: false, q: '', sort: 'newest' };

/** El tope de POST /enrollments/bulk (BULK_MAX de routes/enrollments.js). */
export const BULK_MAX = 500;

const time = (e: NgoEnrollment) => parseBackendDate(e.created_at);

/** Las postulaciones que pasan los filtros, ordenadas. No cambia la lista original. */
export function filterApplications(list: NgoEnrollment[], f: ApplicationFilters): NgoEnrollment[] {
  const q = normalizeText(f.q.trim());
  const out = list.filter((e) =>
    (!f.project || e.project_id === f.project)
    && (f.status === 'all' || e.status === f.status)
    && (f.interview === 'any'
      || (f.interview === 'scheduled' ? e.interview?.status === 'scheduled' : !e.interview))
    && (!f.cvOnly || e.has_cv === true)
    && (!q || [e.volunteer_name, e.volunteer_email, e.project_title].some((s) => normalizeText(s ?? '').includes(q))));
  if (f.sort === 'name') return out.sort((a, b) => a.volunteer_name.localeCompare(b.volunteer_name, 'es', { sensitivity: 'base' }));
  return out.sort((a, b) => (f.sort === 'oldest' ? time(a) - time(b) : time(b) - time(a)));
}

/** Cuántas hay de cada estado dentro del voluntariado elegido (las pestañas). `all` cuenta también las canceladas. */
export function countByStatus(list: NgoEnrollment[], project: string): Record<StatusFilter, number> {
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  for (const e of list) {
    if (project && e.project_id !== project) continue;
    counts.all += 1;
    if (e.status === 'pending' || e.status === 'approved' || e.status === 'rejected') counts[e.status] += 1;
  }
  return counts;
}

/** Los ids elegidos, de la más vieja a la más nueva: el lote reparte los cupos por orden de llegada. */
export function bulkOrder(list: NgoEnrollment[], selected: Set<string>): string[] {
  return list.filter((e) => selected.has(e.id)).sort((a, b) => time(a) - time(b)).map((e) => e.id);
}

export function chunk<T>(items: T[], size = BULK_MAX): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function mergeSummaries(a: BulkSummary, b: BulkSummary): BulkSummary {
  return { applied: a.applied + b.applied, unchanged: a.unchanged + b.unchanged, full: a.full + b.full,
    stale: a.stale + b.stale, not_found: a.not_found + b.not_found };
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "12 aprobadas · 3 sin cupo (siguen pendientes)": solo lo que pasó. */
export function summaryText(s: BulkSummary, status: 'approved' | 'rejected'): string {
  const approved = status === 'approved';
  const parts = [
    s.applied && n(s.applied, approved ? 'aprobada' : 'rechazada', approved ? 'aprobadas' : 'rechazadas'),
    s.full && `${s.full} sin cupo (${s.full === 1 ? 'sigue pendiente' : 'siguen pendientes'})`,
    s.unchanged && `${s.unchanged} ${s.unchanged === 1 ? 'ya estaba' : 'ya estaban'} ${approved
      ? (s.unchanged === 1 ? 'aprobada' : 'aprobadas') : (s.unchanged === 1 ? 'rechazada' : 'rechazadas')}`,
    s.stale && n(s.stale, 'cambió mientras tanto', 'cambiaron mientras tanto'),
    s.not_found && n(s.not_found, 'no encontrada', 'no encontradas'),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No cambió nada.';
}
