// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { initWebSocket } = require('./ws');
const { describeEmailConfig } = require('./lib/email');
const { describeStorageConfig } = require('./lib/storage');
const { describePaymentsConfig } = require('./lib/payments');
const { errorHandler, corsError } = require('./lib/errorHandler');

const app = express();
// En producción (Render) hay un proxy delante: sin esto, req.ip sería la IP del proxy y el límite de intentos por IP
// del login/registro (§103) juntaría a todos los usuarios. Fuera de producción no hay proxy.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      cb(null, true);
    } else {
      cb(corsError(origin)); // el manejador global responde 403 (antes 500 con el origen en el mensaje)
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────
// `commit`: el que desplegó Render (RENDER_GIT_COMMIT; null en local). El pipeline de deploy espera a verlo antes
// del smoke (PROJECT_ANALYSIS.md §193). El repo es público: el hash no expone nada.
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date(), commit: process.env.RENDER_GIT_COMMIT || null }));

// ── Rutas principales ─────────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/projects',       require('./routes/projects'));
app.use('/api/enrollments',    require('./routes/enrollments'));
app.use('/api/ngos/me/mercadopago', require('./routes/mercadopago'));   // antes que /api/ngos (§216)
app.use('/api/ngos',           require('./routes/ngos'));
app.use('/api/empresas',       require('./routes/empresas'));
app.use('/api/faqs',           require('./routes/faqs'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/voluntarios',    require('./routes/voluntarios'));
app.use('/api/messages',       require('./routes/messages'));
app.use('/api/follows',        require('./routes/follows'));
app.use('/api/posts',          require('./routes/posts'));
app.use('/api/donaciones',     require('./routes/donaciones'));

// ── Rutas de catálogos (solo GET, datos base) ─────────────────────────────
const db = require('./db');

app.get('/api/categorias', async (_, res) => {
  try {
    const rows = await db.all('SELECT id, nombre, descripcion, icono FROM categorias ORDER BY nombre', []);
    res.json({ categorias: rows });
  } catch { res.status(500).json({ error: 'Error al obtener categorías' }); }
});

app.get('/api/roles', async (_, res) => {
  try {
    const rows = await db.all('SELECT id, nombre, descripcion FROM roles ORDER BY nombre', []);
    res.json({ roles: rows });
  } catch { res.status(500).json({ error: 'Error al obtener roles' }); }
});

app.get('/api/habilidades', async (_, res) => {
  try {
    const rows = await db.all('SELECT id, nombre, descripcion FROM habilidades ORDER BY nombre', []);
    res.json({ habilidades: rows });
  } catch { res.status(500).json({ error: 'Error al obtener habilidades' }); }
});

// Números de la portada (PublicFeed). Antes estaban fijos en el frontend y mentían (§129).
// COUNT llega como string en Postgres: Number(x) || 0 (CLAUDE.md, trampas).
app.get('/api/stats', async (_, res) => {
  try {
    const row = await db.get(
      `SELECT (SELECT COUNT(*) FROM projects WHERE status = 'active') AS active_projects,
              (SELECT COUNT(*) FROM voluntarios) AS volunteers,
              (SELECT COUNT(*) FROM ngos) AS ngos`, []);
    res.json({
      active_projects: Number(row.active_projects) || 0,
      volunteers: Number(row.volunteers) || 0,
      ngos: Number(row.ngos) || 0,
    });
  } catch { res.status(500).json({ error: 'Error al obtener las estadísticas' }); }
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Error global ──────────────────────────────────────────────────────────
// Errores del cliente (JSON roto, cuerpo grande, CORS) con su código y mensaje en español; el resto,
// 500 genérico. Ver src/lib/errorHandler.js (REVISION B3).
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
initWebSocket(server); // chat en tiempo real, mismo puerto, path /ws

server.listen(PORT, () => {
  console.log(`\n🚀 Voluntariar API → http://localhost:${PORT}`);
  console.log(`   WebSocket (chat) → ws://localhost:${PORT}/ws`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:      ${process.env.USE_POSTGRES === 'true' ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`   Email:   ${describeEmailConfig()}`);
  console.log(`   Fotos:   ${describeStorageConfig()}`);
  console.log(`   Pagos:   ${describePaymentsConfig()}\n`);
});

module.exports = app;
module.exports.server = server; // usado por los tests de integración para levantar/cerrar el server real
