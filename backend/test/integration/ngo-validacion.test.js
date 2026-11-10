// test/integration/ngo-validacion.test.js
//
// Validación de ONG (§317; DESIGN.md "Validación de ONGs"; decisiones del usuario del 10/11):
//   ONG dueña:  GET  /api/ngos/me/validacion                     → estado (none | pending | approved | rejected)
//               POST /api/ngos/me/validacion  (multipart)        → cuit, legal_type, statute (PDF), registration (PDF)
//               GET  /api/ngos/me/validacion/documento/:tipo     → link firmado (statute | registration)
//   Admin (ADMIN_EMAILS): GET /api/admin/validaciones, GET /:id/documento/:tipo, POST /:id/aprobar, POST /:id/rechazar
//   Efecto de "aprobada": solo la insignia (`verified` en la ONG, `ngo_verified` en sus voluntariados).
// Los PDF van PRIVADOS a Cloudinary (como el CV, regla 24): acá storage.* se reemplaza; nunca se sube nada.
const { test, describe, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

const PDF = Buffer.from('%PDF-1.4\n% prueba\n');

describe('Validación de ONG', () => {
  let server, baseUrl, db, storage, email;
  let ngo, ngo2, admin, vol, company;
  let uploads, deleted, uploadImpl, mails, savedAdmins, configured, cuitOk;

  const login = async (mail) => {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: 'Password1' }),
    });
    const b = await r.json();
    return { token: b.token, id: b.user.id };
  };
  const call = (who, path, { method = 'GET', body, form } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const formOf = ({ cuit = cuitOk, legal_type = 'civil_association', statute = PDF, registration = PDF } = {}) => {
    const f = new FormData();
    if (cuit !== null) f.append('cuit', cuit);
    if (legal_type !== null) f.append('legal_type', legal_type);
    if (statute) f.append('statute', new Blob([statute], { type: 'application/pdf' }), 'estatuto.pdf');
    if (registration) f.append('registration', new Blob([registration], { type: 'application/pdf' }), 'constancia.pdf');
    return f;
  };
  const submit = (who = ngo, opts) => call(who, '/api/ngos/me/validacion', { method: 'POST', form: formOf(opts) });
  const ngoId = async (who = ngo) => (await db.get('SELECT id FROM ngos WHERE user_id=$1', [who.id])).id;
  const rowOf = async (who = ngo) => db.get('SELECT * FROM ngo_validaciones WHERE ngo_id=$1', [await ngoId(who)]);

  before(async () => {
    savedAdmins = process.env.ADMIN_EMAILS;
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
    db = require('../../src/db');
    storage = require('../../src/lib/storage');
    email = require('../../src/lib/email');
    // CUIT válido calculado acá (dígito verificador de AFIP), para no depender de uno escrito a mano.
    const base = '3071234567';
    const sum = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((s, w, i) => s + w * Number(base[i]), 0);
    const dv = (11 - (sum % 11)) % 11;
    cuitOk = dv === 10 ? '20-12345678-6' : `${base.slice(0, 2)}-${base.slice(2)}-${dv}`;
    mock.method(storage, 'isConfigured', () => configured);
    mock.method(storage, 'uploadPdf', async (buf) => uploadImpl(buf));
    mock.method(storage, 'deletePdf', async (id) => { deleted.push(id); return true; });
    mock.method(storage, 'pdfDownloadUrl', (id) => ({ url: `https://firmado.example/${id}`, expiresAt: '2030-01-01T00:00:00.000Z' }));
    mock.method(email, 'sendEmail', async (m) => { mails.push(m); return { sent: true }; });
    ngo = await login('admin@sustentando.org');
    ngo2 = await login('admin@greencba.org');
    vol = await login('maria@example.com');
    admin = await login('juan@example.com');
    company = await login('admin@techcorp.com');
  });
  after(async () => {
    mock.restoreAll();
    if (savedAdmins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = savedAdmins;
    if (server) await server.close();
  });
  let seq = 0;
  beforeEach(async () => {
    process.env.ADMIN_EMAILS = ' Juan@Example.com , otro@admin.org ';
    configured = true; uploads = []; deleted = []; mails = [];
    uploadImpl = async () => { seq += 1; uploads.push(seq); return { publicId: `pdf-${seq}` }; };
    await db.run('DELETE FROM ngo_validaciones');
    // El tope de envíos por ONG (10 por hora) se gastaría entre tests.
    const { submitLimiter } = require('../../src/routes/ngoValidacion');
    for (const who of [ngo, ngo2, vol, admin, company]) if (who) submitLimiter.reset(who.id);
    await db.run(`DELETE FROM notifications WHERE type LIKE 'ngo_validation%'`);
  });

  describe('la ONG carga la validación', () => {
    test('sin pedido: status none', async () => {
      const r = await call(ngo, '/api/ngos/me/validacion');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { validation: { status: 'none' } });
    });

    test('carga completa → 201 en revisión; sube los dos PDF privados y no expone sus ids', async () => {
      const r = await submit();
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.validation.status, 'pending');
      assert.equal(r.body.validation.cuit, cuitOk);
      assert.equal(r.body.validation.legal_type, 'civil_association');
      assert.equal(typeof r.body.validation.submitted_at, 'string');
      assert.equal(uploads.length, 2);
      assert.ok(!JSON.stringify(r.body).includes('pdf-'), 'los public_id no salen');
      const row = await rowOf();
      assert.equal(row.estado, 'en_revision');
      assert.equal(row.personeria, 'asociacion_civil');
      assert.deepEqual([row.estatuto_id, row.constancia_id].sort(), ['pdf-' + uploads[0], 'pdf-' + uploads[1]].sort());
      const g = await call(ngo, '/api/ngos/me/validacion');
      assert.equal(g.body.validation.status, 'pending');
    });

    const bad = [
      [{ cuit: '30-71234567-0' }, 'El CUIT no es válido: son 11 números con el dígito verificador correcto'],
      [{ cuit: null }, 'El CUIT no es válido: son 11 números con el dígito verificador correcto'],
      [{ legal_type: 'sociedad_anonima' }, 'Elegí el tipo de personería'],
      [{ legal_type: null }, 'Elegí el tipo de personería'],
      [{ statute: null }, 'Falta el estatuto (PDF)'],
      [{ registration: null }, 'Falta la constancia de inscripción (PDF)'],
      [{ statute: Buffer.from('no soy un pdf') }, 'El estatuto no es un PDF válido'],
      [{ registration: Buffer.from('GIF89a') }, 'La constancia de inscripción no es un PDF válido'],
    ];
    for (const [opts, msg] of bad) {
      test(`400 sin subir nada: ${msg}`, async () => {
        const r = await submit(ngo, opts);
        assert.equal(r.status, 400);
        assert.equal(r.body.error, msg);
        assert.equal(uploads.length, 0);
        assert.equal(await rowOf(), undefined);
      });
    }

    test('el CUIT se acepta sin guiones y se guarda normalizado', async () => {
      const r = await submit(ngo, { cuit: cuitOk.replace(/-/g, '') });
      assert.equal(r.status, 201);
      assert.equal(r.body.validation.cuit, cuitOk);
    });

    test('ya en revisión o aprobada → 409 sin subir nada', async () => {
      assert.equal((await submit()).status, 201);
      uploads = [];
      const r = await submit();
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'La validación ya está en revisión');
      await db.run(`UPDATE ngo_validaciones SET estado='aprobada'`);
      const r2 = await submit();
      assert.equal(r2.status, 409);
      assert.equal(r2.body.error, 'Tu ONG ya está validada');
      assert.equal(uploads.length, 0);
    });

    test('si falla la segunda subida → 502 y se borra la primera (no quedan huérfanos)', async () => {
      let n = 0;
      uploadImpl = async () => { n += 1; if (n === 2) throw new Error('Cloudinary caído'); return { publicId: 'pdf-primero' }; };
      const r = await submit();
      assert.equal(r.status, 502);
      assert.equal(r.body.error, 'No pudimos subir los documentos. Probá de nuevo en un momento.');
      assert.deepEqual(deleted, ['pdf-primero']);
      assert.equal(await rowOf(), undefined);
    });

    test('sin Cloudinary → 503 sin leer nada', async () => {
      configured = false;
      const r = await submit();
      assert.equal(r.status, 503);
      assert.equal(uploads.length, 0);
    });

    test('un PDF de más de 5 MB → 413', async () => {
      const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
      const r = await submit(ngo, { statute: big });
      assert.equal(r.status, 413);
      assert.equal(uploads.length, 0);
    });

    test('voluntario o sin sesión → 403/401', async () => {
      assert.equal((await submit(vol)).status, 403);
      assert.equal((await call(vol, '/api/ngos/me/validacion')).status, 403);
      assert.equal((await call(null, '/api/ngos/me/validacion')).status, 401);
      assert.equal((await submit(company)).status, 403);
      assert.equal(uploads.length, 0);
    });

    test('la ONG ve sus documentos con un link firmado; tipo desconocido o sin pedido → 404', async () => {
      assert.equal((await call(ngo, '/api/ngos/me/validacion/documento/statute')).status, 404);
      await submit();
      const row = await rowOf();
      const a = await call(ngo, '/api/ngos/me/validacion/documento/statute');
      assert.equal(a.status, 200);
      assert.equal(a.body.url, `https://firmado.example/${row.estatuto_id}`);
      const b = await call(ngo, '/api/ngos/me/validacion/documento/registration');
      assert.equal(b.body.url, `https://firmado.example/${row.constancia_id}`);
      assert.equal((await call(ngo, '/api/ngos/me/validacion/documento/otro')).status, 404);
    });
  });

  describe('el admin revisa', () => {
    const list = (who = admin) => call(who, '/api/admin/validaciones');

    test('solo los mails de ADMIN_EMAILS (sin importar mayúsculas ni espacios); el resto 403, sin sesión 401', async () => {
      await submit();
      const id = (await rowOf()).id;
      for (const who of [ngo, vol]) {
        assert.equal((await list(who)).status, 403);
        assert.equal((await call(who, `/api/admin/validaciones/${id}/aprobar`, { method: 'POST' })).status, 403);
        assert.equal((await call(who, `/api/admin/validaciones/${id}/documento/statute`)).status, 403);
      }
      assert.equal((await list(null)).status, 401);
      assert.equal((await list()).status, 200);
      process.env.ADMIN_EMAILS = '';
      assert.equal((await list()).status, 403, 'sin ADMIN_EMAILS no hay admins');
      assert.equal((await rowOf()).estado, 'en_revision');
    });

    test('/auth/me dice si el usuario es admin', async () => {
      assert.equal((await call(admin, '/api/auth/me')).body.is_admin, true);
      assert.equal((await call(vol, '/api/auth/me')).body.is_admin, false);
    });

    test('lista las pendientes con la ONG, el CUIT y la personería, sin los ids de los archivos', async () => {
      await submit();
      await submit(ngo2, { legal_type: 'foundation' });
      const r = await list();
      assert.equal(r.status, 200);
      assert.equal(r.body.validations.length, 2);
      const mine = r.body.validations.find((v) => v.ngo_id === 'ngo-1');
      assert.ok(mine, JSON.stringify(r.body));
      assert.deepEqual(Object.keys(mine).sort(), ['cuit', 'id', 'legal_type', 'ngo_id', 'ngo_name', 'reason', 'reviewed_at', 'status', 'submitted_at']);
      assert.ok(!JSON.stringify(r.body).includes('pdf-'));
      await db.run(`UPDATE ngo_validaciones SET estado='aprobada' WHERE ngo_id=$1`, [await ngoId(ngo2)]);
      assert.equal((await list()).body.validations.length, 1, 'por defecto, solo las pendientes');
      assert.equal((await call(admin, '/api/admin/validaciones?status=all')).body.validations.length, 2);
    });

    test('el admin abre los PDF con un link firmado', async () => {
      await submit();
      const row = await rowOf();
      const r = await call(admin, `/api/admin/validaciones/${row.id}/documento/registration`);
      assert.equal(r.status, 200);
      assert.equal(r.body.url, `https://firmado.example/${row.constancia_id}`);
      assert.equal((await call(admin, '/api/admin/validaciones/no-existe/documento/statute')).status, 404);
    });

    test('aprobar → validada, insignia en la ONG y en sus voluntariados, notificación y mail', async () => {
      await submit();
      const id = (await rowOf()).id;
      const before = await call(null, `/api/ngos/${await ngoId()}`);
      assert.equal(before.body.ngo.verified, false);
      const r = await call(admin, `/api/admin/validaciones/${id}/aprobar`, { method: 'POST' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.validation.status, 'approved');
      const row = await rowOf();
      assert.equal(row.estado, 'aprobada');
      assert.equal(row.revisado_por, admin.id);
      assert.equal((await call(ngo, '/api/ngos/me/validacion')).body.validation.status, 'approved');
      assert.equal((await call(null, `/api/ngos/${await ngoId()}`)).body.ngo.verified, true);
      const p = await call(null, '/api/projects/proj-1');
      assert.equal(p.body.project.ngo_verified, true);
      const n = await db.get(`SELECT title FROM notifications WHERE user_id=$1 AND type='ngo_validation_approved'`, [ngo.id]);
      assert.ok(n, 'avisó por notificación');
      assert.equal(mails.length, 1);
      assert.equal(mails[0].to, 'admin@sustentando.org');
      assert.match(mails[0].subject, /validada/i);
    });

    test('rechazar exige un motivo de 10 a 500 caracteres; la ONG lo ve y puede volver a enviar', async () => {
      await submit();
      const row = await rowOf();
      for (const reason of [undefined, '', 'corto', 'x'.repeat(501), 42]) {
        const r = await call(admin, `/api/admin/validaciones/${row.id}/rechazar`, { method: 'POST', body: { reason } });
        assert.equal(r.status, 400, String(reason));
        assert.equal(r.body.error, 'Escribí el motivo del rechazo (de 10 a 500 caracteres)');
      }
      const r = await call(admin, `/api/admin/validaciones/${row.id}/rechazar`, { method: 'POST', body: { reason: '  El estatuto no está firmado  ' } });
      assert.equal(r.status, 200);
      assert.equal(r.body.validation.status, 'rejected');
      const mine = (await call(ngo, '/api/ngos/me/validacion')).body.validation;
      assert.equal(mine.status, 'rejected');
      assert.equal(mine.reason, 'El estatuto no está firmado');
      assert.equal(mails.length, 1);
      assert.match(mails[0].html, /El estatuto no está firmado/);
      // Vuelve a enviar: queda en revisión, sin el motivo, y los PDF viejos se borran (después del COMMIT).
      deleted = [];
      const again = await submit();
      assert.equal(again.status, 201);
      assert.equal(again.body.validation.status, 'pending');
      assert.equal(again.body.validation.reason, null);
      assert.deepEqual(deleted.sort(), [row.estatuto_id, row.constancia_id].sort());
      assert.equal((await rowOf()).id, row.id, 'misma fila: una validación por ONG');
    });

    test('decidir una que ya no está en revisión → 409; inexistente → 404', async () => {
      await submit();
      const id = (await rowOf()).id;
      assert.equal((await call(admin, `/api/admin/validaciones/${id}/aprobar`, { method: 'POST' })).status, 200);
      const again = await call(admin, `/api/admin/validaciones/${id}/rechazar`, { method: 'POST', body: { reason: 'Me arrepentí de aprobar' } });
      assert.equal(again.status, 409);
      assert.equal(again.body.error, 'Esa validación ya no está en revisión');
      assert.equal((await rowOf()).estado, 'aprobada');
      assert.equal((await call(admin, '/api/admin/validaciones/no-existe/aprobar', { method: 'POST' })).status, 404);
    });

    test('aprobar y rechazar a la vez (regla 21) → uno gana y el otro 409; un solo aviso', async () => {
      await submit();
      const id = (await rowOf()).id;
      const rs = await Promise.all([
        call(admin, `/api/admin/validaciones/${id}/aprobar`, { method: 'POST' }),
        call(admin, `/api/admin/validaciones/${id}/rechazar`, { method: 'POST', body: { reason: 'Falta la firma del estatuto' } }),
      ]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
      assert.equal(mails.length, 1);
      const n = Number((await db.get(`SELECT COUNT(*) AS c FROM notifications WHERE user_id=$1 AND type LIKE 'ngo_validation%'`, [ngo.id])).c);
      assert.equal(n, 1);
    });
  });

  test('borrar la cuenta de la ONG borra también sus PDF de validación', async () => {
    const ngo3 = await login('admin@bancoalimentos.org');
    await submit(ngo3);
    const row = await rowOf(ngo3);
    deleted = [];
    const crypto = require('node:crypto');
    const token = crypto.randomBytes(32).toString('base64url');   // el formato de la app (43 caracteres)
    await db.run('INSERT INTO account_deletion_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
      [crypto.createHash('sha256').update(token).digest('hex'), ngo3.id, new Date(Date.now() + 3600e3).toISOString()]);
    const r = await call(null, '/api/auth/delete-account', { method: 'POST', body: { token } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(deleted.includes(row.estatuto_id) && deleted.includes(row.constancia_id), JSON.stringify(deleted));
  });
});
