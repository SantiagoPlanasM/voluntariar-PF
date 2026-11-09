// test/integration/auth-google.test.js
//
// Iniciar sesión con Google (§314; decisiones del usuario del 9/11):
//   POST /api/auth/google           { credential } → { token, user } si la cuenta existe (por google_sub, o por mail
//                                     verificado: se vincula sola), o { needs_registration, profile } si no.
//   POST /api/auth/google/register  { credential, role, name, apellido? } → 201 { token, user }: crea la cuenta con
//                                     el rol elegido en la pantalla de rol. Sin contraseña usable.
// Lo simulado: googleAuth.verifyCredential (la verificación real la prueba test/unit/googleAuth.test.js).
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Login con Google', () => {
  let server, baseUrl, db, googleAuth;
  let verified, credentials, saved;

  before(async () => {
    saved = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    googleAuth = require('../../src/lib/googleAuth');
    mock.method(googleAuth, 'verifyCredential', async (credential) => {
      credentials.push(credential);
      if (typeof verified === 'function') return verified(credential);
      return verified;
    });
  });
  after(async () => {
    mock.restoreAll();
    if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = saved;
    if (server) await server.close();
  });
  let seq = 0;
  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    credentials = [];
    seq += 1;
    verified = { sub: `sub-${seq}`, email: `nueva${seq}@gmail.com`, emailVerified: true, name: 'Lucía Gómez', givenName: 'Lucía', familyName: 'Gómez' };
    await db.run(`UPDATE users SET google_sub=NULL WHERE email='maria@example.com'`);
  });

  const post = (path, body) => fetch(`${baseUrl}/api/auth${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const me = (token) => fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const userByEmail = (email) => db.get('SELECT id, role, google_sub, password FROM users WHERE email=$1', [email]);
  const USER_KEYS = ['avatar', 'email', 'id', 'name', 'role'];

  describe('POST /api/auth/google', () => {
    test('mail verificado de una cuenta que ya existe → entra a ESA cuenta y la vincula', async () => {
      verified = { ...verified, sub: 'sub-maria', email: 'maria@example.com' };
      const r = await post('/google', { credential: 'cred-1' });
      assert.equal(r.status, 200);
      assert.deepEqual(credentials, ['cred-1']);
      assert.deepEqual(Object.keys(r.body.user).sort(), USER_KEYS, 'misma forma que /login');
      assert.equal(r.body.user.email, 'maria@example.com');
      assert.equal((await me(r.body.token)).user.email, 'maria@example.com', 'el token sirve');
      assert.equal((await userByEmail('maria@example.com')).google_sub, 'sub-maria');
    });

    test('ya vinculada: entra por google_sub aunque el mail de Google haya cambiado', async () => {
      await db.run(`UPDATE users SET google_sub='sub-maria' WHERE email='maria@example.com'`);
      verified = { ...verified, sub: 'sub-maria', email: 'otro-mail@gmail.com' };
      const r = await post('/google', { credential: 'c' });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.email, 'maria@example.com');
    });

    test('el mail ya está vinculado a OTRA cuenta de Google → 409 y no cambia la vinculación', async () => {
      await db.run(`UPDATE users SET google_sub='sub-original' WHERE email='maria@example.com'`);
      verified = { ...verified, sub: 'sub-otra', email: 'maria@example.com' };
      const r = await post('/google', { credential: 'c' });
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'Esa cuenta ya está vinculada a otra cuenta de Google');
      assert.equal((await userByEmail('maria@example.com')).google_sub, 'sub-original');
    });

    test('dos entradas a la vez con la misma cuenta de Google (regla 21) → las dos entran', async () => {
      verified = { ...verified, sub: 'sub-maria', email: 'maria@example.com' };
      const rs = await Promise.all([post('/google', { credential: 'a' }), post('/google', { credential: 'b' })]);
      assert.deepEqual(rs.map((r) => r.status), [200, 200]);
      assert.equal((await userByEmail('maria@example.com')).google_sub, 'sub-maria');
    });

    // La carrera exacta, determinística: entre el SELECT por mail y el UPDATE, otro pedido con la MISMA cuenta de
    // Google la vincula. El compare-and-swap no cambia nada, se relee y, como es la misma cuenta, entra (no es un 409).
    test('si otro pedido con la misma cuenta de Google la vinculó justo antes del UPDATE → entra igual', async () => {
      verified = { ...verified, sub: 'sub-maria', email: 'maria@example.com' };
      const realRun = db.run;
      const spy = mock.method(db, 'run', async (sql, params) => {
        if (/SET google_sub=\$1 WHERE id=\$2 AND google_sub IS NULL/.test(sql)) {
          await realRun(`UPDATE users SET google_sub='sub-maria' WHERE email='maria@example.com'`);
        }
        return realRun(sql, params);
      });
      let r;
      try { r = await post('/google', { credential: 'c' }); } finally { spy.mock.restore(); }
      assert.equal(r.status, 200);
      assert.equal(r.body.user.email, 'maria@example.com');
    });

    test('sin cuenta → needs_registration con el mail y el nombre de Google, sin crear nada', async () => {
      const before = Number((await db.get('SELECT COUNT(*) AS n FROM users')).n);
      const r = await post('/google', { credential: 'c' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, {
        needs_registration: true,
        profile: { email: verified.email, name: 'Lucía Gómez', given_name: 'Lucía', family_name: 'Gómez' },
      });
      assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM users')).n), before);
    });

    test('mail no verificado por Google → 403 sin vincular (aunque la cuenta exista)', async () => {
      verified = { ...verified, email: 'maria@example.com', emailVerified: false };
      const r = await post('/google', { credential: 'c' });
      assert.equal(r.status, 403);
      assert.equal(r.body.error, 'Tu mail de Google no está verificado');
      assert.equal((await userByEmail('maria@example.com')).google_sub, null);
    });

    test('token que Google no valida → 401', async () => {
      verified = () => { throw new googleAuth.GoogleAuthError('firma inválida', 'invalid'); };
      const r = await post('/google', { credential: 'c' });
      assert.equal(r.status, 401);
      assert.equal(r.body.error, 'No pudimos verificar tu cuenta de Google. Probá de nuevo.');
    });

    test('sin GOOGLE_CLIENT_ID → 503 sin verificar', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const r = await post('/google', { credential: 'c' });
      assert.equal(r.status, 503);
      assert.equal(r.body.error, 'El inicio de sesión con Google no está disponible');
      assert.deepEqual(credentials, []);
    });

    test('pasado el tope por IP → 429 con Retry-After, sin verificar', async () => {
      const { googleLimiter } = require('../../src/routes/authGoogle');
      const ip = '::ffff:127.0.0.1';
      try {
        for (let i = 0; i < 60; i++) googleLimiter.hit(ip);
        googleLimiter.hit('127.0.0.1');
        for (let i = 0; i < 60; i++) googleLimiter.hit('::1');
        const r = await fetch(`${baseUrl}/api/auth/google`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'c' }),
        });
        assert.equal(r.status, 429);
        assert.ok(Number(r.headers.get('retry-after')) > 0);
        assert.deepEqual(credentials, []);
      } finally {
        for (const k of [ip, '127.0.0.1', '::1']) googleLimiter.reset(k);
      }
    });

    test('falla inesperada al verificar → 500 con mensaje genérico', async () => {
      verified = () => { throw new Error('ECONNRESET'); };
      const lines = [];
      const err = mock.method(console, 'error', (...a) => lines.push(a.join(' ')));
      let r;
      try { r = await post('/google', { credential: 'c' }); } finally { err.mock.restore(); }
      assert.equal(r.status, 500);
      assert.equal(r.body.error, 'Error interno del servidor');
    });
  });

  describe('POST /api/auth/google/register', () => {
    test('voluntario: crea la cuenta vinculada, con su perfil, y entra', async () => {
      const r = await post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía', apellido: 'Gómez' });
      assert.equal(r.status, 201);
      assert.deepEqual(Object.keys(r.body.user).sort(), USER_KEYS);
      assert.equal(r.body.user.role, 'volunteer');
      assert.equal(r.body.user.email, verified.email);
      const u = await userByEmail(verified.email);
      assert.equal(u.google_sub, verified.sub);
      const v = await db.get('SELECT nombre, apellido FROM voluntarios WHERE user_id=$1', [u.id]);
      assert.deepEqual({ ...v }, { nombre: 'Lucía', apellido: 'Gómez' });
      assert.equal((await me(r.body.token)).user.id, u.id);
    });

    test('ONG y empresa: crean su perfil con el nombre elegido', async () => {
      const ngo = await post('/google/register', { credential: 'c', role: 'ngo', name: 'Manos Unidas' });
      assert.equal(ngo.status, 201);
      assert.equal((await db.get('SELECT nombre FROM ngos WHERE user_id=$1', [ngo.body.user.id])).nombre, 'Manos Unidas');
      seq += 1;
      verified = { ...verified, sub: `sub-x${seq}`, email: `empresa${seq}@gmail.com` };
      const co = await post('/google/register', { credential: 'c', role: 'company', name: 'Acme' });
      assert.equal(co.status, 201);
      assert.equal((await db.get('SELECT nombre FROM empresas WHERE user_id=$1', [co.body.user.id])).nombre, 'Acme');
    });

    test('la cuenta no tiene una contraseña usable: entrar con contraseña falla', async () => {
      await post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' });
      const u = await userByEmail(verified.email);
      assert.ok(u.password && u.password.startsWith('$2'), 'un hash de bcrypt, para que la columna NOT NULL siga valiendo');
      for (const password of ['', 'Password1', u.password]) {
        const r = await post('/login', { email: verified.email, password });
        assert.notEqual(r.status, 200, password);
      }
    });

    test('rol, nombre o apellido inválidos → 400 sin crear nada', async () => {
      for (const body of [
        { role: 'admin', name: 'Lucía' },
        { role: 'volunteer', name: 'L' },
        { role: 'volunteer', name: 'Lucía123' },
        { role: 'volunteer', name: 'Lucía', apellido: 'G0mez' },
        { role: 'volunteer' },
      ]) {
        const r = await post('/google/register', { credential: 'c', ...body });
        assert.equal(r.status, 400, JSON.stringify(body));
      }
      assert.equal(await userByEmail(verified.email), undefined);
    });

    test('el mail ya tiene cuenta → 409 (hay que entrar con /google, que la vincula)', async () => {
      verified = { ...verified, email: 'maria@example.com' };
      const r = await post('/google/register', { credential: 'c', role: 'volunteer', name: 'María' });
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'Ya existe una cuenta con ese email');
    });

    test('esa cuenta de Google ya está vinculada a otra cuenta → 409', async () => {
      await db.run(`UPDATE users SET google_sub=$1 WHERE email='maria@example.com'`, [verified.sub]);
      const r = await post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' });
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'Esa cuenta ya está vinculada a otra cuenta de Google');
      assert.equal(await userByEmail(verified.email), undefined);
    });

    test('dos registros a la vez con la misma cuenta de Google → uno 201 y el otro 409', async () => {
      const rs = await Promise.all([
        post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' }),
        post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' }),
      ]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
      assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM users WHERE email=$1', [verified.email])).n), 1);
    });

    test('mail no verificado → 403; token inválido → 401; sin configurar → 503', async () => {
      verified = { ...verified, emailVerified: false };
      assert.equal((await post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' })).status, 403);
      verified = () => { throw new googleAuth.GoogleAuthError('x', 'invalid'); };
      assert.equal((await post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' })).status, 401);
      delete process.env.GOOGLE_CLIENT_ID;
      assert.equal((await post('/google/register', { credential: 'c', role: 'volunteer', name: 'Lucía' })).status, 503);
    });
  });
});
