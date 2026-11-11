// src/lib/sponsorship.test.ts — qué cambió en un acuerdo desde la versión que aceptó una parte (§325).
import { describe, test, expect } from 'vitest';
import type { SponsorshipChange, SponsorshipVersion } from './api';
import { changesSince } from './sponsorship';

const snap = (detail: string) => ({ type: 'supplies' as const, detail, amount: null });
const v = (version: number, changes: SponsorshipChange[]): SponsorshipVersion =>
  ({ version, side: 'ngo', author_name: 'Ana', created_at: '', changes, accepted_by: [] });
const add = (id: string, d: string): SponsorshipChange => ({ action: 'add', point_id: id, side: 'ngo', before: null, after: snap(d) });
const edit = (id: string, a: string, b: string): SponsorshipChange => ({ action: 'edit', point_id: id, side: 'ngo', before: snap(a), after: snap(b) });
const remove = (id: string, d: string): SponsorshipChange => ({ action: 'remove', point_id: id, side: 'ngo', before: snap(d), after: null });

describe('changesSince', () => {
  test('solo cuenta lo posterior a la versión aceptada (las versiones vienen de la más nueva a la más vieja)', () => {
    const r = changesSince([v(3, [edit('a', 'A1', 'A2')]), v(2, [add('b', 'B')])], 2);
    expect([...r.points.keys()]).toEqual(['a']);
    expect(r.points.get('a')).toEqual({ kind: 'edit', before: snap('A1') });
    expect(r.count).toBe(1);
  });

  test('editado dos veces: "antes" es como estaba cuando acepté', () => {
    const r = changesSince([v(4, [edit('a', 'A2', 'A3')]), v(3, [edit('a', 'A1', 'A2')])], 2);
    expect(r.points.get('a')).toEqual({ kind: 'edit', before: snap('A1') });
    expect(r.count).toBe(1);
  });

  test('agregado y después editado sigue siendo nuevo', () => {
    const r = changesSince([v(4, [edit('a', 'A', 'A2')]), v(3, [add('a', 'A')])], 2);
    expect(r.points.get('a')).toEqual({ kind: 'add' });
  });

  test('quitado: aparece como quitado con lo que había cuando acepté', () => {
    const r = changesSince([v(4, [remove('a', 'A2')]), v(3, [edit('a', 'A1', 'A2')])], 2);
    expect(r.points.has('a')).toBe(false);
    expect(r.removed).toEqual([snap('A1')]);
    expect(r.count).toBe(1);
  });

  test('agregado y quitado después de aceptar: no cuenta (nunca lo vi)', () => {
    const r = changesSince([v(4, [remove('a', 'A')]), v(3, [add('a', 'A')])], 2);
    expect(r.points.size).toBe(0);
    expect(r.removed).toEqual([]);
    expect(r.count).toBe(0);
  });

  test('sin cambios posteriores, nada', () => {
    expect(changesSince([v(2, [add('a', 'A')])], 2).count).toBe(0);
    expect(changesSince([], 1).count).toBe(0);
  });
});
