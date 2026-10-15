// test/unit/jwtSecret.test.js — el secreto de los JWT (REVISION B19 + AI_RULES regla 17; decisión del usuario:
// exigirlo en producción). Antes `middleware/auth.js` y `ws/index.js` tenían cada uno
// `process.env.JWT_SECRET || 'voluntariar_dev_secret'`: en producción sin la variable, cualquiera que leyera el
// repo podía fabricar tokens válidos (de cualquier usuario y rol).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resolveJwtSecret, DEV_JWT_SECRET } = require('../../src/lib/jwtSecret');

test('en desarrollo o tests sin JWT_SECRET: el valor de desarrollo (como antes)', () => {
  assert.equal(resolveJwtSecret({}), DEV_JWT_SECRET);
  assert.equal(resolveJwtSecret({ NODE_ENV: 'development' }), DEV_JWT_SECRET);
  assert.equal(resolveJwtSecret({ NODE_ENV: 'test' }), DEV_JWT_SECRET);
});

test('si está definida, se usa (en cualquier entorno)', () => {
  assert.equal(resolveJwtSecret({ JWT_SECRET: 'abc' }), 'abc');
  assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'un-secreto-largo-y-aleatorio' }), 'un-secreto-largo-y-aleatorio');
});

test('en producción sin JWT_SECRET: error claro (el servidor no arranca)', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: '' }), /JWT_SECRET/);
});

test('en producción con el valor de desarrollo (público en el repo): también error', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: DEV_JWT_SECRET }), /JWT_SECRET/);
});

test('un solo lugar define el secreto: ni el middleware ni el WebSocket tienen su propia copia', () => {
  for (const f of ['src/middleware/auth.js', 'src/ws/index.js']) {
    const src = fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
    assert.ok(!src.includes('voluntariar_dev_secret'), `${f} no debe tener el valor de desarrollo`);
    assert.ok(src.includes("require('../lib/jwtSecret')"), `${f} usa lib/jwtSecret`);
  }
});
