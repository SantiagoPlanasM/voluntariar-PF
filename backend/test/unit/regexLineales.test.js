// test/unit/regexLineales.test.js
//
// SonarCloud S8786 (§231): tres regex con backtracking super-lineal. Se reescriben sin cambiar qué aceptan:
//   - la equivalencia se prueba contra el regex viejo (el "oráculo"), con TODAS las cadenas cortas de un alfabeto
//     armado con los caracteres que importan a cada regex;
//   - el tiempo, con una entrada de 50 mil caracteres armada para el peor caso del regex viejo (tardaba 2,6–4,3 s).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';   // auth.js abre la base de prueba al requerirse (como en validators.test.js)

const { hasZone } = require('../../src/lib/time');
const { looksLikeEmail } = require('../../src/lib/email');
const { EMAIL_RE } = require('../../src/routes/auth');

const OLD_HAS_ZONE = /T.*(Z|[+-]\d{2}(:?\d{2})?)$/i;
const OLD_LOOKS_LIKE_EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const OLD_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Todas las cadenas de largo 0..maxLen con las letras de `alphabet`.
function* allStrings(alphabet, maxLen) {
  let level = [''];
  yield '';
  for (let len = 1; len <= maxLen; len++) {
    const next = [];
    for (const prefix of level) for (const ch of alphabet) { next.push(prefix + ch); yield prefix + ch; }
    level = next;
  }
}

function assertSameAsOracle(name, fn, oracle, alphabet, maxLen) {
  let checked = 0;
  for (const s of allStrings(alphabet, maxLen)) {
    checked++;
    if (fn(s) !== oracle.test(s)) assert.fail(`${name}(${JSON.stringify(s)}) da ${fn(s)}; el regex viejo, ${oracle.test(s)}`);
  }
  return checked;
}

function elapsedMs(fn) {
  const t0 = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

const N = 50_000;

describe('hasZone (time.js)', () => {
  test('acepta exactamente lo mismo que el regex viejo (todas las cadenas de hasta 6 caracteres)', () => {
    // T y t (flag i), Z y z, signos, dos puntos, dígito, salto de línea (el `.` viejo no lo cruzaba) y una letra cualquiera.
    const n = assertSameAsOracle('hasZone', hasZone, OLD_HAS_ZONE, ['T', 't', 'Z', 'z', '+', '-', ':', '0', '\n', '\u2028', 'x'], 6);
    assert.ok(n > 1_000_000);
  });

  test('casos reales: con zona, sin zona y solo fecha', () => {
    assert.equal(hasZone('2026-09-29T12:30:45Z'), true);
    assert.equal(hasZone('2026-09-29T12:30:45.123+00:00'), true);
    assert.equal(hasZone('2026-09-29T12:30:45-0300'), true);
    assert.equal(hasZone('2026-09-29T12:30:45-03'), true);
    assert.equal(hasZone('2026-09-29T12:30:45'), false);
    assert.equal(hasZone('2026-09-29'), false);   // el "-29" no es un offset: no hay hora antes
  });

  test(`peor caso del regex viejo (${N} caracteres) en menos de 100 ms`, () => {
    for (const s of ['T'.repeat(N) + 'x', 'T' + '0'.repeat(N) + 'x', 'T' + '+00'.repeat(N / 3) + ':0']) {
      const ms = elapsedMs(() => hasZone(s));
      assert.ok(ms < 100, `tardó ${ms.toFixed(1)} ms`);
    }
  });
});

describe('looksLikeEmail (email.js, EMAIL_REDIRECT_TO)', () => {
  test('acepta exactamente lo mismo que el regex viejo (todas las cadenas de hasta 8 caracteres)', () => {
    const n = assertSameAsOracle('looksLikeEmail', looksLikeEmail, OLD_LOOKS_LIKE_EMAIL, ['a', '.', '@', ' ', '"'], 8);
    assert.ok(n > 400_000);
  });

  test(`peor caso del regex viejo (${N} caracteres) en menos de 100 ms`, () => {
    for (const s of ['a@' + '.'.repeat(N) + ' ', 'a@' + 'b'.repeat(N) + ' ', 'a@b' + '.b'.repeat(N / 2) + '<', 'a'.repeat(N) + ' ']) {
      const ms = elapsedMs(() => looksLikeEmail(s));
      assert.ok(ms < 100, `tardó ${ms.toFixed(1)} ms`);
    }
  });
});

describe('EMAIL_RE (auth.js, registro e inicio de sesión)', () => {
  const isEmail = (s) => EMAIL_RE.test(s);

  test('acepta exactamente lo mismo que el regex viejo (todas las cadenas de hasta 9 caracteres)', () => {
    const n = assertSameAsOracle('EMAIL_RE', isEmail, OLD_EMAIL_RE, ['a', '.', '@', ' '], 9);
    assert.ok(n > 300_000);
  });

  test(`peor caso del regex viejo (${N} caracteres) en menos de 100 ms, sin depender del tope de 254`, () => {
    for (const s of ['a@' + '.'.repeat(N) + ' ', 'a@' + 'b'.repeat(N) + ' ', 'a@b' + '.b'.repeat(N / 2) + ' ', 'a'.repeat(N) + ' ']) {
      const ms = elapsedMs(() => isEmail(s));
      assert.ok(ms < 100, `tardó ${ms.toFixed(1)} ms`);
    }
  });
});
