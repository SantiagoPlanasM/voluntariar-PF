// test/integration/faqs.test.js
//
// Chatbot de FAQs (routes/faqs.js). Corre en los dos motores: la columna
// `activo` es BOOLEAN en Postgres e INTEGER en SQLite, y `WHERE activo=1`
// daba 500 siempre en Postgres (REVISION.md B1). Las FAQs las carga migrate.js.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('FAQs (chatbot sin IA)', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    server = await setupTestServer();
    baseUrl = server.baseUrl;
    db = require('../../src/db');
  });

  after(async () => {
    if (server) await server.close();
  });

  const api = (path, { method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  test('GET /api/faqs lista el catálogo activo, ordenado', async () => {
    const res = await api('/api/faqs');
    assert.equal(res.status, 200);
    assert.equal(res.body.faqs.length, 8);
    assert.deepEqual(Object.keys(res.body.faqs[0]).sort(), ['categoria', 'id', 'pregunta', 'respuesta']);
  });

  test('GET /api/faqs?categoria filtra por categoría y respeta el orden', async () => {
    const res = await api('/api/faqs?categoria=ngo');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.faqs.map((f) => f.pregunta), [
      '¿Cómo creo un nuevo voluntariado?',
      '¿Cómo apruebo o rechazo inscripciones?',
      '¿Qué es un patrocinio de empresa?',
    ]);
  });

  test('POST /api/faqs/ask encuentra la mejor coincidencia', async () => {
    const res = await api('/api/faqs/ask', { method: 'POST', body: { question: '¿cómo me inscribo?' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.matched, true);
    assert.equal(res.body.best.pregunta, '¿Cómo me inscribo a un voluntariado?');
  });

  test('POST /api/faqs/ask sin coincidencias devuelve sugerencias de la categoría', async () => {
    const res = await api('/api/faqs/ask', {
      method: 'POST',
      body: { question: 'zzzz qqqq', categoria: 'general' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.matched, false);
    assert.deepEqual(res.body.suggestions.map((s) => s.pregunta), [
      '¿Voluntariar tiene costo?',
      '¿Cómo contacto a una ONG o empresa?',
    ]);
  });

  test('una FAQ desactivada no aparece en el catálogo, ni como respuesta ni como sugerencia', async () => {
    const pregunta = '¿Voluntariar tiene costo?';
    await db.run('UPDATE faqs SET activo=false WHERE pregunta=$1', [pregunta]);
    try {
      const list = await api('/api/faqs');
      assert.equal(list.status, 200);
      assert.equal(list.body.faqs.length, 7);
      assert.ok(!list.body.faqs.some((f) => f.pregunta === pregunta));

      const byCat = await api('/api/faqs?categoria=general');
      assert.deepEqual(byCat.body.faqs.map((f) => f.pregunta), ['¿Cómo contacto a una ONG o empresa?']);

      const ask = await api('/api/faqs/ask', { method: 'POST', body: { question: 'tiene costo? es gratis?' } });
      assert.equal(ask.status, 200);
      assert.equal(ask.body.matched, false);
      assert.ok(ask.body.suggestions.length > 0);
      assert.ok(!ask.body.suggestions.some((s) => s.pregunta === pregunta));

      const askCat = await api('/api/faqs/ask', {
        method: 'POST',
        body: { question: 'gratis', categoria: 'general' },
      });
      assert.equal(askCat.body.matched, false);
      assert.ok(!askCat.body.suggestions.some((s) => s.pregunta === pregunta));
    } finally {
      await db.run('UPDATE faqs SET activo=true WHERE pregunta=$1', [pregunta]);
    }
  });
});
