// test/unit/email.test.js
//
// sendEmail(): modo prueba con EMAIL_REDIRECT_TO, manejo del error de Resend por dominio de pruebas
// y descripción de la configuración para el log de arranque (PROJECT_ANALYSIS.md §42).
//
// `fetch` se reemplaza por un doble: estos tests NO pegan contra la API real de Resend. Lo que
// verifican es que el request se arma como corresponde (a quién, con qué asunto, con qué cuerpo).
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const ENV_KEYS = ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REDIRECT_TO', 'NODE_ENV'];
const REAL_TESTING_DOMAIN_ERROR = JSON.stringify({
  statusCode: 403,
  name: 'validation_error',
  message: 'Testing domain restriction: The resend.dev domain is for testing and can only send to your own email address. '
    + 'To send to other recipients, verify a domain and update the from address to use it.',
});

describe('sendEmail()', () => {
  let saved, calls, errors, warns, fetchImpl;

  // Módulo nuevo en cada test: no comparte el estado de "aviso ya mostrado".
  const freshEmail = () => {
    delete require.cache[require.resolve('../../src/lib/email')];
    return require('../../src/lib/email');
  };

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    calls = []; errors = []; warns = [];
    fetchImpl = async () => ({ ok: true, status: 200, text: async () => '{"id":"x"}' });
    mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers }); return fetchImpl(); });
    mock.method(console, 'error', (...a) => { errors.push(a.join(' ')); });
    mock.method(console, 'warn', (...a) => { warns.push(a.join(' ')); });
  });

  afterEach(() => {
    mock.restoreAll();
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  const msg = { to: 'admin@bancoalimentos.org', subject: 'Nueva solicitud', html: '<p>Hola</p>' };

  test('sin RESEND_API_KEY: se omite, no llama a Resend y no falla', async () => {
    const { sendEmail } = freshEmail();
    const r = await sendEmail(msg);
    assert.deepEqual(r, { ok: false, skipped: true });
    assert.equal(calls.length, 0);
  });

  test('sin modo prueba: se manda al destinatario real, con asunto y cuerpo intactos', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const { sendEmail } = freshEmail();
    const r = await sendEmail(msg);
    assert.deepEqual(r, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.equal(calls[0].headers.Authorization, 'Bearer re_test');
    assert.equal(calls[0].body.to, 'admin@bancoalimentos.org');
    assert.equal(calls[0].body.subject, 'Nueva solicitud');
    assert.equal(calls[0].body.html, '<p>Hola</p>');
    assert.equal(calls[0].body.from, 'VoluntariAR <onboarding@resend.dev>');
  });

  test('EMAIL_FROM se respeta', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'VoluntariAR <no-reply@midominio.com>';
    await freshEmail().sendEmail(msg);
    assert.equal(calls[0].body.from, 'VoluntariAR <no-reply@midominio.com>');
  });

  describe('EMAIL_REDIRECT_TO (modo prueba)', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_REDIRECT_TO = 'yo@mi-casilla.com';
    });

    test('todo va a la casilla de prueba, y el destinatario original queda visible en el asunto', async () => {
      const r = await freshEmail().sendEmail(msg);
      assert.deepEqual(r, { ok: true });
      assert.equal(calls[0].body.to, 'yo@mi-casilla.com', 'NO debe ir al destinatario real');
      assert.equal(calls[0].body.subject, '[para: admin@bancoalimentos.org] Nueva solicitud');
    });

    test('el cuerpo trae un aviso con el destinatario original y conserva el contenido', async () => {
      await freshEmail().sendEmail(msg);
      const { html } = calls[0].body;
      assert.match(html, /admin@bancoalimentos\.org/);
      assert.match(html, /EMAIL_REDIRECT_TO/);
      assert.ok(html.endsWith('<p>Hola</p>'), 'el contenido original va después del aviso, sin alterarse');
    });

    test('un destinatario con HTML malicioso se escapa en el aviso', async () => {
      await freshEmail().sendEmail({ ...msg, to: 'x"><script>alert(1)</script>@evil.com' });
      const { html, subject } = calls[0].body;
      assert.ok(!html.includes('<script>'), 'no debe colarse HTML crudo en el aviso');
      assert.match(html, /&lt;script&gt;/);
      assert.ok(subject.includes('<script>'), 'el asunto es texto plano: no se escapa (no es HTML)');
    });

    test('varios destinatarios: se listan todos, y igual se manda UN solo email a la casilla de prueba', async () => {
      await freshEmail().sendEmail({ ...msg, to: ['a@x.com', 'b@y.com'] });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].body.to, 'yo@mi-casilla.com');
      assert.match(calls[0].body.subject, /\[para: a@x\.com, b@y\.com\]/);
    });

    test('FALLA CERRADO: si EMAIL_REDIRECT_TO está mal escrito NO se manda nada (ni a la casilla ni al real)', async () => {
      process.env.EMAIL_REDIRECT_TO = 'esto-no-es-un-email';
      const r = await freshEmail().sendEmail(msg);
      assert.deepEqual(r, { ok: false, error: 'invalid_redirect' });
      assert.equal(calls.length, 0, 'no debe llamar a Resend');
      assert.ok(errors.some((e) => /EMAIL_REDIRECT_TO/.test(e)), 'debe explicar el problema en el log');
    });

    test('espacios alrededor del valor no lo invalidan', async () => {
      process.env.EMAIL_REDIRECT_TO = '  yo@mi-casilla.com  ';
      await freshEmail().sendEmail(msg);
      assert.equal(calls[0].body.to, 'yo@mi-casilla.com');
    });

    test('vacío = desactivado (típico de una variable declarada sin valor)', async () => {
      process.env.EMAIL_REDIRECT_TO = '';
      await freshEmail().sendEmail(msg);
      assert.equal(calls[0].body.to, 'admin@bancoalimentos.org');
    });
  });

  describe('errores de Resend', () => {
    beforeEach(() => { process.env.RESEND_API_KEY = 're_test'; });

    test('403 por dominio de pruebas: error propio y un mensaje que explica QUÉ HACER', async () => {
      fetchImpl = async () => ({ ok: false, status: 403, text: async () => REAL_TESTING_DOMAIN_ERROR });
      const r = await freshEmail().sendEmail(msg);
      assert.deepEqual(r, { ok: false, error: 'resend_testing_domain' });
      const hint = errors.join('\n');
      assert.match(hint, /EMAIL_REDIRECT_TO/);
      assert.match(hint, /EMAIL_FROM/);
    });

    test('la explicación se muestra UNA vez por proceso, no en cada email', async () => {
      fetchImpl = async () => ({ ok: false, status: 403, text: async () => REAL_TESTING_DOMAIN_ERROR });
      const { sendEmail } = freshEmail();
      for (let i = 0; i < 4; i++) await sendEmail(msg);
      assert.equal(errors.filter((e) => /EMAIL_REDIRECT_TO/.test(e)).length, 1);
      assert.equal(errors.filter((e) => /Resend respondió 403/.test(e)).length, 4, 'cada fallo igual se registra');
    });

    test('también reconoce el texto anterior de Resend ("can only send testing emails to your own email")', async () => {
      const old = JSON.stringify({ statusCode: 403, name: 'validation_error',
        message: 'You can only send testing emails to your own email address (yo@x.com). To send emails to other recipients, please verify a domain at resend.com/domains' });
      fetchImpl = async () => ({ ok: false, status: 403, text: async () => old });
      assert.equal((await freshEmail().sendEmail(msg)).error, 'resend_testing_domain');
    });

    test('con EMAIL_REDIRECT_TO activo pero distinto del email de la cuenta de Resend: el mensaje lo dice (no repite el consejo genérico)', async () => {
      process.env.EMAIL_REDIRECT_TO = 'otro@casilla.com';
      fetchImpl = async () => ({ ok: false, status: 403, text: async () => REAL_TESTING_DOMAIN_ERROR });
      const r = await freshEmail().sendEmail(msg);
      assert.equal(r.error, 'resend_testing_domain');
      const hint = errors.join('\n');
      assert.match(hint, /EXACTAMENTE el email de tu cuenta de Resend/);
      assert.match(hint, /otro@casilla\.com/);
      assert.ok(!/Desarrollo\/demo: definí EMAIL_REDIRECT_TO/.test(hint), 'ya lo tiene definido: no se lo vuelve a sugerir');
    });

    test('un 403 por OTRA causa no se confunde con el dominio de pruebas', async () => {
      fetchImpl = async () => ({ ok: false, status: 403, text: async () => '{"message":"API key is invalid"}' });
      const r = await freshEmail().sendEmail(msg);
      assert.deepEqual(r, { ok: false, error: 'resend_403' });
      assert.ok(!errors.some((e) => /EMAIL_REDIRECT_TO/.test(e)));
    });

    test('un 500 de Resend devuelve resend_500 y no lanza', async () => {
      fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'boom' });
      assert.deepEqual(await freshEmail().sendEmail(msg), { ok: false, error: 'resend_500' });
    });

    test('un error de red no lanza', async () => {
      fetchImpl = async () => { throw new Error('ECONNRESET'); };
      assert.deepEqual(await freshEmail().sendEmail(msg), { ok: false, error: 'ECONNRESET' });
    });

    test('faltan campos obligatorios', async () => {
      assert.deepEqual(await freshEmail().sendEmail({ to: 'a@b.com', subject: 's' }), { ok: false, error: 'missing_fields' });
      assert.equal(calls.length, 0);
    });
  });

  describe('describeEmailConfig() (línea del log de arranque)', () => {
    test('sin API key', () => {
      assert.match(freshEmail().describeEmailConfig(), /desactivado.*RESEND_API_KEY/);
    });

    test('con el remitente de pruebas avisa la limitación', () => {
      process.env.RESEND_API_KEY = 're_test';
      const d = freshEmail().describeEmailConfig();
      assert.match(d, /onboarding@resend\.dev/);
      assert.match(d, /solo entrega a tu propio email/i);
    });

    test('con redirección activa dice a dónde va todo', () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_REDIRECT_TO = 'yo@mi-casilla.com';
      assert.match(freshEmail().describeEmailConfig(), /redirig.*yo@mi-casilla\.com/i);
    });

    test('con redirección inválida avisa que NO se envía nada', () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_REDIRECT_TO = 'basura';
      assert.match(freshEmail().describeEmailConfig(), /inválido.*no se envía/i);
    });

    test('con un dominio propio verificado no muestra advertencias de pruebas', () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_FROM = 'VoluntariAR <no-reply@midominio.com>';
      const d = freshEmail().describeEmailConfig();
      assert.match(d, /no-reply@midominio\.com/);
      assert.ok(!/propio email/i.test(d));
    });

    test('redirección activa en producción: advertencia explícita', () => {
      process.env.RESEND_API_KEY = 're_test';
      process.env.EMAIL_REDIRECT_TO = 'yo@mi-casilla.com';
      process.env.NODE_ENV = 'production';
      assert.match(freshEmail().describeEmailConfig(), /producci[oó]n/i);
    });

    test('NUNCA incluye la API key', () => {
      process.env.RESEND_API_KEY = 're_SECRETO_NO_LOGUEAR';
      assert.ok(!freshEmail().describeEmailConfig().includes('SECRETO'));
    });
  });
});
