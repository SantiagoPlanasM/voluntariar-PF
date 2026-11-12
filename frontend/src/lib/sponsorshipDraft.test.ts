// src/lib/sponsorshipDraft.test.ts — el borrador del acuerdo de patrocinio (§327).
//
// Decisión del usuario (11/11): los cambios de una parte quedan en su pantalla hasta "Guardar cambios", que los manda
// juntos como una versión. Estas funciones llevan el borrador y lo traducen al lote de POST …/cambios.
import { describe, test, expect } from 'vitest';
import type { SponsorshipPoint } from './api';
import { addPoint, draftCount, editPoint, emptyDraft, isNew, removePoint, toChanges, toPoints, undoRemove } from './sponsorshipDraft';

const server: SponsorshipPoint = {
  id: 'pt1', side: 'company', type: 'money', detail: 'Plantines', amount: 1000, created_at: '', updated_at: '',
  created_by_name: 'Laura', edited_by_name: null, edited_at: null,
};

describe('borrador del acuerdo', () => {
  test('vacío: sin cambios', () => {
    expect(draftCount(emptyDraft())).toBe(0);
    expect(toChanges(emptyDraft())).toEqual([]);
  });

  test('agregar: el monto solo va en dinero y el detalle sin espacios de más', () => {
    let d = addPoint(emptyDraft(), 'a', { type: 'money', detail: '  Plantines ', amount: 500 });
    d = addPoint(d, 'b', { type: 'supplies', detail: 'Guantes', amount: 99 });
    expect(draftCount(d)).toBe(2);
    expect(toChanges(d)).toEqual([
      { action: 'add', type: 'money', detail: 'Plantines', amount: 500 },
      { action: 'add', type: 'supplies', detail: 'Guantes' },
    ]);
    expect(isNew('new:a')).toBe(true);
    expect(isNew('pt1')).toBe(false);
  });

  test('editar un punto guardado; volver a como estaba deja de ser un cambio', () => {
    let d = editPoint(emptyDraft(), server, 'pt1', { type: 'money', detail: 'Plantines', amount: 2000 });
    expect(toChanges(d)).toEqual([{ action: 'edit', point_id: 'pt1', type: 'money', detail: 'Plantines', amount: 2000 }]);
    d = editPoint(d, server, 'pt1', { type: 'money', detail: ' Plantines ', amount: 1000 });
    expect(draftCount(d)).toBe(0);
  });

  test('pasar de dinero a otro tipo no manda monto', () => {
    const d = editPoint(emptyDraft(), server, 'pt1', { type: 'supplies', detail: 'Plantines', amount: 1000 });
    expect(toChanges(d)).toEqual([{ action: 'edit', point_id: 'pt1', type: 'supplies', detail: 'Plantines' }]);
  });

  test('editar un punto nuevo cambia el agregado (no es una edición)', () => {
    let d = addPoint(emptyDraft(), 'a', { type: 'supplies', detail: 'Guantes', amount: null });
    d = editPoint(d, undefined, 'new:a', { type: 'supplies', detail: 'Guantes y bolsas', amount: null });
    expect(toChanges(d)).toEqual([{ action: 'add', type: 'supplies', detail: 'Guantes y bolsas' }]);
  });

  test('quitar un guardado (y su edición); deshacer lo vuelve a dejar como estaba', () => {
    let d = editPoint(emptyDraft(), server, 'pt1', { type: 'money', detail: 'Otra', amount: 1000 });
    d = removePoint(d, 'pt1');
    expect(toChanges(d)).toEqual([{ action: 'remove', point_id: 'pt1' }]);
    d = removePoint(d, 'pt1');
    expect(draftCount(d)).toBe(1);
    d = undoRemove(d, 'pt1');
    expect(draftCount(d)).toBe(0);
  });

  test('quitar un punto nuevo lo saca del borrador (nunca existió)', () => {
    let d = addPoint(emptyDraft(), 'a', { type: 'supplies', detail: 'Guantes', amount: null });
    d = removePoint(d, 'new:a');
    expect(draftCount(d)).toBe(0);
  });

  test('el orden del lote: agregados, editados y quitados', () => {
    let d = removePoint(emptyDraft(), 'pt9');
    d = editPoint(d, server, 'pt1', { type: 'money', detail: 'Otra', amount: 1000 });
    d = addPoint(d, 'a', { type: 'other', detail: 'Informe', amount: null });
    expect(toChanges(d).map(c => c.action)).toEqual(['add', 'edit', 'remove']);
  });

  // §329: al proponer, el borrador solo tiene puntos nuevos y viajan como `points` (sin `action`).
  test('toPoints: los agregados como los recibe la propuesta, en orden y con el monto solo en dinero', () => {
    expect(toPoints(emptyDraft())).toEqual([]);
    let d = addPoint(emptyDraft(), 'a', { type: 'money', detail: ' Plantines ', amount: 500 });
    d = addPoint(d, 'b', { type: 'supplies', detail: 'Guantes', amount: 99 });
    d = editPoint(d, undefined, 'new:b', { type: 'supplies', detail: 'Guantes y bolsas', amount: null });
    expect(toPoints(d)).toEqual([
      { type: 'money', detail: 'Plantines', amount: 500 },
      { type: 'supplies', detail: 'Guantes y bolsas' },
    ]);
    expect(Object.keys(toPoints(d)[1])).toEqual(['type', 'detail', 'amount']);   // amount undefined: no viaja en el JSON
  });
});
