// test/unit/errorHandler.test.js
//
// Manejador global de errores (src/lib/errorHandler.js, REVISION.md B3). Los casos que llegan por HTTP
// (JSON roto, cuerpo grande, charset, CORS) están en test/integration/error-handler.test.js; acá van
// los que ninguna ruta dispara hoy: un error inesperado y una respuesta ya enviada.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler, corsError } = require('../../src/lib/errorHandler');

const fakeRes = () => {
  const res = { headersSent: false, statusCode: null, payload: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
};

// Silencia el console.error del manejador y devuelve lo que se logueó.
const withLog = (fn) => {
  const orig = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try { fn(); } finally { console.error = orig; }
  return logged;
};

describe('errorHandler', () => {
  test('un error inesperado → 500 genérico en español; el mensaje interno solo va al log', () => {
    const res = fakeRes();
    const logged = withLog(() =>
      errorHandler(new Error('relation "secret_table" does not exist'), { method: 'GET', path: '/x' }, res, () => {}));
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { error: 'Error interno del servidor' });
    assert.ok(logged.some((l) => l.includes('secret_table')), 'el detalle queda en el log');
  });

  test('un error 4xx que no conocemos usa su código, con un mensaje genérico', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('request aborted'), { status: 400, type: 'request.aborted' });
    withLog(() => errorHandler(err, { method: 'POST', path: '/x' }, res, () => {}));
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, 'El pedido no es válido');
  });

  test('un 5xx con status explícito no se trata como error del cliente', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('detalle interno'), { status: 503 });
    withLog(() => errorHandler(err, { method: 'GET', path: '/x' }, res, () => {}));
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { error: 'Error interno del servidor' });
  });

  test('si la respuesta ya se empezó a mandar, se delega a Express (next)', () => {
    const res = fakeRes();
    res.headersSent = true;
    let passed = null;
    withLog(() => errorHandler(new Error('x'), { method: 'GET', path: '/x' }, res, (e) => { passed = e; }));
    assert.equal(passed?.message, 'x');
    assert.equal(res.statusCode, null, 'no intenta escribir de nuevo');
  });

  test('corsError() marca el error para que el manejador responda 403', () => {
    const res = fakeRes();
    withLog(() => errorHandler(corsError('https://otro.example'), { method: 'GET', path: '/x' }, res, () => {}));
    assert.equal(res.statusCode, 403);
    assert.ok(!res.payload.error.includes('otro.example'));
  });
});
