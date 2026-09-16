// src/routes/empresas.js
//
// Agregado 2026-09: hasta ahora el rol `company` existía en `users.role` y
// en la tabla `empresas` (creada en el registro, ver routes/auth.js), pero
// no tenía ningún endpoint propio — un usuario `company` podía loguearse
// pero no había nada de backend que sirviera datos específicos de su rol
// ni que protegiera un recurso con `requireRole('company')`.
// Mismo patrón exacto que routes/ngos.js (fmt(), actualización parcial
// anti-B8, JOIN con categorías) para no introducir una segunda convención.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../lib/email');
const { sponsorProposalEmail } = require('../lib/emailTemplates');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const router = express.Router();

// ── Helper para formatear Empresa (mismo criterio que fmtNgo en ngos.js) ──
function fmtEmpresa(e) {
  return {
    ...e,
    name:        e.nombre,
    logo:        e.foto_perfil,
    cover_image: e.banner,
    description: e.descripcion,
    mission:     e.mision,
    location:    e.ubicacion,
    industry:    e.industria,
    // categoria_nombre viene del LEFT JOIN con empresa_categorias/categorias
    // cuando la query lo incluye; si no, queda undefined (no rompe nada).
    category:    e.categoria_nombre || undefined,
  };
}

// ── GET /api/empresas ──────────────────────────────────────────────────────
// Público — listado, mismo criterio que GET /api/ngos (para explorar
// empresas patrocinadoras desde el frontend en el futuro).
router.get('/', async (req, res) => {
  try {
    const empresas = await db.all(
      `SELECT e.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM empresas e
       LEFT JOIN empresa_categorias ec ON ec.empresa_id = e.id
       LEFT JOIN categorias c ON c.id = ec.categoria_id
       ORDER BY e.followers DESC`,
      []
    );
    res.json({ empresas: empresas.map(fmtEmpresa) });
  } catch (err) {
    console.error('GET /empresas error:', err);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// ── GET /api/empresas/me ───────────────────────────────────────────────────
router.get('/me', requireAuth, requireRole('company'), async (req, res) => {
  try {
    const empresa = await db.get(
      `SELECT e.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM empresas e
       LEFT JOIN empresa_categorias ec ON ec.empresa_id = e.id
       LEFT JOIN categorias c ON c.id = ec.categoria_id
       WHERE e.user_id=$1`,
      [req.user.id]
    );
    if (!empresa) return res.status(404).json({ error: 'Perfil de empresa no encontrado' });

    res.json({ empresa: fmtEmpresa(empresa) });
  } catch (err) {
    console.error('GET /empresas/me error:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// ── GET /api/empresas/:id ──────────────────────────────────────────────────
// Público — perfil de empresa por id (mismo shape que GET /api/ngos/:id).
// Columnas seleccionadas explícitamente (regla 8 de AI_RULES.md: nunca
// SELECT * en un endpoint público, por si en el futuro se agregan columnas
// sensibles a `empresas`).
router.get('/:id', async (req, res) => {
  try {
    const empresa = await db.get(
      `SELECT e.id, e.user_id, e.nombre, e.descripcion, e.mision, e.ubicacion,
              e.foto_perfil, e.banner, e.industria, e.followers, e.created_at,
              COALESCE(c.nombre, '') AS categoria_nombre
       FROM empresas e
       LEFT JOIN empresa_categorias ec ON ec.empresa_id = e.id
       LEFT JOIN categorias c ON c.id = ec.categoria_id
       WHERE e.id=$1`,
      [req.params.id]
    );
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    res.json({ empresa: fmtEmpresa(empresa) });
  } catch (err) {
    console.error('GET /empresas/:id error:', err);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

// ── PUT /api/empresas/me ───────────────────────────────────────────────────
router.put('/me', requireAuth, requireRole('company'), async (req, res) => {
  try {
    const { name, description, mission, location, logo, cover_image, industry, category } = req.body;

    if (name && name.trim().length < 2)
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });

    const empresaRow = await db.get('SELECT * FROM empresas WHERE user_id=$1', [req.user.id]);
    if (!empresaRow) return res.status(404).json({ error: 'Perfil de empresa no encontrado' });

    // Actualización parcial real — mismo bug y mismo fix que B8/PUT /ngos/me:
    // un campo no enviado (undefined) conserva su valor anterior en vez de
    // pisarse con null, y evita el 500 de bindear undefined en SQLite.
    await db.run(
      `UPDATE empresas SET
         nombre=$1, descripcion=$2, mision=$3, ubicacion=$4,
         foto_perfil=$5, banner=$6, industria=$7,
         updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$8`,
      [
        name ?? empresaRow.nombre,
        description !== undefined ? description : empresaRow.descripcion,
        mission !== undefined ? mission : empresaRow.mision,
        location !== undefined ? location : empresaRow.ubicacion,
        logo !== undefined ? logo : empresaRow.foto_perfil,
        cover_image !== undefined ? cover_image : empresaRow.banner,
        industry !== undefined ? industry : empresaRow.industria,
        req.user.id,
      ]
    );

    // Persistir la categoría (viene como nombre, ej. "Educación") en la
    // tabla N:M — mismo patrón "borrar e insertar de nuevo" que ngo_categorias.
    // Si el nombre no matchea ninguna categoría existente, no falla: el
    // resto del perfil se guarda igual y la categoría simplemente no cambia.
    if (category) {
      const categoria = await db.get('SELECT id FROM categorias WHERE nombre=$1', [category]);
      if (categoria) {
        await db.run('DELETE FROM empresa_categorias WHERE empresa_id=$1', [empresaRow.id]);
        await db.run(
          'INSERT INTO empresa_categorias (empresa_id, categoria_id) VALUES ($1,$2)',
          [empresaRow.id, categoria.id]
        );
      }
    }

    const updated = await db.get(
      `SELECT e.*, COALESCE(c.nombre, '') AS categoria_nombre
       FROM empresas e
       LEFT JOIN empresa_categorias ec ON ec.empresa_id = e.id
       LEFT JOIN categorias c ON c.id = ec.categoria_id
       WHERE e.user_id=$1`,
      [req.user.id]
    );
    res.json({ empresa: fmtEmpresa(updated) });
  } catch (err) {
    console.error('PUT /empresas/me error:', err);
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

module.exports = router;

// ── Sistema de Patrocinio (Empresa ↔ Proyecto) ─────────────────────────────
// Agregado 2026-09 (roadmap punto 5). Usa la tabla `empresa_voluntariados`
// que ya existía sin API (ver docs/API_CONTEXT.md "Endpoints ausentes"),
// ahora con las columnas `estado`/`mensaje`/`updated_at` agregadas en
// scripts/migrate.js. El lado de aceptar/rechazar vive en routes/ngos.js
// (es la ONG quien decide sobre sus propios proyectos).

function fmtPatrocinio(p) {
  return {
    empresa_id: p.empresa_id,
    project_id: p.project_id,
    estado: p.estado,
    mensaje: p.mensaje,
    aporte: p.aporte,
    created_at: p.created_at,
    updated_at: p.updated_at,
    project_title: p.project_title,
    project_image: p.project_image,
    project_status: p.project_status,
    ngo_id: p.ngo_id,
    ngo_name: p.ngo_name,
    ngo_logo: p.ngo_logo,
  };
}

// ── GET /api/empresas/me/patrocinios ───────────────────────────────────────
// Todas las propuestas de patrocinio de la empresa logueada (cualquier estado).
router.get('/me/patrocinios', requireAuth, requireRole('company'), async (req, res) => {
  try {
    const empresa = await db.get('SELECT id FROM empresas WHERE user_id=$1', [req.user.id]);
    if (!empresa) return res.status(404).json({ error: 'Perfil de empresa no encontrado' });

    const patrocinios = await db.all(
      `SELECT ev.*, p.titulo AS project_title, p.foto_perfil AS project_image,
              p.status AS project_status, p.ngo_id, n.nombre AS ngo_name, n.foto_perfil AS ngo_logo
       FROM empresa_voluntariados ev
       JOIN projects p ON p.id = ev.project_id
       JOIN ngos n ON n.id = p.ngo_id
       WHERE ev.empresa_id=$1
       ORDER BY ev.updated_at DESC`,
      [empresa.id]
    );
    res.json({ patrocinios: patrocinios.map(fmtPatrocinio) });
  } catch (err) {
    console.error('GET /empresas/me/patrocinios error:', err);
    res.status(500).json({ error: 'Error al obtener patrocinios' });
  }
});

// ── POST /api/empresas/me/patrocinios ──────────────────────────────────────
// La empresa propone patrocinar un proyecto activo. Queda en estado
// "propuesto" hasta que la ONG dueña del proyecto lo acepte o rechace
// (ver PATCH /api/ngos/me/patrocinios/:empresaId/:projectId).
router.post('/me/patrocinios', requireAuth, requireRole('company'), async (req, res) => {
  try {
    const { project_id, mensaje } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id requerido' });

    const empresa = await db.get(
      'SELECT id, nombre FROM empresas WHERE user_id=$1', [req.user.id]
    );
    if (!empresa) return res.status(404).json({ error: 'Perfil de empresa no encontrado' });

    const project = await db.get(
      `SELECT p.id, p.titulo, p.ngo_id, u.id AS ngo_user_id, u.email AS ngo_email, n.nombre AS ngo_name
       FROM projects p
       JOIN ngos n ON n.id = p.ngo_id
       JOIN users u ON u.id = n.user_id
       WHERE p.id=$1 AND p.status='active'`,
      [project_id]
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado o inactivo' });

    // Ya existe una fila para este par (empresa, project) — la PK compuesta
    // de empresa_voluntariados no permite dos propuestas independientes al
    // mismo proyecto; si una anterior fue rechazada, se puede re-proponer
    // reseteando el estado en vez de insertar una fila nueva.
    const existing = await db.get(
      'SELECT estado FROM empresa_voluntariados WHERE empresa_id=$1 AND project_id=$2',
      [empresa.id, project_id]
    );
    if (existing && existing.estado !== 'rechazado') {
      return res.status(409).json({ error: 'Ya existe una propuesta de patrocinio con este proyecto' });
    }

    if (existing) {
      await db.run(
        `UPDATE empresa_voluntariados SET estado='propuesto', mensaje=$1, updated_at=CURRENT_TIMESTAMP
         WHERE empresa_id=$2 AND project_id=$3`,
        [mensaje || null, empresa.id, project_id]
      );
    } else {
      await db.run(
        `INSERT INTO empresa_voluntariados (empresa_id, project_id, estado, mensaje)
         VALUES ($1,$2,'propuesto',$3)`,
        [empresa.id, project_id, mensaje || null]
      );
    }

    // Notificar a la ONG (in-app + email, fire-and-forget)
    await db.run(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1,'sponsor_proposal','Nueva propuesta de patrocinio',$2,$3)`,
      [project.ngo_user_id,
       `${empresa.nombre} quiere patrocinar "${project.titulo}"`,
       JSON.stringify({ project_id, empresa_id: empresa.id })]
    ).catch(() => {});

    const { subject, html } = sponsorProposalEmail({
      ngoName: project.ngo_name, empresaName: empresa.nombre,
      projectTitle: project.titulo, projectId: project_id, appUrl: APP_URL,
    });
    sendEmail({ to: project.ngo_email, subject, html }).catch(() => {});

    res.status(201).json({ message: 'Propuesta de patrocinio enviada' });
  } catch (err) {
    console.error('POST /empresas/me/patrocinios error:', err);
    res.status(500).json({ error: 'Error al proponer patrocinio' });
  }
});

// ── DELETE /api/empresas/me/patrocinios/:projectId ─────────────────────────
// Retirar una propuesta propia todavía no decidida por la ONG. No se puede
// retirar una ya aceptada por acá (eso es una decisión de negocio más seria,
// fuera de alcance de este MVP).
router.delete('/me/patrocinios/:projectId', requireAuth, requireRole('company'), async (req, res) => {
  try {
    const empresa = await db.get('SELECT id FROM empresas WHERE user_id=$1', [req.user.id]);
    const result = await db.run(
      `DELETE FROM empresa_voluntariados WHERE empresa_id=$1 AND project_id=$2 AND estado='propuesto'`,
      [empresa.id, req.params.projectId]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Propuesta no encontrada o ya decidida' });
    res.json({ message: 'Propuesta retirada' });
  } catch (err) {
    console.error('DELETE /empresas/me/patrocinios/:projectId error:', err);
    res.status(500).json({ error: 'Error al retirar propuesta' });
  }
});
