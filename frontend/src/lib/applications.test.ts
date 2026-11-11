// src/lib/applications.test.ts — la lógica de la pantalla de postulaciones (§319), sin pantalla.
// Criterio de aceptación (antes de escribir el código):
//  - filtros que se combinan: voluntariado, estado (pendientes por defecto; "todas" incluye las canceladas), entrevista
//    (programada / sin ninguna), solo con CV, y búsqueda por nombre, mail o voluntariado sin importar mayúsculas ni tildes;
//  - orden: más nuevas, más viejas o por nombre (con el español: "Ángela" va con la A);
//  - los conteos por estado respetan el voluntariado elegido (no los otros filtros: son las pestañas);
//  - el lote se manda de la más vieja a la más nueva (orden de llegada, para repartir los cupos), en tandas de 500
//    (el tope del backend), y los resúmenes de las tandas se suman;
//  - el resumen en castellano, con singular y plural y solo lo que pasó.
import { describe, test, expect } from 'vitest';
import type { NgoEnrollment } from './api';
import {
  DEFAULT_FILTERS, filterApplications, countByStatus, bulkOrder, chunk, mergeSummaries, summaryText, BULK_MAX,
} from './applications';

const e = (over: Partial<NgoEnrollment>): NgoEnrollment => ({
  id: 'e', user_id: 'u', project_id: 'p1', project_title: 'Huerta', status: 'pending', created_at: '2026-11-01 10:00:00',
  volunteer_name: 'Ana Paz', volunteer_email: 'ana@x.com', interview: null, has_cv: false, phone: null, ...over,
} as NgoEnrollment);

const LIST = [
  e({ id: 'a', volunteer_name: 'Ángela Ruiz', created_at: '2026-11-03 10:00:00', has_cv: true }),
  e({ id: 'b', volunteer_name: 'Bruno Díaz', created_at: '2026-11-01 10:00:00', project_id: 'p2', project_title: 'Comedor' }),
  e({ id: 'c', volunteer_name: 'carla Gómez', created_at: '2026-11-02 10:00:00', status: 'approved',
    interview: { id: 'i', enrollment_id: 'c', date: '2030-01-01', time: '10:00', link: null, place: null, note: null, status: 'scheduled' } }),
  e({ id: 'd', volunteer_name: 'Dario', created_at: '2026-11-04 10:00:00', status: 'rejected', volunteer_email: 'dario@ong.org' }),
  e({ id: 'x', volunteer_name: 'Xime', created_at: '2026-11-05 10:00:00', status: 'cancelled' }),
];
const ids = (l: NgoEnrollment[]) => l.map((x) => x.id);

describe('filterApplications', () => {
  test('por defecto: pendientes, de la más nueva a la más vieja', () => {
    expect(DEFAULT_FILTERS).toEqual({ project: '', status: 'pending', interview: 'any', cvOnly: false, q: '', sort: 'newest' });
    expect(ids(filterApplications(LIST, DEFAULT_FILTERS))).toEqual(['a', 'b']);
  });
  test('estado: aprobadas, rechazadas; "todas" incluye las canceladas', () => {
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'approved' }))).toEqual(['c']);
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'rejected' }))).toEqual(['d']);
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all' }))).toEqual(['x', 'd', 'a', 'c', 'b']);
  });
  test('voluntariado', () => {
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', project: 'p2' }))).toEqual(['b']);
  });
  test('entrevista programada o sin ninguna', () => {
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', interview: 'scheduled' }))).toEqual(['c']);
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', interview: 'none' }))).toEqual(['x', 'd', 'a', 'b']);
  });
  test('una entrevista cancelada o realizada no cuenta como programada, pero tampoco como "sin ninguna"', () => {
    const done = e({ id: 'z', interview: { id: 'i', enrollment_id: 'z', date: '2030-01-01', time: '10:00', link: null, place: null, note: null, status: 'done' } });
    expect(filterApplications([done], { ...DEFAULT_FILTERS, interview: 'scheduled' })).toEqual([]);
    expect(filterApplications([done], { ...DEFAULT_FILTERS, interview: 'none' })).toEqual([]);
    expect(filterApplications([done], DEFAULT_FILTERS)).toEqual([done]);
  });
  test('solo con CV', () => {
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', cvOnly: true }))).toEqual(['a']);
  });
  test('búsqueda por nombre, mail o voluntariado, sin mayúsculas ni tildes y sin espacios de los bordes', () => {
    const q = (s: string) => ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', q: s }));
    expect(q('  angela ')).toEqual(['a']);
    expect(q('CARLA')).toEqual(['c']);
    expect(q('@ong.org')).toEqual(['d']);
    expect(q('comedor')).toEqual(['b']);
    expect(q('nadie')).toEqual([]);
  });
  test('orden: más viejas primero, o por nombre en castellano', () => {
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', sort: 'oldest' }))).toEqual(['b', 'c', 'a', 'd', 'x']);
    expect(ids(filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', sort: 'name' }))).toEqual(['a', 'b', 'c', 'd', 'x']);
  });
  test('no cambia la lista original', () => {
    const copy = [...LIST];
    filterApplications(LIST, { ...DEFAULT_FILTERS, status: 'all', sort: 'name' });
    expect(LIST).toEqual(copy);
  });
});

test('countByStatus: por estado dentro del voluntariado elegido; "all" es el total', () => {
  expect(countByStatus(LIST, '')).toEqual({ pending: 2, approved: 1, rejected: 1, all: 5 });
  expect(countByStatus(LIST, 'p2')).toEqual({ pending: 1, approved: 0, rejected: 0, all: 1 });
});

test('bulkOrder: las elegidas, de la más vieja a la más nueva (orden de llegada)', () => {
  expect(bulkOrder(LIST, new Set(['a', 'b', 'd']))).toEqual(['b', 'a', 'd']);
  expect(bulkOrder(LIST, new Set())).toEqual([]);
});

test('chunk: tandas del tope del backend (500)', () => {
  expect(BULK_MAX).toBe(500);
  const many = Array.from({ length: 1001 }, (_, i) => `id${i}`);
  expect(chunk(many).map((c) => c.length)).toEqual([500, 500, 1]);
  expect(chunk(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  expect(chunk([])).toEqual([]);
});

test('mergeSummaries suma campo por campo', () => {
  expect(mergeSummaries(
    { applied: 1, unchanged: 2, full: 3, stale: 4, not_found: 5 },
    { applied: 10, unchanged: 20, full: 30, stale: 40, not_found: 50 },
  )).toEqual({ applied: 11, unchanged: 22, full: 33, stale: 44, not_found: 55 });
});

describe('summaryText', () => {
  const zero = { applied: 0, unchanged: 0, full: 0, stale: 0, not_found: 0 };
  test('aprobar: solo lo que pasó, con singular y plural', () => {
    expect(summaryText({ ...zero, applied: 12, full: 3 }, 'approved')).toBe('12 aprobadas · 3 sin cupo (siguen pendientes)');
    expect(summaryText({ ...zero, applied: 1, full: 1, unchanged: 1, stale: 1, not_found: 1 }, 'approved'))
      .toBe('1 aprobada · 1 sin cupo (sigue pendiente) · 1 ya estaba aprobada · 1 cambió mientras tanto · 1 no encontrada');
    expect(summaryText({ ...zero, unchanged: 2, stale: 2, not_found: 2 }, 'approved'))
      .toBe('2 ya estaban aprobadas · 2 cambiaron mientras tanto · 2 no encontradas');
  });
  test('rechazar', () => {
    expect(summaryText({ ...zero, applied: 2, unchanged: 1 }, 'rejected')).toBe('2 rechazadas · 1 ya estaba rechazada');
    expect(summaryText({ ...zero, applied: 1 }, 'rejected')).toBe('1 rechazada');
  });
  test('nada', () => {
    expect(summaryText(zero, 'approved')).toBe('No cambió nada.');
  });
});
