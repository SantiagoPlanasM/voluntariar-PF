// test/unit/googleAuth.test.js
//
// lib/googleAuth.js (§314): verifica el ID token que devuelve el botón "Continuar con Google" con la librería oficial
// (google-auth-library, OAuth2Client.verifyIdToken), que comprueba la firma con las claves públicas de Google, el
// emisor, el vencimiento y que `aud` sea NUESTRO client id. Acá se reemplaza verifyIdToken: no se habla con Google.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = '1234-abc.apps.googleusercontent.com';
const fresh = () => {
  delete require.cache[require.resolve('../../src/lib/googleAuth')];
  return require('../../src/lib/googleAuth');
};
const PAYLOAD = {
  iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '109876543210', email: 'Maria.Perez@Gmail.com',
  email_verified: true, name: 'María Pérez', given_name: 'María', family_name: 'Pérez', picture: 'https://lh3.googleusercontent.com/a/x',
};

describe('googleAuth', () => {
  let saved, calls, payload, fail;
  beforeEach(() => {
    saved = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    calls = []; payload = { ...PAYLOAD }; fail = null;
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async function (opts) {
      calls.push({ opts, clientId: this._clientId });
      if (fail) throw fail;
      return { getPayload: () => payload };
    });
  });
  afterEach(() => {
    mock.restoreAll();
    if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = saved;
  });

  test('isConfigured(): true con GOOGLE_CLIENT_ID; false sin él o con espacios', () => {
    assert.equal(fresh().isConfigured(), true);
    process.env.GOOGLE_CLIENT_ID = '   ';
    assert.equal(fresh().isConfigured(), false);
    delete process.env.GOOGLE_CLIENT_ID;
    assert.equal(fresh().isConfigured(), false);
  });

  test('verifica con NUESTRO client id como audiencia y devuelve los datos normalizados (mail en minúsculas)', async () => {
    const r = await fresh().verifyCredential('eyJ.token.firma');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.idToken, 'eyJ.token.firma');
    assert.equal(calls[0].opts.audience, CLIENT_ID);
    assert.deepEqual(r, {
      sub: '109876543210', email: 'maria.perez@gmail.com', emailVerified: true,
      name: 'María Pérez', givenName: 'María', familyName: 'Pérez',
    });
  });

  test('email_verified que no es exactamente true → emailVerified false', async () => {
    for (const v of [false, 'true', undefined, 1]) {
      payload = { ...PAYLOAD, email_verified: v };
      assert.equal((await fresh().verifyCredential('t')).emailVerified, false, String(v));
    }
  });

  test('campos de nombre ausentes → null', async () => {
    payload = { sub: '1', email: 'a@b.com', email_verified: true };
    const r = await fresh().verifyCredential('t');
    assert.equal(r.name, null);
    assert.equal(r.givenName, null);
    assert.equal(r.familyName, null);
  });

  test('si la librería rechaza el token (firma, vencido, otra audiencia) → GoogleAuthError invalid', async () => {
    const { verifyCredential, GoogleAuthError } = fresh();
    fail = new Error('Wrong recipient, payload audience != requiredAudience');
    await assert.rejects(verifyCredential('t'), (e) => e instanceof GoogleAuthError && e.code === 'invalid');
  });

  test('un payload sin sub o sin mail → invalid', async () => {
    const { verifyCredential, GoogleAuthError } = fresh();
    for (const p of [null, { email: 'a@b.com' }, { sub: '1' }, { sub: '1', email: 7 }]) {
      payload = p;
      await assert.rejects(verifyCredential('t'), (e) => e instanceof GoogleAuthError && e.code === 'invalid', JSON.stringify(p));
    }
  });

  test('credencial vacía, que no es texto o de más de 4096 caracteres → invalid sin llamar a la librería', async () => {
    const { verifyCredential, GoogleAuthError } = fresh();
    for (const c of ['', '   ', undefined, null, 42, {}, 'a'.repeat(4097)]) {
      await assert.rejects(verifyCredential(c), (e) => e instanceof GoogleAuthError && e.code === 'invalid', String(c).slice(0, 10));
    }
    assert.equal(calls.length, 0);
  });

  test('sin GOOGLE_CLIENT_ID → GoogleAuthError not_configured sin llamar a la librería', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const { verifyCredential, GoogleAuthError } = fresh();
    await assert.rejects(verifyCredential('t'), (e) => e instanceof GoogleAuthError && e.code === 'not_configured');
    assert.equal(calls.length, 0);
  });
});
