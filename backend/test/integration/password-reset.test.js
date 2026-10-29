// test/integration/password-reset.test.js
//
// "¿Olvidaste tu contraseña?" (§275):
//   POST /api/auth/forgot-password { email }                (sin sesión) → si hay una cuenta, le manda un link
//   POST /api/auth/reset-password  { token, new_password }  (sin sesión) → fija la contraseña nueva
// No revela si el email tiene cuenta: la respuesta es la misma, y el código y el email se hacen DESPUÉS de responder
// (así tampoco se nota por el tiempo ni por un email que falla). El único error que depende del servidor y no del email
// es 503 sin Resend, igual para todos. El código es de 256 bits, se guarda SOLO su hash, vence en 1 hora y sirve una
// vez; un pedido nuevo invalida el anterior. La contraseña nueva cumple las reglas del registro y se valida ANTES de
// gastar el código. Dos pedidos a la vez con el mismo link: lo usa uno solo (compare-and-swap sobre el código).
// Los límites de pedidos están en password-reset-limit.test.js (cada archivo es un proceso: no se mezclan).
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { setupTestServer } = require('./helpers');

describe('Recuperar la contraseña por email', () => {
  let server, baseUrl, db, email, sent, sendResult, savedKey;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    email = require('../../src/lib/email');
    mock.method(email, 'sendEmail', async (msg) => { sent.push(msg); return sendResult; });
    savedKey = process.env.RESEND_API_KEY;
  });
  after(async () => {
    mock.restoreAll();
    if (savedKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedKey;
    if (server) await server.close();
  });
  beforeEach(() => { sent = []; sendResult = { ok: true }; process.env.RESEND_API_KEY = 're_test_no_se_usa'; });

  const post = (path, body) => fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const forgot = (mail) => post('/api/auth/forgot-password', { email: mail });
  const reset = (token, newPassword) => post('/api/auth/reset-password', { token, new_password: newPassword });
  const login = (mail, password) => post('/api/auth/login', { email: mail, password });
  const register = async (name, mail) => {
    const r = await post('/api/auth/register', { name, email: mail, password: 'Password1', role: 'volunteer' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.user.id;
  };
  // El email sale después de la respuesta: se espera a que llegue (o se comprueba que no llega).
  const waitForEmails = async (n, ms = 2000) => {
    const end = Date.now() + ms;
    while (sent.length < n && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    return sent;
  };
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const linkToken = (msg) => {
    const m = /\/restablecer\?token=([A-Za-z0-9_-]+)/.exec(msg.html);
    assert.ok(m, 'el email trae el link a /restablecer');
    return m[1];
  };
  const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const tokensOf = (userId) => db.all('SELECT token_hash, expires_at FROM password_reset_tokens WHERE user_id=$1', [userId]);
  const INVALID = 'El link no es válido o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';
  const SENT = { sent: true };

  describe('POST /api/auth/forgot-password', () => {
    test('con una cuenta: responde, manda el link a /restablecer y guarda solo el hash del código, por 1 hora', async () => {
      const id = await register('Olvido Uno', 'olvido-uno@example.com');
      const r = await forgot('olvido-uno@example.com');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, SENT);
      const [msg] = await waitForEmails(1);
      assert.equal(msg.to, 'olvido-uno@example.com');
      assert.match(msg.subject, /contraseña/i);
      assert.match(msg.html, /http:\/\/localhost:5173\/restablecer\?token=/);
      assert.match(msg.html, /1 hora/);
      const token = linkToken(msg);
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      const rows = await tokensOf(id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].token_hash, hash(token));
      const ttl = Date.parse(rows[0].expires_at) - Date.now();
      assert.ok(ttl > 59 * 60 * 1000 && ttl <= 60 * 60 * 1000, `vence en 1 hora (quedan ${ttl} ms)`);
      const raw = await db.get('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE token_hash=$1', [token]);
      assert.equal(Number(raw.n), 0, 'el código en claro no está en la base');
    });

    test('el email se busca sin distinguir mayúsculas ni espacios', async () => {
      await register('Olvido Dos', 'olvido-dos@example.com');
      assert.deepEqual((await forgot('  Olvido-DOS@Example.com ')).body, SENT);
      const [msg] = await waitForEmails(1);
      assert.equal(msg.to, 'olvido-dos@example.com');
    });

    test('sin cuenta: la misma respuesta, sin email y sin nada guardado', async () => {
      const before_ = await db.get('SELECT COUNT(*) AS n FROM password_reset_tokens');
      const r = await forgot('nadie-tiene-esta@example.com');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, SENT);
      await settle();
      assert.equal(sent.length, 0);
      const after_ = await db.get('SELECT COUNT(*) AS n FROM password_reset_tokens');
      assert.equal(Number(after_.n), Number(before_.n));
    });

    test('email inválido o que no es texto: 400, sin buscar nada', async () => {
      for (const bad of ['no-es-un-email', '', 42, null, ['a@b.com'], 'x'.repeat(250) + '@example.com']) {
        const r = await forgot(bad);
        assert.equal(r.status, 400, `email ${JSON.stringify(bad).slice(0, 30)}`);
        assert.equal(r.body.error, 'Email inválido');
      }
      await settle();
      assert.equal(sent.length, 0);
    });

    test('sin Resend configurado: 503 para todos (con y sin cuenta), sin email y sin código', async () => {
      const id = await register('Olvido Tres', 'olvido-tres@example.com');
      delete process.env.RESEND_API_KEY;
      for (const mail of ['olvido-tres@example.com', 'tampoco-existe@example.com']) {
        const r = await forgot(mail);
        assert.equal(r.status, 503, mail);
        assert.match(r.body.error, /no podemos mandar emails/i);
      }
      await settle();
      assert.equal(sent.length, 0);
      assert.equal((await tokensOf(id)).length, 0);
    });

    test('si el email falla: la respuesta es la misma y el código se descarta', async () => {
      const id = await register('Olvido Cuatro', 'olvido-cuatro@example.com');
      sendResult = { ok: false, error: 'resend_500' };
      assert.deepEqual((await forgot('olvido-cuatro@example.com')).body, SENT);
      await waitForEmails(1);
      await settle();
      assert.equal((await tokensOf(id)).length, 0);
    });

    test('un pedido nuevo invalida el anterior', async () => {
      await register('Olvido Cinco', 'olvido-cinco@example.com');
      await forgot('olvido-cinco@example.com');
      const first = linkToken((await waitForEmails(1))[0]);
      await forgot('olvido-cinco@example.com');
      const second = linkToken((await waitForEmails(2))[1]);
      assert.notEqual(first, second);
      assert.deepEqual(await reset(first, 'NuevaClave5'), { status: 400, body: { error: INVALID } });
      assert.equal((await reset(second, 'NuevaClave5')).status, 200);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const linkFor = async (mail) => {
      const n = sent.length;
      await forgot(mail);
      return linkToken((await waitForEmails(n + 1))[n]);
    };

    test('con el link: cambia la contraseña, entra con la nueva y no con la vieja, y el link no sirve más', async () => {
      const id = await register('Reset Uno', 'reset-uno@example.com');
      const token = await linkFor('reset-uno@example.com');
      const r = await reset(token, 'NuevaClave1');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body, { message: 'Contraseña actualizada' });
      assert.equal((await login('reset-uno@example.com', 'NuevaClave1')).status, 200);
      assert.equal((await login('reset-uno@example.com', 'Password1')).status, 401);
      assert.equal((await tokensOf(id)).length, 0);
      assert.deepEqual(await reset(token, 'OtraClave2'), { status: 400, body: { error: INVALID } });
      assert.equal((await login('reset-uno@example.com', 'NuevaClave1')).status, 200);
    });

    test('la contraseña nueva cumple las reglas del registro; si no, 400 y el link sigue sirviendo', async () => {
      const id = await register('Reset Dos', 'reset-dos@example.com');
      const token = await linkFor('reset-dos@example.com');
      const casos = [
        ['corta1A', 'Mínimo 8 caracteres'],
        ['sinmayuscula1', 'Necesita al menos una mayúscula'],
        ['SinNumeroAca', 'Necesita al menos un número'],
        ['A1' + 'ñ'.repeat(36), 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)'],
      ];
      for (const [pass, msg] of casos) assert.deepEqual(await reset(token, pass), { status: 400, body: { error: msg } }, pass);
      assert.equal((await tokensOf(id)).length, 1, 'el código no se gastó');
      assert.equal((await login('reset-dos@example.com', 'Password1')).status, 200, 'la contraseña no cambió');
      assert.equal((await reset(token, 'NuevaClave2')).status, 200);
    });

    test('link vencido: 400, se descarta y la contraseña no cambia', async () => {
      const id = await register('Reset Tres', 'reset-tres@example.com');
      const token = await linkFor('reset-tres@example.com');
      await db.run('UPDATE password_reset_tokens SET expires_at=$1 WHERE user_id=$2', [new Date(Date.now() - 1000).toISOString(), id]);
      assert.deepEqual(await reset(token, 'NuevaClave3'),
        { status: 400, body: { error: 'El link venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".' } });
      assert.equal((await tokensOf(id)).length, 0);
      assert.equal((await login('reset-tres@example.com', 'Password1')).status, 200);
    });

    test('código con otra forma, inexistente o que no es texto: 400 sin tocar nada', async () => {
      for (const bad of ['corto', 'x'.repeat(43), 'a'.repeat(42) + '!', 123, null, undefined]) {
        assert.deepEqual(await reset(bad, 'NuevaClave4'), { status: 400, body: { error: INVALID } }, String(bad));
      }
      const r = await post('/api/auth/reset-password', { token: 'a'.repeat(43), new_password: 12345678 });
      assert.equal(r.status, 400);
    });

    test('cinco pedidos a la vez con el mismo link: la contraseña cambia una sola vez', async () => {
      await register('Reset Cuatro', 'reset-cuatro@example.com');
      const token = await linkFor('reset-cuatro@example.com');
      const claves = ['Paralela1', 'Paralela2', 'Paralela3', 'Paralela4', 'Paralela5'];
      const results = await Promise.all(claves.map((c) => reset(token, c)));
      const ok = results.map((r, i) => [r.status, claves[i]]).filter(([s]) => s === 200);
      assert.equal(ok.length, 1, JSON.stringify(results.map((r) => r.status)));
      for (const r of results) if (r.status !== 200) assert.deepEqual(r.body, { error: INVALID });
      assert.equal((await login('reset-cuatro@example.com', ok[0][1])).status, 200);
    });

    // Dos pedidos a la vez pueden dejar dos códigos del mismo usuario (en Postgres, los dos DELETE previos no ven el
    // INSERT del otro). Al usar uno, el otro tiene que dejar de servir.
    test('al usar un link se descartan los demás códigos del mismo usuario', async () => {
      const id = await register('Reset Seis', 'reset-seis@example.com');
      const token = await linkFor('reset-seis@example.com');
      const otro = crypto.randomBytes(32).toString('base64url');
      await db.run('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
        [hash(otro), id, new Date(Date.now() + 60 * 60 * 1000).toISOString()]);
      assert.equal((await reset(token, 'NuevaClave6')).status, 200);
      assert.equal((await tokensOf(id)).length, 0);
      assert.deepEqual(await reset(otro, 'OtraClave7'), { status: 400, body: { error: INVALID } });
      assert.equal((await login('reset-seis@example.com', 'NuevaClave6')).status, 200);
    });

    test('no hace falta sesión, y no inicia una: la respuesta no trae token', async () => {
      await register('Reset Cinco', 'reset-cinco@example.com');
      const token = await linkFor('reset-cinco@example.com');
      const r = await reset(token, 'NuevaClave5');
      assert.equal(r.status, 200);
      assert.equal(r.body.token, undefined);
    });
  });
});
