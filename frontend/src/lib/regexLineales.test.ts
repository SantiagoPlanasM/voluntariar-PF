// src/lib/regexLineales.test.ts
//
// SonarCloud S8786 (§231), espejo de backend/test/unit/regexLineales.test.js: tres regex con backtracking
// super-lineal se reescriben sin cambiar qué aceptan. La equivalencia se prueba contra el regex viejo (el
// "oráculo") con TODAS las cadenas cortas de un alfabeto armado con los caracteres que importan; el tiempo, con
// una entrada de 50 mil caracteres armada para el peor caso del regex viejo (tardaba 2–4 s).
import { describe, test, expect } from 'vitest';
import { hasZone, truncateText } from './format';
import { EMAIL_RE } from '../app/components/AuthModal';

const OLD_HAS_ZONE = /T.*(Z|[+-]\d{2}(:?\d{2})?)$/i;
const OLD_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Todas las cadenas de largo 0..maxLen con las letras de `alphabet`.
function* allStrings(alphabet: string[], maxLen: number): Generator<string> {
  let level = [''];
  yield '';
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = [];
    for (const prefix of level) for (const ch of alphabet) { next.push(prefix + ch); yield prefix + ch; }
    level = next;
  }
}

// Devuelve la primera cadena en la que difieren (o null) y cuántas se miraron.
function firstDifference(fn: (s: string) => boolean, oracle: RegExp, alphabet: string[], maxLen: number) {
  let checked = 0;
  for (const s of allStrings(alphabet, maxLen)) {
    checked++;
    if (fn(s) !== oracle.test(s)) return { diff: s, checked };
  }
  return { diff: null, checked };
}

function elapsedMs(fn: () => void) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

const N = 50_000;

describe('hasZone (format.ts)', () => {
  test('acepta exactamente lo mismo que el regex viejo (todas las cadenas de hasta 6 caracteres)', () => {
    // T y t (flag i), Z y z, signos, dos puntos, dígito, saltos de línea (el `.` viejo no los cruzaba) y una letra.
    const { diff, checked } = firstDifference(hasZone, OLD_HAS_ZONE, ['T', 't', 'Z', 'z', '+', '-', ':', '0', '\n', '\u2028', 'x'], 6);
    expect(diff).toBeNull();
    expect(checked).toBeGreaterThan(1_000_000);
  });

  test('casos reales: con zona, sin zona y solo fecha', () => {
    expect(hasZone('2026-08-10T12:30:45Z')).toBe(true);
    expect(hasZone('2026-08-10T12:30:45.123+00:00')).toBe(true);
    expect(hasZone('2026-08-10T12:30:45-0300')).toBe(true);
    expect(hasZone('2026-08-10T12:30:45')).toBe(false);
    expect(hasZone('2026-08-10')).toBe(false);   // el "-10" no es un offset: no hay hora antes
  });

  test(`peor caso del regex viejo (${N} caracteres) en menos de 100 ms`, () => {
    for (const s of ['T'.repeat(N) + 'x', 'T' + '0'.repeat(N) + 'x']) {
      expect(elapsedMs(() => hasZone(s))).toBeLessThan(100);
    }
  });
});

describe('EMAIL_RE (AuthModal.tsx)', () => {
  const isEmail = (s: string) => EMAIL_RE.test(s);

  test('acepta exactamente lo mismo que el regex viejo (todas las cadenas de hasta 9 caracteres)', () => {
    const { diff, checked } = firstDifference(isEmail, OLD_EMAIL_RE, ['a', '.', '@', ' '], 9);
    expect(diff).toBeNull();
    expect(checked).toBeGreaterThan(300_000);
  });

  test(`peor caso del regex viejo (${N} caracteres) en menos de 100 ms, sin depender del tope de 254`, () => {
    for (const s of ['a@' + '.'.repeat(N) + ' ', 'a@' + 'b'.repeat(N) + ' ', 'a@b' + '.b'.repeat(N / 2) + ' ']) {
      expect(elapsedMs(() => isEmail(s))).toBeLessThan(100);
    }
  });
});

describe('truncateText: los espacios del final', () => {
  test('saca exactamente lo mismo que /\\s+$/ (todas las cadenas de hasta 6 caracteres con cada tipo de espacio)', () => {
    // Todos los caracteres que `\s` reconoce, más uno que no.
    const spaces = ['\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', '\u2000', '\u200a', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff'];
    for (const s of allStrings([...spaces, 'a'], 4)) {
      // Se corta justo en `s`; después viene un espacio, así que no retrocede hasta la última palabra.
      const longText = s + ' ' + 'x'.repeat(20);
      expect(truncateText(longText, s.length, 99).text).toBe(s.replace(/\s+$/, '') + '…');
    }
  });

  test(`peor caso del regex viejo (${N} espacios en el medio) en menos de 100 ms`, () => {
    // Más de 4 líneas y todas entran en `max`: el corte termina en "b\n\n\n" y el regex viejo era cuadrático.
    const text = 'a' + ' '.repeat(N) + 'b\n\n\n\nx';
    let result = '';
    expect(elapsedMs(() => { result = truncateText(text, 10 * N).text; })).toBeLessThan(100);
    expect(result).toBe('a' + ' '.repeat(N) + 'b…');
  });
});
