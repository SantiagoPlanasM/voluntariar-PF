// test/integration/empresa-dashboard.test.js
//
// GET /api/empresas/me/dashboard (docs/BACKEND_ROADMAP_ANALYSIS.md §2.3).
//
// Los valores esperados NO se toman de lo que devuelve el endpoint: salen de
// las cuentas hechas a mano sobre los datos del seed (ver comentarios), para
// que un bug en la query no pueda "coincidir consigo mismo".
//
// Datos de seed que usa este archivo:
//   proj-1 (ngo-1): user-vol-1 approved · user-vol-2 pending
//   proj-7 (ngo-1): user-vol-1 approved            ← misma persona que en proj-1
//   proj-3 (ngo-3): user-vol-2 approved
//   Todas con horas_realizadas = 0 al arrancar.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestServer } = require('./helpers');

describe('Dashboard de Empresa (KPIs de patrocinio)', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await setupTestServer({ seed: true });
    baseUrl = server.baseUrl;
  });

  after(async () => {
    if (server) await server.close();
  });

  const call = (path, { token, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const login = async (email) => {
    const r = await call('/api/auth/login', { method: 'POST', body: { email, password: 'Password1' } });
    assert.equal(r.status, 200, `login ${email}`);
    return r.body.token;
  };

  const dashboard = (token) => call('/api/empresas/me/dashboard', { token });

  // Carga horas como la ONG dueña, sobre la inscripción aprobada del proyecto.
  const logHoursOnApproved = async (ngoToken, projectId, horas) => {
    const list = await call(`/api/enrollments/project/${projectId}`, { token: ngoToken });
    assert.equal(list.status, 200);
    const approved = list.body.enrollments.find((e) => e.status === 'approved');
    assert.ok(approved, `${projectId} debería tener una inscripción approved en el seed`);
    const r = await call(`/api/enrollments/${approved.id}/horas`, {
      token: ngoToken, method: 'PATCH', body: { horas },
    });
    assert.equal(r.status, 200);
  };

  let techcorp, ngo1, ngo3, empresaId;

  // Preparación: sesiones y id de la empresa (REVISION T4).
  before(async () => {
    techcorp = await login('admin@techcorp.com');
    ngo1 = await login('admin@sustentando.org');
    ngo3 = await login('admin@bancoalimentos.org');
    const me = await call('/api/empresas/me', { token: techcorp });
    assert.equal(me.status, 200);
    empresaId = me.body.empresa.id;
    assert.ok(empresaId);
  });

  describe('autorización', () => {
    test('sin token → 401', async () => {
      assert.equal((await dashboard(undefined)).status, 401);
    });

    test('un voluntario → 403', async () => {
      const vol = await login('maria@example.com');
      assert.equal((await dashboard(vol)).status, 403);
    });

    test('una ONG → 403', async () => {
      assert.equal((await dashboard(ngo1)).status, 403);
    });
  });

  test('empresa sin patrocinios: todo en 0 (número, no null ni string) y lista vacía', async () => {
    const r = await dashboard(techcorp);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      stats:  { sponsored_projects: 0, pending_proposals: 0, rejected_proposals: 0 },
      impact: { total_hours: 0, volunteers_reached: 0 },
      projects: [],
    });
  });

  test('una propuesta PENDIENTE no infla los KPIs aunque el proyecto ya tenga horas', async () => {
    // Las horas se cargan ANTES de que exista la propuesta y antes de aceptarla:
    // si el impacto contara propuestas pendientes (error del diseño original), acá daría 10.
    await logHoursOnApproved(ngo1, 'proj-1', 10);

    for (const project_id of ['proj-1', 'proj-7', 'proj-3']) {
      const p = await call('/api/empresas/me/patrocinios', {
        token: techcorp, method: 'POST', body: { project_id, mensaje: 'test' },
      });
      assert.equal(p.status, 201, `proponer ${project_id}`);
    }

    const r = await dashboard(techcorp);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.stats, { sponsored_projects: 0, pending_proposals: 3, rejected_proposals: 0 });
    assert.deepEqual(r.body.impact, { total_hours: 0, volunteers_reached: 0 });
    assert.equal(r.body.projects.length, 3);
    assert.ok(r.body.projects.every((p) => p.sponsorship_status === 'propuesto'));
  });

  test('al aceptar: cuenta solo lo aceptado; voluntarios DISTINTOS (misma persona en 2 proyectos = 1)', async () => {
    await logHoursOnApproved(ngo1, 'proj-7', 5);

    for (const project_id of ['proj-1', 'proj-7']) {
      const d = await call(`/api/ngos/me/patrocinios/${empresaId}/${project_id}`, {
        token: ngo1, method: 'PATCH', body: { estado: 'aceptado' },
      });
      assert.equal(d.status, 200, `aceptar ${project_id}`);
      // "Propuesta" es femenino: antes decía "Propuesta aceptado" (§151).
      assert.equal(d.body.message, 'Propuesta aceptada');
    }

    const r = await dashboard(techcorp);
    // proj-3 sigue pendiente → 2 aceptados, 1 pendiente.
    assert.deepEqual(r.body.stats, { sponsored_projects: 2, pending_proposals: 1, rejected_proposals: 0 });
    // Horas: 10 (proj-1) + 5 (proj-7) = 15. Voluntarios: user-vol-1 está en ambos → 1, NO 2.
    assert.deepEqual(r.body.impact, { total_hours: 15, volunteers_reached: 1 });

    const byId = Object.fromEntries(r.body.projects.map((p) => [p.project_id, p]));
    assert.equal(byId['proj-1'].hours_logged, 10);
    assert.equal(byId['proj-1'].volunteers_count, 1);   // vol-2 está pending: no cuenta
    assert.equal(byId['proj-7'].hours_logged, 5);
    assert.equal(byId['proj-7'].volunteers_count, 1);
    assert.equal(byId['proj-1'].sponsorship_status, 'aceptado');
  });

  test('al rechazar: cuenta como rechazada y NO suma al impacto, aunque el proyecto tenga horas', async () => {
    await logHoursOnApproved(ngo3, 'proj-3', 7);   // horas reales en un proyecto que se va a rechazar
    const d = await call(`/api/ngos/me/patrocinios/${empresaId}/proj-3`, {
      token: ngo3, method: 'PATCH', body: { estado: 'rechazado' },
    });
    assert.equal(d.status, 200);
    assert.equal(d.body.message, 'Propuesta rechazada');

    const r = await dashboard(techcorp);
    assert.deepEqual(r.body.stats, { sponsored_projects: 2, pending_proposals: 0, rejected_proposals: 1 });
    assert.deepEqual(r.body.impact, { total_hours: 15, volunteers_reached: 1 });  // los 7 h de proj-3 NO entran
  });

  test('consistencia: total_hours == suma de hours_logged de los proyectos aceptados', async () => {
    const r = await dashboard(techcorp);
    const sumAccepted = r.body.projects
      .filter((p) => p.sponsorship_status === 'aceptado')
      .reduce((acc, p) => acc + p.hours_logged, 0);
    assert.equal(r.body.impact.total_hours, sumAccepted);
    assert.equal(r.body.stats.sponsored_projects,
      r.body.projects.filter((p) => p.sponsorship_status === 'aceptado').length);
  });

  test('forma de la respuesta: números reales y solo claves en inglés (sin filtrar columnas crudas)', async () => {
    const r = await dashboard(techcorp);

    for (const group of [r.body.stats, r.body.impact]) {
      for (const [k, v] of Object.entries(group)) {
        assert.equal(typeof v, 'number', `${k} debe ser number (en Postgres llegaría string sin normalizar)`);
      }
    }

    const p = r.body.projects[0];
    assert.deepEqual(Object.keys(p).sort(), [
      'current_volunteers', 'decided_at', 'hours_logged', 'image', 'ngo_id', 'ngo_logo',
      'ngo_name', 'project_id', 'project_status', 'sponsorship_status', 'title',
      'volunteers_count', 'volunteers_needed',
    ]);
    for (const k of ['volunteers_needed', 'current_volunteers', 'hours_logged', 'volunteers_count']) {
      assert.equal(typeof p[k], 'number', k);
    }
    // Ninguna columna cruda en español debe haberse colado.
    for (const raw of ['titulo', 'cupos', 'cupos_ocupados', 'foto_perfil', 'estado', 'horas', 'voluntarios']) {
      assert.ok(!(raw in p), `no debe exponer "${raw}"`);
    }
  });

  test('aislamiento: otra empresa no ve los patrocinios de TechCorp', async () => {
    const reg = await call('/api/auth/register', {
      method: 'POST',
      body: { name: 'Otra Corp SA', email: 'otra@corp.com', password: 'Password1', role: 'company' },
    });
    assert.equal(reg.status, 201);

    const r = await dashboard(reg.body.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.stats, { sponsored_projects: 0, pending_proposals: 0, rejected_proposals: 0 });
    assert.deepEqual(r.body.impact, { total_hours: 0, volunteers_reached: 0 });
    assert.deepEqual(r.body.projects, []);
  });
});
