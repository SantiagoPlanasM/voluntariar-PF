// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { initWebSocket } = require('./ws');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origen no permitido → ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Rutas principales ─────────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/projects',       require('./routes/projects'));
app.use('/api/enrollments',    require('./routes/enrollments'));
app.use('/api/ngos',           require('./routes/ngos'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/voluntarios',    require('./routes/voluntarios'));
app.use('/api/messages',       require('./routes/messages'));

// ── Rutas de catálogos (solo GET, datos base) ─────────────────────────────
const db = require('./db');

app.get('/api/categorias', async (_, res) => {
  try {
    const rows = await db.all('SELECT * FROM categorias ORDER BY nombre', []);
    res.json({ categorias: rows });
  } catch { res.status(500).json({ error: 'Error al obtener categorías' }); }
});

app.get('/api/roles', async (_, res) => {
  try {
    const rows = await db.all('SELECT * FROM roles ORDER BY nombre', []);
    res.json({ roles: rows });
  } catch { res.status(500).json({ error: 'Error al obtener roles' }); }
});

app.get('/api/habilidades', async (_, res) => {
  try {
    const rows = await db.all('SELECT * FROM habilidades ORDER BY nombre', []);
    res.json({ habilidades: rows });
  } catch { res.status(500).json({ error: 'Error al obtener habilidades' }); }
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Error global ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error global:', err.message);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
initWebSocket(server); // chat en tiempo real, mismo puerto, path /ws

server.listen(PORT, () => {
  console.log(`\n🚀 Voluntariar API → http://localhost:${PORT}`);
  console.log(`   WebSocket (chat) → ws://localhost:${PORT}/ws`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:      ${process.env.USE_POSTGRES === 'true' ? 'PostgreSQL' : 'SQLite'}\n`);
});

module.exports = app;
module.exports.server = server; // usado por los tests de integración para levantar/cerrar el server real
