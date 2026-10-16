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

  // REVISION A5 (tercera pasada): `question` que no era texto reventaba en `.trim()` (500 en los dos motores),
  // y no había largo máximo.
  describe('POST /api/faqs/ask valida el cuerpo', () => {
    const ask = (body) => api('/api/faqs/ask', { method: 'POST', body });

    for (const [label, question] of [['un número', 12345], ['un array', ['¿cómo me inscribo?']], ['un objeto', { q: 'inscribo' }], ['true', true]]) {
      test(`question ${label} → 400 en español`, async () => {
        const res = await ask({ question });
        assert.equal(res.status, 400, JSON.stringify(res.body));
        assert.equal(res.body.error, 'La pregunta tiene que ser un texto');
      });
    }

    for (const [label, body] of [['ausente', {}], ['null', { question: null }], ['vacía', { question: '   ' }], ['de 2 letras', { question: ' ab ' }]]) {
      test(`question ${label} → 400 "muy corta" (como antes)`, async () => {
        const res = await ask(body);
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'La pregunta es muy corta');
      });
    }

    test('question de más de 500 caracteres → 400', async () => {
      const res = await ask({ question: 'inscribo '.repeat(56).slice(0, 501) });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'La pregunta puede tener hasta 500 caracteres');
    });

    test('question de exactamente 500 caracteres se responde', async () => {
      const res = await ask({ question: '¿cómo me inscribo? '.repeat(30).slice(0, 500) });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.best.pregunta, '¿Cómo me inscribo a un voluntariado?');
    });

    for (const [label, categoria] of [['un número', 3], ['un array', ['general']], ['un objeto', { a: 1 }]]) {
      test(`categoria ${label} → 400 en español`, async () => {
        const res = await ask({ question: '¿cómo me inscribo?', categoria });
        assert.equal(res.status, 400, JSON.stringify(res.body));
        assert.equal(res.body.error, 'La categoría tiene que ser un texto');
      });
    }

    test('categoria de más de 50 caracteres → 400', async () => {
      const res = await ask({ question: '¿cómo me inscribo?', categoria: 'v'.repeat(51) });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'La categoría puede tener hasta 50 caracteres');
    });

    test('categoria null se toma como "sin categoría"', async () => {
      const res = await ask({ question: '¿cómo me inscribo?', categoria: null });
      assert.equal(res.status, 200);
      assert.equal(res.body.best.pregunta, '¿Cómo me inscribo a un voluntariado?');
    });
  });
});
