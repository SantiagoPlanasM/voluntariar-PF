// test/integration/ngo-transparency.test.js — datos de transparencia de la ONG (§285).
//
// Pedido en la entrevista a FONBEC (la confianza se gana con balances públicos y la personería al día) y en la
// encuesta (el 65 % pidió verificar a las ONG). PUT /api/ngos/me acepta, opcionales:
//   - `cuit`: 11 dígitos con o sin guiones y con el dígito verificador correcto; se guarda como XX-XXXXXXXX-X;
//   - `transparency_url`: un link https:// (hasta 500) a balances, estatuto o memoria.
// Vacíos o null los borran; si no vienen, se conservan (PUT parcial). Son públicos a propósito: los devuelven el
// perfil propio y el público. NO es una verificación: los carga la ONG.
// Seed: Sustentando (ngo-1, admin@sustentando.org).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Datos de transparencia de la ONG', () => {
  let server, token;
  const call = (path, { method = 'GET', body } = {}) => fetch(`${server.baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const put = (body) => call('/api/ngos/me', { method: 'PUT', body });
  const pub = () => fetch(`${server.baseUrl}/api/ngos/ngo-1`).then((r) => r.json());

  before(async () => {
    server = await setupTestServer({ seed: true });
    token = (await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sustentando.org', password: 'Password1' }),
    }).then((r) => r.json())).token;
  });
  after(async () => { if (server) await server.close(); });

  test('sin cargar: los dos en null', async () => {
    const me = await call('/api/ngos/me');
    assert.equal(me.body.ngo.cuit, null);
    assert.equal(me.body.ngo.transparency_url, null);
  });

  test('un CUIT válido sin guiones se guarda con guiones, y el link también; los muestra el perfil público', async () => {
    const r = await put({ cuit: '30712345671', transparency_url: 'https://sustentando.org/balances' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ngo.cuit, '30-71234567-1');
    assert.equal(r.body.ngo.transparency_url, 'https://sustentando.org/balances');
    const p = await pub();
    assert.equal(p.ngo.cuit, '30-71234567-1');
    assert.equal(p.ngo.transparency_url, 'https://sustentando.org/balances');
  });

  test('si no vienen, se conservan (PUT parcial)', async () => {
    const r = await put({ mission: 'Plantar árboles' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ngo.cuit, '30-71234567-1');
    assert.equal(r.body.ngo.transparency_url, 'https://sustentando.org/balances');
  });

  test('CUIT con el dígito verificador mal, con otro largo o que no es texto: 400 sin cambiar nada', async () => {
    for (const cuit of ['30-71234567-2', '3071234567', '30-71234567-12', 'treinta', 30712345671]) {
      const r = await put({ cuit });
      assert.equal(r.status, 400, String(cuit));
      assert.equal(r.body.error, 'El CUIT no es válido: son 11 números con el dígito verificador correcto');
    }
    assert.equal((await pub()).ngo.cuit, '30-71234567-1');
  });

  test('el link tiene que ser https:// y de hasta 500 caracteres', async () => {
    for (const url of ['http://sustentando.org/balances', 'sustentando.org', 'javascript:alert(1)', `https://x.org/${'a'.repeat(500)}`]) {
      const r = await put({ transparency_url: url });
      assert.equal(r.status, 400, url.slice(0, 30));
      assert.equal(r.body.error, 'El link de transparencia tiene que empezar con https:// y tener hasta 500 caracteres');
    }
    assert.equal((await pub()).ngo.transparency_url, 'https://sustentando.org/balances');
  });

  test('vacíos o null los borran', async () => {
    const r = await put({ cuit: '', transparency_url: null });
    assert.equal(r.status, 200);
    assert.equal(r.body.ngo.cuit, null);
    assert.equal(r.body.ngo.transparency_url, null);
  });
});
