// test/unit/validators.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// projects.js abre una conexión a la base apenas se requiere (vía
// src/db → require('./db')), así que para poder importar validateProject de
// forma aislada seteamos USE_POSTGRES=false y dejamos que abra su sqlite de
// prueba normal — no ejecuta ninguna query real, solo necesita que el
// require no explote.
process.env.NODE_ENV = 'test';

const { validateProject, hasBadWord } = require('../../src/routes/projects');
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
