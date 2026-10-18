// test/unit/tokenCrypto.test.js
//
// lib/tokenCrypto.js: cifrado de los tokens de Mercado Pago de cada ONG (Marketplace, PROJECT_ANALYSIS.md §215).
// AES-256-GCM con la clave MP_TOKEN_KEY (32 bytes en base64) y el ngo_id como dato asociado: un token copiado a la
// fila de otra ONG no se descifra.
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const KEY = crypto.randomBytes(32).toString('base64');
const OTHER_KEY = crypto.randomBytes(32).toString('base64');
const SECRET = 'APP_USR-7777-token-de-la-ong-reconocible';
const fresh = () => {
  delete require.cache[require.resolve('../../src/lib/tokenCrypto')];
  return require('../../src/lib/tokenCrypto');
};

describe('tokenCrypto', () => {
  let saved;
  beforeEach(() => { saved = process.env.MP_TOKEN_KEY; process.env.MP_TOKEN_KEY = KEY; });
  afterEach(() => { if (saved === undefined) delete process.env.MP_TOKEN_KEY; else process.env.MP_TOKEN_KEY = saved; });

  test('ida y vuelta con el mismo ngo_id', () => {
    const { encryptToken, decryptToken } = fresh();
    assert.equal(decryptToken(encryptToken(SECRET, 'ngo-1'), 'ngo-1'), SECRET);
  });

  test('formato v1:<iv>:<tag>:<cifrado> en base64url, sin el token en claro', () => {
    const blob = fresh().encryptToken(SECRET, 'ngo-1');
    assert.match(blob, /^v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/);
    assert.ok(!blob.includes('7777'));
  });

  test('dos cifrados del mismo token son distintos (IV al azar)', () => {
    const { encryptToken } = fresh();
    assert.notEqual(encryptToken(SECRET, 'ngo-1'), encryptToken(SECRET, 'ngo-1'));
  });

  test('con otro ngo_id, otra clave o un byte cambiado no se descifra (TokenCryptoError, sin el token en el mensaje)', () => {
    const { encryptToken, decryptToken, TokenCryptoError } = fresh();
    const blob = encryptToken(SECRET, 'ngo-1');
    const isErr = (e) => e instanceof TokenCryptoError && e.code === 'invalid' && !e.message.includes('7777');
    assert.throws(() => decryptToken(blob, 'ngo-2'), isErr, 'otro ngo_id');
    const [v, iv, tag, ct] = blob.split(':');
    const flip = (s) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    assert.throws(() => decryptToken([v, iv, tag, flip(ct)].join(':'), 'ngo-1'), isErr, 'cifrado cambiado');
    assert.throws(() => decryptToken([v, iv, flip(tag), ct].join(':'), 'ngo-1'), isErr, 'tag cambiado');
    assert.throws(() => decryptToken([v, flip(iv), tag, ct].join(':'), 'ngo-1'), isErr, 'iv cambiado');
    process.env.MP_TOKEN_KEY = OTHER_KEY;
    assert.throws(() => fresh().decryptToken(blob, 'ngo-1'), (e) => e.code === 'invalid', 'otra clave');
  });

  test('blobs mal formados → TokenCryptoError invalid (nunca otro error)', () => {
    const { decryptToken, TokenCryptoError } = fresh();
    for (const b of [undefined, null, 42, '', 'texto', 'v2:a:b:c', 'v1:a:b', 'v1:::', 'v1:AAAA:AAAA:AAAA']) {
      assert.throws(() => decryptToken(b, 'ngo-1'), (e) => e instanceof TokenCryptoError && e.code === 'invalid', String(b));
    }
  });

  test('tag, IV o cifrado recortados → invalid (GCM con tag corto debilita la autenticación)', () => {
    const { encryptToken, decryptToken } = fresh();
    const [v, iv, tag, ct] = encryptToken(SECRET, 'ngo-1').split(':');
    for (const parts of [[v, iv, tag.slice(0, 11), ct], [v, iv.slice(0, 8), tag, ct], [v, iv, tag, ''], [v, iv, '', ct]]) {
      assert.throws(() => decryptToken(parts.join(':'), 'ngo-1'), (e) => e.code === 'invalid', parts.join(':'));
    }
  });

  test('un blob válido con otra versión (v2) → invalid: no se adivina el formato', () => {
    const { encryptToken, decryptToken } = fresh();
    const blob = encryptToken(SECRET, 'ngo-1');
    assert.throws(() => decryptToken(blob.replace(/^v1:/, 'v2:'), 'ngo-1'), (e) => e.code === 'invalid');
  });

  test('cifrar exige un token de texto no vacío y un ngo_id', () => {
    const { encryptToken, TokenCryptoError } = fresh();
    for (const [t, n] of [['', 'ngo-1'], [null, 'ngo-1'], [SECRET, ''], [SECRET, undefined]]) {
      assert.throws(() => encryptToken(t, n), TokenCryptoError);
    }
    const { decryptToken } = fresh();
    assert.throws(() => decryptToken(encryptToken(SECRET, 'ngo-1'), ''), (e) => e.name === 'TokenCryptoError' && e.code === 'bad_input');
  });

  test('isTokenKeyConfigured(): solo con 32 bytes exactos en base64', () => {
    assert.equal(fresh().isTokenKeyConfigured(), true);
    for (const k of ['', '   ', 'corta', crypto.randomBytes(16).toString('base64'), crypto.randomBytes(33).toString('base64')]) {
      process.env.MP_TOKEN_KEY = k;
      assert.equal(fresh().isTokenKeyConfigured(), false, k);
    }
    delete process.env.MP_TOKEN_KEY;
    assert.equal(fresh().isTokenKeyConfigured(), false);
  });

  test('acepta la clave en base64url y con espacios alrededor', () => {
    process.env.MP_TOKEN_KEY = ` ${Buffer.from(KEY, 'base64').toString('base64url')} `;
    const { encryptToken } = fresh();
    const blob = encryptToken(SECRET, 'ngo-1');
    process.env.MP_TOKEN_KEY = KEY;
    assert.equal(fresh().decryptToken(blob, 'ngo-1'), SECRET);
  });

  test('sin clave: cifrar y descifrar lanzan not_configured', () => {
    const blob = fresh().encryptToken(SECRET, 'ngo-1');
    delete process.env.MP_TOKEN_KEY;
    const { encryptToken, decryptToken } = fresh();
    assert.throws(() => encryptToken(SECRET, 'ngo-1'), (e) => e.code === 'not_configured');
    assert.throws(() => decryptToken(blob, 'ngo-1'), (e) => e.code === 'not_configured');
  });
});
