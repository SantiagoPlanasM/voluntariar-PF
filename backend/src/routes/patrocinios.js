// src/routes/patrocinios.js — el patrocinio como acuerdo negociado (docs/archivo/PLAN_PATROCINIO.md, §263).
//
// Un acuerdo es una fila de `empresa_voluntariados` (la propuesta de siempre) con puntos: lo que aporta la empresa
// (lado `empresa`) y lo que pide u ofrece la ONG (lado `ong`). Lo ven y lo editan solo las dos partes; cada una toca
// solo su lado, y solo mientras el acuerdo está `propuesto`. Cada cambio de los puntos sube `version` en la misma
// transacción, y el acuerdo se cierra cuando las dos partes aceptaron la versión vigente (etapa 2, §264). Proponer
// cuenta como que la empresa acepta (routes/empresas.js). Los montos no salen de acá (no son públicos).
// §324: cada cambio de un punto queda en `patrocinio_cambios` (con el punto antes y después) y cada aceptación en
// `patrocinio_aceptaciones`, en la misma transacción; GET …/historial los devuelve por versión.
const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { checkText } = require('../lib/inputs');

const router = express.Router();

// DB en español, API en inglés (regla 11).
const SIDE = { empresa: 'company', ong: 'ngo' };
const ACTION = { agrega: 'add', edita: 'edit', quita: 'remove' };
const TYPE = { dinero: 'money', insumos: 'supplies', voluntarios: 'volunteers', difusion: 'outreach', otro: 'other' };
const TYPE_DB = Object.fromEntries(Object.entries(TYPE).map(([es, en]) => [en, es]));
const MAX_POINTS = 20;
const MAX_AMOUNT = 1e9;

class AgreementError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const CLOSED = 'El acuerdo ya está cerrado: no se puede cambiar';
const STALE = 'El acuerdo cambió: revisalo de nuevo';
// Columna de la aceptación de cada lado (nombre fijo: nunca sale del request).
const ACCEPT_COL = { empresa: 'acepta_empresa_version', ong: 'acepta_ong_version' };

/** El acuerdo con las dos partes y de qué lado está el usuario (`side` null si no es parte). */
async function loadAgreement(q, empresaId, projectId, userId) {
  const a = await q.get(
    `SELECT ev.empresa_id, ev.project_id, ev.estado, ev.version, ev.mensaje,
            ev.acepta_empresa_version, ev.acepta_ong_version,
            e.user_id AS empresa_user_id, e.nombre AS empresa_name,
            n.user_id AS ngo_user_id, n.nombre AS ngo_name, p.titulo
     FROM empresa_voluntariados ev
     JOIN empresas e ON e.id = ev.empresa_id
     JOIN projects p ON p.id = ev.project_id
     JOIN ngos n ON n.id = p.ngo_id
     WHERE ev.empresa_id = $1 AND ev.project_id = $2`,
    [empresaId, projectId]
  );
  if (!a) return null;
  const side = userId === a.empresa_user_id ? 'empresa' : userId === a.ngo_user_id ? 'ong' : null;
  return { ...a, side };
}

async function formatAgreement(a) {
  const points = await db.all(
    `SELECT pp.id, pp.lado, pp.tipo, pp.detalle, pp.monto, pp.created_at, pp.updated_at, pp.editor_id,
            ua.name AS autor_name, ue.name AS editor_name
     FROM patrocinio_puntos pp
     LEFT JOIN users ua ON ua.id = pp.autor_id
     LEFT JOIN users ue ON ue.id = pp.editor_id
     WHERE pp.empresa_id = $1 AND pp.project_id = $2
     ORDER BY CASE WHEN pp.lado = 'empresa' THEN 0 ELSE 1 END, pp.created_at, pp.id`,
    [a.empresa_id, a.project_id]
  );
  const messages = await db.all(
    `SELECT id, lado, cuerpo, created_at FROM patrocinio_mensajes
     WHERE empresa_id = $1 AND project_id = $2 ORDER BY created_at, id`,
    [a.empresa_id, a.project_id]
  );
  const version = Number(a.version) || 1;
  const orNull = (v) => (v == null ? null : Number(v));
  const acceptedVersions = { company: orNull(a.acepta_empresa_version), ngo: orNull(a.acepta_ong_version) };
  // Cuándo aceptó cada parte la versión VIGENTE (§324); null si no la aceptó. Las versiones no se repiten: una
  // aceptación de la vigente existe solo si esa parte la aceptó.
  const acceptances = await db.all(
    `SELECT lado, MAX(created_at) AS at FROM patrocinio_aceptaciones
     WHERE empresa_id = $1 AND project_id = $2 AND version = $3 GROUP BY lado`,
    [a.empresa_id, a.project_id, version]
  );
  const acceptedAt = (lado) => acceptances.find((r) => r.lado === lado)?.at ?? null;
  return {
    company_id: a.empresa_id, project_id: a.project_id, company_name: a.empresa_name, ngo_name: a.ngo_name,
    project_title: a.titulo, status: a.estado, version, message: a.mensaje,
    my_side: SIDE[a.side],
    // Quién aceptó la versión VIGENTE: una aceptación de una versión anterior ya no vale.
    accepted: {
      company: Number(a.acepta_empresa_version) === version, ngo: Number(a.acepta_ong_version) === version,
    },
    accepted_versions: acceptedVersions,
    accepted_at: { company: acceptedAt('empresa'), ngo: acceptedAt('ong') },
    points: points.map((p) => ({
      id: p.id, side: SIDE[p.lado], type: TYPE[p.tipo], detail: p.detalle,
      amount: p.monto == null ? null : Number(p.monto), created_at: p.created_at, updated_at: p.updated_at,
      created_by_name: p.autor_name ?? null,
      // Solo si alguien lo editó después de §324 (antes no se guardaba quién).
      edited_by_name: p.editor_id ? (p.editor_name ?? null) : null,
      edited_at: p.editor_id ? p.updated_at : null,
    })),
    messages: messages.map((m) => ({
      id: m.id, side: SIDE[m.lado], author_name: m.lado === 'empresa' ? a.empresa_name : a.ngo_name,
      body: m.cuerpo, created_at: m.created_at,
    })),
  };
}

/** Valida tipo, detalle y monto ya combinados (en el alta, o lo existente + lo que cambia). Devuelve el error o null. */
function pointError({ type, detail, amount }) {
  if (!TYPE_DB[type]) return 'Tipo de punto inválido';
  const detailErr = checkText(detail, { label: 'El detalle', max: 300, required: true });
  if (detailErr) return detailErr;
  if (type === 'money') {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 'Un punto de dinero necesita un monto mayor a 0';
    if (amount > MAX_AMOUNT) return 'El monto puede ser hasta 1.000.000.000';
  } else if (amount !== undefined && amount !== null) {
    return 'Solo un punto de dinero lleva monto';
  }
  return null;
}

/** Middleware: carga el acuerdo y exige que el usuario sea parte (si no, 404: no se revela que existe). */
async function agreementParty(req, res, next) {
  try {
    const a = await loadAgreement(db, req.params.empresaId, req.params.projectId, req.user.id);
    if (!a || !a.side) return res.status(404).json({ error: 'Acuerdo no encontrado' });
    req.agreement = a;
    next();
  } catch (err) {
    console.error('patrocinios: cargar acuerdo', err);
    res.status(500).json({ error: 'Error al cargar el acuerdo' });
  }
}

/**
 * Cambia los puntos dentro de una transacción: primero sube la versión SOLO si el acuerdo sigue `propuesto` (en
 * Postgres eso también bloquea la fila, así dos cambios a la vez se ordenan), después aplica `change(tx)`.
 */
async function changePoints(req, res, status, change) {
  try {
    const { empresa_id, project_id } = req.agreement;
    await db.transaction(async (tx) => {
      const bump = await tx.run(
        `UPDATE empresa_voluntariados SET version = version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE empresa_id = $1 AND project_id = $2 AND estado = 'propuesto'`,
        [empresa_id, project_id]
      );
      if (bump.changes === 0) throw new AgreementError(409, CLOSED);
      const row = await tx.get('SELECT version FROM empresa_voluntariados WHERE empresa_id = $1 AND project_id = $2', [empresa_id, project_id]);
      await change(tx, Number(row.version));
    });
    const fresh = await loadAgreement(db, empresa_id, project_id, req.user.id);
    res.status(status).json({ agreement: await formatAgreement(fresh) });
  } catch (err) {
    if (err instanceof AgreementError) return res.status(err.status).json({ error: err.message });
    console.error('patrocinios: cambiar puntos', err);
    res.status(500).json({ error: 'Error al guardar el acuerdo' });
  }
}

/** Un punto en la forma de la base, para guardarlo y para el registro de cambios. */
const dbPoint = (type, detail, amount) => ({ tipo: TYPE_DB[type], detalle: detail.trim(), monto: type === 'money' ? amount : null });

/** Registra un cambio de un punto (§324), dentro de la transacción del cambio. `antes`/`despues`: { tipo, detalle, monto } o null. */
function recordChange(tx, a, version, accion, puntoId, userId, antes, despues) {
  return tx.run(
    `INSERT INTO patrocinio_cambios (id, empresa_id, project_id, version, accion, punto_id, lado,
       tipo_antes, detalle_antes, monto_antes, tipo_despues, detalle_despues, monto_despues, autor_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [crypto.randomUUID(), a.empresa_id, a.project_id, version, accion, puntoId, a.side,
     antes?.tipo ?? null, antes?.detalle ?? null, antes?.monto ?? null,
     despues?.tipo ?? null, despues?.detalle ?? null, despues?.monto ?? null, userId, new Date().toISOString()]
  );
}

/**
 * Registra que `side` aceptó `version` (§324). Una sola vez por lado y versión: volver a aceptar la misma (el PATCH de
 * siempre de la ONG lo permite) no duplica. Va dentro de la transacción de la aceptación.
 */
function recordAcceptance(tx, empresaId, projectId, side, version, userId) {
  return tx.run(
    `INSERT INTO patrocinio_aceptaciones (id, empresa_id, project_id, lado, version, autor_id, created_at)
     SELECT $1, $2, $3, $4, $5, $6, $7
     WHERE NOT EXISTS (SELECT 1 FROM patrocinio_aceptaciones
                       WHERE empresa_id = $2 AND project_id = $3 AND lado = $4 AND version = $5)`,
    [crypto.randomUUID(), empresaId, projectId, side, version, userId, new Date().toISOString()]
  );
}

/** El punto, si es del lado del usuario (si no, 404). */
async function ownPoint(q, a, puntoId) {
  return q.get(
    `SELECT id, tipo, detalle, monto FROM patrocinio_puntos
     WHERE id = $1 AND empresa_id = $2 AND project_id = $3 AND lado = $4`,
    [puntoId, a.empresa_id, a.project_id, a.side]
  );
}

// ── GET /api/patrocinios/:empresaId/:projectId ────────────────────────────
router.get('/:empresaId/:projectId', requireAuth, agreementParty, async (req, res) => {
  try {
    res.json({ agreement: await formatAgreement(req.agreement) });
  } catch (err) {
    console.error('GET /patrocinios error:', err);
    res.status(500).json({ error: 'Error al cargar el acuerdo' });
  }
});

// ── POST /api/patrocinios/:empresaId/:projectId/puntos ────────────────────
router.post('/:empresaId/:projectId/puntos', requireAuth, agreementParty, async (req, res) => {
  const { type, detail, amount } = req.body || {};
  const error = pointError({ type, detail, amount });
  if (error) return res.status(400).json({ error });
  const a = req.agreement;
  await changePoints(req, res, 201, async (tx, version) => {
    const n = await tx.get(
      'SELECT COUNT(*) AS n FROM patrocinio_puntos WHERE empresa_id = $1 AND project_id = $2 AND lado = $3',
      [a.empresa_id, a.project_id, a.side]
    );
    if ((Number(n.n) || 0) >= MAX_POINTS) throw new AgreementError(409, `Hasta ${MAX_POINTS} puntos por lado`);
    const id = crypto.randomUUID();
    const after = dbPoint(type, detail, amount);
    await tx.run(
      `INSERT INTO patrocinio_puntos (id, empresa_id, project_id, lado, tipo, detalle, monto, autor_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, a.empresa_id, a.project_id, a.side, after.tipo, after.detalle, after.monto, req.user.id, new Date().toISOString()]
    );
    await recordChange(tx, a, version, 'agrega', id, req.user.id, null, after);
  });
});

// ── PATCH /api/patrocinios/:empresaId/:projectId/puntos/:puntoId ──────────
router.patch('/:empresaId/:projectId/puntos/:puntoId', requireAuth, agreementParty, async (req, res) => {
  try {
    const a = req.agreement;
    const current = await ownPoint(db, a, req.params.puntoId);
    if (!current) return res.status(404).json({ error: 'Punto no encontrado' });
    const body = req.body || {};
    const merged = {
      type: body.type !== undefined ? body.type : TYPE[current.tipo],
      detail: body.detail !== undefined ? body.detail : current.detalle,
      amount: body.amount !== undefined ? body.amount : (current.monto == null ? null : Number(current.monto)),
    };
    if (merged.type !== 'money' && body.amount === undefined) merged.amount = null; // pasar a otro tipo borra el monto
    const error = pointError(merged);
    if (error) return res.status(400).json({ error });
    await changePoints(req, res, 200, async (tx, version) => {
      // Lo de antes se relee dentro de la transacción: otro cambio pudo pasar entre ownPoint y acá.
      const before = await ownPoint(tx, a, current.id);
      if (!before) throw new AgreementError(404, 'Punto no encontrado');
      const after = dbPoint(merged.type, merged.detail, merged.amount);
      await tx.run(
        `UPDATE patrocinio_puntos SET tipo = $1, detalle = $2, monto = $3, editor_id = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND lado = $6`,
        [after.tipo, after.detalle, after.monto, req.user.id, current.id, a.side]
      );
      await recordChange(tx, a, version, 'edita', current.id, req.user.id, before, after);
    });
  } catch (err) {
    console.error('PATCH /patrocinios/puntos error:', err);
    res.status(500).json({ error: 'Error al guardar el acuerdo' });
  }
});

// ── DELETE /api/patrocinios/:empresaId/:projectId/puntos/:puntoId ─────────
router.delete('/:empresaId/:projectId/puntos/:puntoId', requireAuth, agreementParty, async (req, res) => {
  try {
    const a = req.agreement;
    const current = await ownPoint(db, a, req.params.puntoId);
    if (!current) return res.status(404).json({ error: 'Punto no encontrado' });
    await changePoints(req, res, 200, async (tx, version) => {
      const before = await ownPoint(tx, a, current.id);
      const del = await tx.run('DELETE FROM patrocinio_puntos WHERE id = $1 AND lado = $2', [current.id, a.side]);
      if (!before || del.changes === 0) throw new AgreementError(404, 'Punto no encontrado'); // lo borró otro pedido
      await recordChange(tx, a, version, 'quita', current.id, req.user.id, before, null);
    });
  } catch (err) {
    console.error('DELETE /patrocinios/puntos error:', err);
    res.status(500).json({ error: 'Error al guardar el acuerdo' });
  }
});

// ── Etapa 2 (§264): aceptar, rechazar y la charla ─────────────────────────

/** Aviso in-app a la otra parte (después del COMMIT; si falla, no corta nada). */
function notifyOther(a, type, title, body) {
  const to = a.side === 'empresa' ? a.ngo_user_id : a.empresa_user_id;
  return db.run(
    'INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)',
    [to, type, title, body, JSON.stringify({ project_id: a.project_id, empresa_id: a.empresa_id })]
  ).catch(() => {});
}
const who = (a) => (a.side === 'empresa' ? a.empresa_name : a.ngo_name);

/**
 * `side` acepta la versión `version`. En una transacción: guarda la aceptación solo si esa sigue siendo la vigente y
 * el acuerdo sigue `propuesto`; después lo cierra si las dos partes aceptaron la vigente (compare-and-swap: con dos
 * aceptaciones a la vez se cierra una sola vez). Devuelve 'closed' (lo cerró este pedido), 'accepted' (falta la otra
 * parte), 'stale' (versión vieja) o 'already_closed'. Lo usa también el PATCH de siempre de la ONG (routes/ngos.js).
 */
async function acceptVersion(empresaId, projectId, side, version, userId = null) {
  return db.transaction(async (tx) => {
    const set = await tx.run(
      `UPDATE empresa_voluntariados SET ${ACCEPT_COL[side]} = $1, updated_at = CURRENT_TIMESTAMP
       WHERE empresa_id = $2 AND project_id = $3 AND estado = 'propuesto' AND version = $1`,
      [version, empresaId, projectId]
    );
    if (set.changes === 0) {
      const row = await tx.get('SELECT estado FROM empresa_voluntariados WHERE empresa_id = $1 AND project_id = $2', [empresaId, projectId]);
      return row && row.estado === 'propuesto' ? 'stale' : 'already_closed';
    }
    await recordAcceptance(tx, empresaId, projectId, side, version, userId);
    const close = await tx.run(
      `UPDATE empresa_voluntariados SET estado = 'aceptado', updated_at = CURRENT_TIMESTAMP
       WHERE empresa_id = $1 AND project_id = $2 AND estado = 'propuesto'
         AND acepta_empresa_version = version AND acepta_ong_version = version`,
      [empresaId, projectId]
    );
    return close.changes === 1 ? 'closed' : 'accepted';
  });
}

const respond = async (req, res, status = 200) => {
  const fresh = await loadAgreement(db, req.agreement.empresa_id, req.agreement.project_id, req.user.id);
  res.status(status).json({ agreement: await formatAgreement(fresh) });
};

// ── POST /api/patrocinios/:empresaId/:projectId/aceptar ───────────────────
router.post('/:empresaId/:projectId/aceptar', requireAuth, agreementParty, async (req, res) => {
  try {
    const { version } = req.body || {};
    if (!Number.isInteger(version) || version < 1) return res.status(400).json({ error: 'version inválida' });
    const a = req.agreement;
    const result = await acceptVersion(a.empresa_id, a.project_id, a.side, version, req.user.id);
    if (result === 'already_closed') return res.status(409).json({ error: CLOSED });
    if (result === 'stale') return res.status(409).json({ error: STALE });
    if (result === 'closed') {
      await notifyOther(a, 'sponsorship_closed', `Acuerdo cerrado: "${a.titulo}"`, `${who(a)} aceptó y el patrocinio quedó acordado.`);
    } else {
      await notifyOther(a, 'sponsorship_accepted_by_other', `Acuerdo de "${a.titulo}"`, `${who(a)} aceptó esta versión. Falta que la aceptes vos.`);
    }
    await respond(req, res);
  } catch (err) {
    console.error('POST /patrocinios/aceptar error:', err);
    res.status(500).json({ error: 'Error al aceptar el acuerdo' });
  }
});

// ── POST /api/patrocinios/:empresaId/:projectId/rechazar ──────────────────
router.post('/:empresaId/:projectId/rechazar', requireAuth, agreementParty, async (req, res) => {
  try {
    const a = req.agreement;
    const { changes } = await db.run(
      `UPDATE empresa_voluntariados SET estado = 'rechazado', updated_at = CURRENT_TIMESTAMP
       WHERE empresa_id = $1 AND project_id = $2 AND estado = 'propuesto'`,
      [a.empresa_id, a.project_id]
    );
    if (changes === 0) return res.status(409).json({ error: CLOSED });
    await notifyOther(a, 'sponsorship_rejected', `Acuerdo de "${a.titulo}"`, `${who(a)} rechazó el acuerdo.`);
    await respond(req, res);
  } catch (err) {
    console.error('POST /patrocinios/rechazar error:', err);
    res.status(500).json({ error: 'Error al rechazar el acuerdo' });
  }
});

// ── POST /api/patrocinios/:empresaId/:projectId/mensajes ──────────────────
router.post('/:empresaId/:projectId/mensajes', requireAuth, agreementParty, async (req, res) => {
  try {
    const { body } = req.body || {};
    const error = checkText(body, { label: 'El mensaje', max: 1000, required: true });
    if (error) return res.status(400).json({ error });
    const a = req.agreement;
    // Solo con el acuerdo abierto: el INSERT … SELECT no escribe nada si ya se cerró (también en el medio).
    const ins = await db.run(
      `INSERT INTO patrocinio_mensajes (id, empresa_id, project_id, lado, autor_id, cuerpo, created_at)
       SELECT $1, empresa_id, project_id, $2, $3, $4, $5 FROM empresa_voluntariados
       WHERE empresa_id = $6 AND project_id = $7 AND estado = 'propuesto'`,
      [crypto.randomUUID(), a.side, req.user.id, body.trim(), new Date().toISOString(), a.empresa_id, a.project_id]
    );
    if (ins.changes === 0) return res.status(409).json({ error: CLOSED });
    await notifyOther(a, 'sponsorship_message', `Mensaje sobre "${a.titulo}"`, `${who(a)}: ${body.trim().slice(0, 120)}`);
    await respond(req, res, 201);
  } catch (err) {
    console.error('POST /patrocinios/mensajes error:', err);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

// ── GET /api/patrocinios/:empresaId/:projectId/historial (§324) ──────────
// Las versiones de la más nueva a la más vieja: los cambios de puntos de cada una (con quién y cuándo) y quién la
// aceptó. Solo las partes (agreementParty), también con el acuerdo cerrado. Los acuerdos de antes de §324 no tienen
// el historial previo.
const pointOf = (tipo, detalle, monto) =>
  (tipo == null ? null : { type: TYPE[tipo], detail: detalle, amount: monto == null ? null : Number(monto) });

router.get('/:empresaId/:projectId/historial', requireAuth, agreementParty, async (req, res) => {
  try {
    const a = req.agreement;
    const changes = await db.all(
      `SELECT c.version, c.accion, c.punto_id, c.lado, c.tipo_antes, c.detalle_antes, c.monto_antes,
              c.tipo_despues, c.detalle_despues, c.monto_despues, c.created_at, u.name AS autor_name
       FROM patrocinio_cambios c LEFT JOIN users u ON u.id = c.autor_id
       WHERE c.empresa_id = $1 AND c.project_id = $2 ORDER BY c.version, c.created_at, c.id`,
      [a.empresa_id, a.project_id]
    );
    const accepts = await db.all(
      `SELECT x.version, x.lado, x.created_at, u.name AS autor_name
       FROM patrocinio_aceptaciones x LEFT JOIN users u ON u.id = x.autor_id
       WHERE x.empresa_id = $1 AND x.project_id = $2 ORDER BY x.version, x.created_at, x.id`,
      [a.empresa_id, a.project_id]
    );
    const byVersion = new Map();
    const entry = (v) => {
      const n = Number(v);
      if (!byVersion.has(n)) byVersion.set(n, { version: n, side: null, author_name: null, created_at: null, changes: [], accepted_by: [] });
      return byVersion.get(n);
    };
    for (const c of changes) {
      const e = entry(c.version);
      if (e.changes.length === 0) Object.assign(e, { side: SIDE[c.lado], author_name: c.autor_name ?? null, created_at: c.created_at });
      e.changes.push({
        action: ACTION[c.accion], point_id: c.punto_id, side: SIDE[c.lado],
        before: pointOf(c.tipo_antes, c.detalle_antes, c.monto_antes),
        after: pointOf(c.tipo_despues, c.detalle_despues, c.monto_despues),
      });
    }
    for (const x of accepts) {
      const e = entry(x.version);
      if (e.created_at == null) e.created_at = x.created_at;   // una versión sin cambios (la propuesta): su primera aceptación
      e.accepted_by.push({ side: SIDE[x.lado], author_name: x.autor_name ?? null, accepted_at: x.created_at });
    }
    res.json({ versions: [...byVersion.values()].sort((p, q) => q.version - p.version) });
  } catch (err) {
    console.error('GET /patrocinios/historial error:', err);
    res.status(500).json({ error: 'Error al cargar el historial' });
  }
});

module.exports = router;
module.exports.acceptVersion = acceptVersion;
module.exports.recordAcceptance = recordAcceptance;
