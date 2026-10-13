// test/unit/time.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { toMillis } = require('../../src/lib/time');

const UTC = Date.UTC(2026, 8, 29, 12, 30, 45); // 2026-09-29 12:30:45 UTC

describe('toMillis()', () => {
  test('string de SQLite ("YYYY-MM-DD HH:MM:SS") se interpreta como UTC', () => {
    assert.equal(toMillis('2026-09-29 12:30:45'), UTC);
  });

  test('objeto Date (Postgres) devuelve su valor', () => {
    assert.equal(toMillis(new Date(UTC)), UTC);
  });

  test('ISO con Z o con offset respeta la zona indicada, sin sumarle otra "Z"', () => {
    assert.equal(toMillis('2026-09-29T12:30:45Z'), UTC);
    assert.equal(toMillis('2026-09-29T09:30:45-03:00'), UTC);
    assert.equal(toMillis('2026-09-29T09:30:45-0300'), UTC);
    assert.equal(toMillis('2026-09-29 15:30:45+03:00'), UTC);
  });

  test('un string y un Date del mismo instante dan el mismo resultado en ambos motores', () => {
    assert.equal(toMillis('2026-09-29 12:30:45'), toMillis(new Date('2026-09-29T12:30:45Z')));
  });

  test('solo fecha ("YYYY-MM-DD"): el "-29" final no se confunde con un offset', () => {
    assert.equal(toMillis('2026-09-29'), Date.UTC(2026, 8, 29));
  });

  test('con milisegundos / microsegundos', () => {
    assert.equal(toMillis('2026-09-29 12:30:45.123'), UTC + 123);
    assert.equal(toMillis('2026-09-29T12:30:45.123Z'), UTC + 123);
  });

  test('null, undefined, vacío, basura y Date inválido devuelven null (nunca lanzan ni dan NaN)', () => {
    for (const bad of [null, undefined, '', '   ', 'no es una fecha', new Date('x')]) {
      assert.equal(toMillis(bad), null, String(bad));
    }
  });

  test('sirve para ordenar sin importar el tipo: mezcla de string y Date', () => {
    const items = [new Date('2026-09-29T10:00:00Z'), '2026-09-29 12:00:00', null, '2026-09-29 11:00:00'];
    const sorted = items.slice().sort((a, b) => (toMillis(b) ?? 0) - (toMillis(a) ?? 0));
    assert.deepEqual(sorted, ['2026-09-29 12:00:00', '2026-09-29 11:00:00', items[0], null]);
  });
});
