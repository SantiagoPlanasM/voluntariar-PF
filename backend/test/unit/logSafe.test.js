// test/unit/logSafe.test.js — forLog(): texto seguro para los logs (SonarCloud S5145 "Log injection"; §202).
// Criterio (antes del código): lo que entra a un log desde afuera (query string, cuerpo, mensajes de error de
// Cloudinary o Mercado Pago) no puede partir la línea ni inventar otras: los saltos de línea y demás caracteres de
// control se reemplazan por un espacio, el resultado tiene un largo máximo, y cualquier valor (null, número,
// objeto) se convierte a texto sin romper.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { forLog } = require('../../src/lib/logSafe');

describe('forLog', () => {
  test('un salto de línea no inventa otra línea en el log', () => {
    // Arrange: un data.id del webhook que trae "\n" ya decodificado del query string
    const evil = '123\n[donaciones] aviso del pago 999: aprobado';
    // Act
    const out = forLog(evil);
    // Assert
    assert.equal(out, '123 [donaciones] aviso del pago 999: aprobado');
    assert.doesNotMatch(out, /[\r\n]/);
  });

  test('todos los caracteres de control (CR, tab, NUL, ESC, DEL) y los separadores de línea Unicode → espacio', () => {
    assert.equal(forLog('a\rb\tc\u0000d\u001be\u007ff g h'), 'a b c d e f g h');
  });

  test('el texto normal, con acentos y emojis, no cambia', () => {
    assert.equal(forLog('Cloudinary respondió 401: firma inválida 🙃'), 'Cloudinary respondió 401: firma inválida 🙃');
  });

  test('largo máximo: 300 por defecto, configurable, con "…" si se corta', () => {
    assert.equal(forLog('x'.repeat(300)), 'x'.repeat(300));
    assert.equal(forLog('x'.repeat(301)), 'x'.repeat(300) + '…');
    assert.equal(forLog('abcdef', 3), 'abc…');
  });

  test('cualquier valor se convierte a texto sin romper', () => {
    assert.deepEqual([forLog(null), forLog(undefined), forLog(42), forLog({ a: 1 })],
      ['null', 'undefined', '42', '[object Object]']);
  });
});
