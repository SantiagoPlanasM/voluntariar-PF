// test/unit/inputs.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { checkText, firstError } = require('../../src/lib/inputs');

describe('checkText()', () => {
  const opt = { label: 'La bio', max: 5 };                                   // opcional, se puede borrar
  const req = { label: 'El nombre', max: 10, required: true };               // obligatorio
  const keep = { label: 'El nombre', min: 2, max: 10, nullable: false };     // parcial: no vino = no tocar

  test('undefined: válido si es opcional, error si es obligatorio', () => {
    assert.equal(checkText(undefined, opt), null);
    assert.equal(checkText(undefined, keep), null);
    assert.equal(checkText(undefined, req), 'El nombre es obligatorio');
  });

  test('null: borra un opcional; error si es obligatorio o no se puede borrar', () => {
    assert.equal(checkText(null, opt), null);
    assert.equal(checkText(null, req), 'El nombre es obligatorio');
    assert.equal(checkText(null, keep), 'El nombre es obligatorio');
  });

  test('un valor que no es string → error de tipo', () => {
    for (const v of [5, ['a'], { a: 1 }, true]) assert.equal(checkText(v, opt), 'La bio tiene que ser un texto');
  });

  test('vacío o solo espacios: válido en un opcional, error en uno obligatorio', () => {
    assert.equal(checkText('', opt), null);
    assert.equal(checkText('   ', req), 'El nombre no puede estar vacío');
    assert.equal(checkText('', keep), 'El nombre no puede estar vacío');
  });

  test('mínimo sin contar espacios', () => {
    assert.equal(checkText(' a ', keep), 'El nombre tiene que tener al menos 2 caracteres');
    assert.equal(checkText('ab', keep), null);
  });

  test('máximo inclusivo', () => {
    assert.equal(checkText('x'.repeat(5), opt), null);
    assert.equal(checkText('x'.repeat(6), opt), 'La bio puede tener hasta 5 caracteres');
  });
});

describe('firstError()', () => {
  test('devuelve el primero que no es null, o null', () => {
    assert.equal(firstError(null, 'a', 'b'), 'a');
    assert.equal(firstError(null, null), null);
  });
});
