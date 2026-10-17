// test/unit/validators.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// projects.js abre una conexión a la base apenas se requiere (vía
// src/db → require('./db')), así que para poder importar validateProject de
// forma aislada seteamos USE_POSTGRES=false y dejamos que abra su sqlite de
// prueba normal — no ejecuta ninguna query real, solo necesita que el
// require no explote.
process.env.NODE_ENV = 'test';

const { validateProject } = require('../../src/routes/projects');
const { hasBadWord } = require('../../src/lib/badWords'); // se movió a lib/ (REVISION B7, §93)
const { validateEmail, validateName, validatePassword } = require('../../src/routes/auth');

describe('validateProject', () => {
  const base = {
    title: 'Reforestar el parque',
    description: 'Vamos a plantar árboles nativos en el parque',
    location: 'Córdoba',
    tipo: 'fugaz',
    duracion: '1 día',
    volunteers_needed: 10,
  };

  test('acepta un proyecto válido', () => {
    assert.equal(validateProject(base), null);
  });

  // ── Regresión del bug B5 (ver docs/PROJECT_ANALYSIS.md §13) ──────────────
  // El bug real fue que el backend validaba `cupos` (español) en vez de
  // `volunteers_needed` (el nombre que realmente manda el frontend), y por
  // eso la creación de proyectos SIEMPRE fallaba con "Los cupos deben ser
  // un número positivo", sin importar el valor ingresado.
  test('BUG B5 — rechaza si falta volunteers_needed', () => {
    const err = validateProject({ ...base, volunteers_needed: undefined });
    assert.equal(err, 'Los cupos deben ser un número positivo');
  });

  test('BUG B5 — acepta volunteers_needed como string numérico (así llega desde un <input>)', () => {
    assert.equal(validateProject({ ...base, volunteers_needed: '15' }), null);
  });

  test('rechaza volunteers_needed <= 0', () => {
    assert.equal(validateProject({ ...base, volunteers_needed: 0 }), 'Los cupos deben ser un número positivo');
    assert.equal(validateProject({ ...base, volunteers_needed: -3 }), 'Los cupos deben ser un número positivo');
  });

  test('rechaza título muy corto', () => {
    assert.match(validateProject({ ...base, title: 'ab' }), /título/);
  });

  test('rechaza descripción muy corta', () => {
    assert.match(validateProject({ ...base, description: 'corta' }), /descripción/);
  });

  test('rechaza ubicación vacía', () => {
    assert.match(validateProject({ ...base, location: '' }), /ubicación/);
  });

  test('tipo fugaz requiere duración', () => {
    const err = validateProject({ ...base, tipo: 'fugaz', duracion: '' });
    assert.match(err, /duración/);
  });

  test('tipo sostenido requiere horas_semanales, no duracion', () => {
    const ok = validateProject({ ...base, tipo: 'sostenido', duracion: '', horas_semanales: 5 });
    assert.equal(ok, null);
    const err = validateProject({ ...base, tipo: 'sostenido', horas_semanales: 0 });
    assert.match(err, /horas semanales/);
  });
});

describe('hasBadWord (blacklist de comentarios/proyectos)', () => {
  test('detecta una palabra de la blacklist', () => {
    assert.equal(hasBadWord('sos un boludo'), true);
  });
  test('no detecta nada en texto normal', () => {
    assert.equal(hasBadWord('quiero ayudar con el proyecto'), false);
  });
  test('es case-insensitive', () => {
    assert.equal(hasBadWord('BOLUDO'), true);
  });
});

describe('validateEmail / validateName / validatePassword', () => {
  test('email válido', () => { assert.equal(validateEmail('a@b.com'), null); });
  test('email inválido', () => { assert.match(validateEmail('no-es-un-email'), /inválido/); });
  test('email vacío', () => { assert.match(validateEmail(''), /inválido/); });

  test('nombre válido con acentos', () => { assert.equal(validateName('María José'), null); });
  test('nombre con números → rechazado', () => { assert.match(validateName('Juan123'), /letras/); });
  test('nombre de 1 letra → rechazado', () => { assert.match(validateName('J'), /letras/); });

  test('password válida', () => { assert.equal(validatePassword('Password1'), null); });
  test('password corta → rechazada', () => { assert.match(validatePassword('Ab1'), /8 caracteres/); });
  test('password sin mayúscula → rechazada', () => { assert.match(validatePassword('password1'), /mayúscula/); });
  test('password sin número → rechazada', () => { assert.match(validatePassword('Password'), /número/); });
});

// Email: largo máximo 254 (RFC 5321) ANTES del regex. SonarCloud S8786 (§201): EMAIL_RE tiene backtracking
// cuadrático; con 80 mil caracteres bloqueaba la API 3,4 s por pedido. Criterio: 254 pasa, 255 no, y un email
// gigante se rechaza en milisegundos.
describe('validateEmail — largo máximo y tiempo (ReDoS)', () => {
  const at254 = 'a'.repeat(64) + '@' + 'b'.repeat(185) + '.com';   // 64 + 1 + 185 + 4 = 254

  test('254 caracteres pasa, 255 no', () => {
    // Arrange
    const at255 = 'a' + at254;
    // Act
    const results = [validateEmail(at254), validateEmail(at255)];
    // Assert
    assert.deepEqual([at254.length, at255.length], [254, 255]);
    assert.deepEqual(results, [null, 'Email inválido']);
  });

  test('un email de 80 mil caracteres armado para el peor caso se rechaza rápido (< 100 ms)', () => {
    const evil = 'a@' + 'a.'.repeat(40000) + '@';
    const t0 = process.hrtime.bigint();
    const result = validateEmail(evil);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.equal(result, 'Email inválido');
    assert.ok(ms < 100, `tardó ${ms.toFixed(1)} ms`);
  });

  test('los espacios de los costados no cuentan para el largo (se recortan, como antes)', () => {
    assert.equal(validateEmail(`  ${at254}  `), null);
  });
});

// Valores límite de la contraseña (TP de Calidad, eje 5; docs/calidad/DISENO_CASOS.md §2; PROJECT_ANALYSIS.md §199).
// Hueco encontrado por mutación: con `v.length < 7` en vez de `< 8` ningún test fallaba (solo se probaba 'Ab1').
describe('validatePassword — valores límite (8 caracteres y 72 bytes)', () => {
  const MIN = 'Mínimo 8 caracteres';
  const MAX = 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)';

  test('mínimo: 7 caracteres no, 8 sí', () => {
    // Arrange
    const siete = 'Passwo1';
    const ocho = 'Passwor1';
    // Act
    const results = [validatePassword(siete), validatePassword(ocho)];
    // Assert
    assert.equal(siete.length, 7);
    assert.deepEqual(results, [MIN, null]);
  });

  test('máximo en bytes: 72 sí, 73 no (ASCII)', () => {
    const p72 = 'Password1' + 'a'.repeat(63);
    const p73 = p72 + 'a';
    assert.deepEqual([Buffer.byteLength(p72), Buffer.byteLength(p73)], [72, 73]);
    assert.deepEqual([validatePassword(p72), validatePassword(p73)], [null, MAX]);
  });

  test('cuenta bytes, no caracteres: con ñ (2 bytes) 72 sí, 73 no', () => {
    const p72 = 'A1' + 'ñ'.repeat(35);          // 2 + 70 = 72 bytes, 37 caracteres
    const p73 = p72 + 'a';
    assert.deepEqual([Buffer.byteLength(p72), p72.length], [72, 37]);
    assert.deepEqual([validatePassword(p72), validatePassword(p73)], [null, MAX]);
  });

  test('lo que no es texto → "Mínimo 8" (no 500)', () => {
    const results = [undefined, null, 12345678, ['Password1']].map(validatePassword);
    assert.deepEqual(results, [MIN, MIN, MIN, MIN]);
  });
});
