// src/routes/faqs.js
//
// Agregado 2026-09 (roadmap punto 9). Chatbot FAQ explícitamente SIN IA:
// nada de embeddings, LLM ni librerías de NLP — matching por keywords en
// JS + LIKE en SQL, tal como se confirmó en el roadmap. Sin tabla de
// conversación/historial: es stateless a propósito (ver docs/PROJECT_ANALYSIS.md
// sección del Chatbot para el detalle de esta decisión).
const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

function fmtFaq(f) {
  return { id: f.id, categoria: f.categoria, pregunta: f.pregunta, respuesta: f.respuesta };
}

function normalizar(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function topFaqs(categoria) {
  const rows = categoria
    ? await db.all(`SELECT id, pregunta FROM faqs WHERE activo=1 AND categoria=$1 ORDER BY orden LIMIT 5`, [categoria])
    : await db.all(`SELECT id, pregunta FROM faqs WHERE activo=1 ORDER BY orden LIMIT 5`, []);
  return rows;
}

// ── GET /api/faqs?categoria=voluntario ─────────────────────────────────────
// Catálogo completo (para listar como acordeón) — público, sin auth.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { categoria } = req.query;
    const rows = categoria
      ? await db.all(`SELECT id, categoria, pregunta, respuesta FROM faqs WHERE activo=1 AND categoria=$1 ORDER BY orden`, [categoria])
      : await db.all(`SELECT id, categoria, pregunta, respuesta FROM faqs WHERE activo=1 ORDER BY orden`, []);
    res.json({ faqs: rows.map(fmtFaq) });
  } catch (err) {
    console.error('GET /faqs error:', err);
    res.status(500).json({ error: 'Error al obtener las preguntas frecuentes' });
  }
});

// ── POST /api/faqs/ask ──────────────────────────────────────────────────────
// "Bot" simple: score por coincidencia de keywords, sin IA. Devuelve la mejor
// coincidencia y hasta 3 alternativas; si no encuentra nada, devuelve
// sugerencias genéricas para que el frontend nunca se quede sin qué mostrar.
router.post('/ask', optionalAuth, async (req, res) => {
  try {
    const { question, categoria } = req.body;
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'La pregunta es muy corta' });
    }

    const words = normalizar(question).split(/[^a-z0-9]+/).filter(w => w.length > 2);
    if (words.length === 0) {
      return res.json({ matched: false, suggestions: await topFaqs(categoria) });
    }

    // La tabla de FAQs es chica por diseño (catálogo curado a mano, no miles
    // de filas) — se trae todo el candidate pool activo y se puntúa en JS,
    // en vez de pre-filtrar con LIKE en SQL. Evita que el filtro SQL y el
    // scoring queden desincronizados entre sí.
    const candidates = categoria
      ? await db.all(`SELECT id, categoria, pregunta, respuesta, keywords, orden FROM faqs WHERE activo=1 AND categoria=$1`, [categoria])
      : await db.all(`SELECT id, categoria, pregunta, respuesta, keywords, orden FROM faqs WHERE activo=1`, []);

    if (candidates.length === 0) {
      return res.json({ matched: false, suggestions: await topFaqs(categoria) });
    }

    const scored = candidates
      .map(f => {
        const kws = normalizar(f.keywords).split(',').map(k => k.trim()).filter(Boolean);
        // Substring bidireccional, sin heurísticas de prefijo de largo fijo:
        // se depende de que las keywords en la base incluyan las variantes
        // conjugadas relevantes (ej: "aprobar,apruebo"), no de adivinar raíces.
        // Un prefijo fijo (ej. 4 letras) generaba falsos positivos entre
        // palabras con la misma raíz corta pero significado distinto
        // (ej. "inscribir" vs "inscripción").
        const score = words.filter(w => kws.some(k => k.includes(w) || w.includes(k))).length;
        return { ...f, score };
      })
      .sort((a, b) => b.score - a.score || (a.orden ?? 0) - (b.orden ?? 0));

    if (scored[0].score === 0) {
      return res.json({ matched: false, suggestions: await topFaqs(categoria) });
    }

    res.json({
      matched: true,
      best: fmtFaq(scored[0]),
      alternatives: scored.slice(1, 4).map(fmtFaq),
    });
  } catch (err) {
    console.error('POST /faqs/ask error:', err);
    res.status(500).json({ error: 'Error al procesar la pregunta' });
  }
});

module.exports = router;
