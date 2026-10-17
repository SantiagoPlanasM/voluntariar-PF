// .github/scripts/post-deploy.js — después de cada deploy en Render (deploy.yml; TP de Calidad, T9; §193).
//
//   node .github/scripts/post-deploy.js wait    espera a que /health muestre EXPECTED_COMMIT (el deploy terminó)
//   node .github/scripts/post-deploy.js smoke   chequeos de SOLO LECTURA de la API y del sitio
//   node .github/scripts/post-deploy.js e2e     donación de punta a punta con Mercado Pago (modo prueba), sin pagar
//
// Entorno: API_URL y WEB_URL (sin "/" final), EXPECTED_COMMIT (wait), E2E_EMAIL y E2E_PASSWORD (e2e: una cuenta
// voluntaria creada a mano solo para esto). El smoke no crea nada, no manda emails, no sube archivos ni llama a
// Mercado Pago. El e2e crea UNA donación 'pendiente' por corrida (no suma a lo recaudado, §170): es lo único que
// escribe, y lo hace con la cuenta dedicada. Nunca imprime el token ni la contraseña. Sin dependencias.
const fs = require('node:fs');

const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;   // Number.isInteger ya rechaza strings y null

function checkHealth(status, body, expectedCommit) {
  if (status !== 200) return [`/health respondió ${status}`];
  if (!body || body.status !== 'ok') return [`/health no dice status "ok"`];
  if (expectedCommit && body.commit !== expectedCommit) return [`/health muestra el commit ${body.commit}, se espera ${expectedCommit}`];
  return [];
}

function checkProjects(status, body) {
  if (status !== 200) return [`/api/projects respondió ${status}`];
  return body && Array.isArray(body.projects) ? [] : ['/api/projects no devuelve { projects: [...] }'];
}

function checkStats(status, body) {
  if (status !== 200) return [`/api/stats respondió ${status}`];
  const bad = ['active_projects', 'volunteers', 'ngos'].filter((k) => !body || !isNonNegInt(body[k]));
  return bad.length ? [`/api/stats: ${bad.join(', ')} no es un entero >= 0`] : [];
}

function checkIndexHtml(status, text) {
  if (status !== 200) return [`la portada respondió ${status}`];
  return /<div id="root"/.test(text || '') ? [] : ['la portada no es el HTML del SPA (falta <div id="root">)'];
}

function isMercadoPagoCheckout(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(u.hostname);
  } catch { return false; }
}

function checkDonationCreated(status, body) {
  if (status !== 201) return [`POST /api/donaciones respondió ${status}: ${(body && body.error) || ''}`.trim()];
  const errs = [];
  if (!body || typeof body.donation_id !== 'string' || !body.donation_id) errs.push('falta donation_id');
  if (!body || !isMercadoPagoCheckout(body.checkout_url)) errs.push('checkout_url no es un link https de Mercado Pago');
  return errs;
}

function checkDonationStatus(status, body, donationId) {
  if (status !== 200) return [`GET /api/donaciones/:id respondió ${status}`];
  const d = body && body.donation;
  if (!d || d.id !== donationId) return ['GET /api/donaciones/:id no devolvió la donación creada'];
  return d.status === 'pending' ? [] : [`la donación está "${d.status}", se espera "pending" (no se pagó)`];
}

async function retry(fn, { attempts, delayMs, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let errors = [];
  for (let i = 1; i <= attempts; i++) {
    try { errors = await fn(i); } catch (err) { errors = [err.message]; }
    if (errors.length === 0) return { ok: true, attempts: i, errors: [] };
    if (i < attempts) await sleep(delayMs);
  }
  return { ok: false, attempts, errors };
}

// ── Lo que sigue habla con la red: lo prueba el pipeline, no los tests ──────────────────────────────────────────
const TIMEOUT = 60000;   // Render gratis tarda ~1 minuto en despertar
async function http(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* no es JSON (la portada, el checkout) */ }
  return { status: res.status, body, text };
}
const json = (method, payload, token) => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

const results = [];
function record(name, errors) {
  results.push({ name, errors });
  console.log(`${errors.length ? '❌' : '✅'} ${name}${errors.length ? ': ' + errors.join('; ') : ''}`);
  return errors.length === 0;
}

async function wait(api) {
  const expected = process.env.EXPECTED_COMMIT;
  if (!expected) throw new Error('Falta EXPECTED_COMMIT');
  const r = await retry(async () => { const h = await http(`${api}/health`); return checkHealth(h.status, h.body, expected); },
    { attempts: 60, delayMs: 20000 });   // hasta ~20 minutos: build + arranque en el plan gratuito
  record(`deploy listo: /health con el commit ${expected.slice(0, 7)} (intento ${r.attempts})`, r.errors);
}

async function smoke(api, web) {
  const wake = await retry(async () => { const h = await http(`${api}/health`); return checkHealth(h.status, h.body); },
    { attempts: 10, delayMs: 15000 });
  if (!record(`API despierta (intento ${wake.attempts})`, wake.errors)) return;
  const p = await http(`${api}/api/projects?limit=5`);
  record('GET /api/projects', checkProjects(p.status, p.body));
  const s = await http(`${api}/api/stats`);
  record('GET /api/stats', checkStats(s.status, s.body));
  const home = await http(`${web}/`);
  record('portada del sitio', checkIndexHtml(home.status, home.text));
  const deep = await http(`${web}/explore`);
  record('ruta del SPA (/explore, rewrite de Render)', checkIndexHtml(deep.status, deep.text));
}

async function e2e(api) {
  const { E2E_EMAIL: email, E2E_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('Faltan E2E_EMAIL / E2E_PASSWORD');
  const login = await http(`${api}/api/auth/login`, json('POST', { email, password }));
  if (!record('login de la cuenta de E2E', login.status === 200 && login.body && login.body.token ? [] : [`login respondió ${login.status}`])) return;
  const token = login.body.token;

  const list = await http(`${api}/api/projects?limit=1`);
  const project = list.body && Array.isArray(list.body.projects) ? list.body.projects[0] : null;
  if (!record('hay un proyecto activo para donar', project ? [] : ['no hay proyectos activos'])) return;

  const created = await http(`${api}/api/donaciones`, json('POST', { project_id: project.id, amount: 100 }, token));
  if (!record('POST /api/donaciones ($100) crea la preferencia en Mercado Pago', checkDonationCreated(created.status, created.body))) return;

  const checkout = await http(created.body.checkout_url, { redirect: 'follow' });
  record('el link de checkout de Mercado Pago responde', checkout.status < 400 ? [] : [`respondió ${checkout.status}`]);

  const st = await http(`${api}/api/donaciones/${created.body.donation_id}`, json('GET', undefined, token));
  record('GET /api/donaciones/:id: pendiente (no se paga)', checkDonationStatus(st.status, st.body, created.body.donation_id));
}

async function main() {
  const mode = process.argv[2];
  const api = (process.env.API_URL || '').replace(/\/$/, '');
  const web = (process.env.WEB_URL || '').replace(/\/$/, '');
  if (!api) throw new Error('Falta API_URL');
  if (mode === 'wait') await wait(api);
  else if (mode === 'smoke') { if (!web) throw new Error('Falta WEB_URL'); await smoke(api, web); }
  else if (mode === 'e2e') await e2e(api);
  else throw new Error(`Modo desconocido: ${mode} (wait | smoke | e2e)`);

  const failed = results.filter((r) => r.errors.length);
  const lines = [`### Post-deploy · ${mode}: ${failed.length ? '❌ falla' : '✅ pasa'}`, '',
    ...results.map((r) => `- ${r.errors.length ? '❌' : '✅'} ${r.name}${r.errors.length ? ': ' + r.errors.join('; ') : ''}`), ''];
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  if (failed.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => { console.error(`post-deploy: ${err.message}`); process.exitCode = 1; });
}

module.exports = {
  checkHealth, checkProjects, checkStats, checkIndexHtml, checkDonationCreated, checkDonationStatus, retry,
};
