// src/routes/enrollments.js
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../lib/email');
const {
  newEnrollmentEmail, enrollmentApprovedEmail, enrollmentRejectedEmail, interviewScheduledEmail,
} = require('../lib/emailTemplates');
const { isUniqueViolation } = require('../lib/dbErrors');
const { checkText, firstError, parsePhone } = require('../lib/inputs');
const { projectAccess, canManageEnrollments, managedNgoOfEnrollment } = require('../lib/ngoAccess');
const crypto = require('node:crypto');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Libera un cupo sin dejar el contador en negativo (CASE WHEN: compatible SQLite y PG).
const RELEASE_SLOT_SQL = `UPDATE projects SET cupos_ocupados =
          CASE WHEN cupos_ocupados > 0 THEN cupos_ocupados - 1 ELSE 0 END
         WHERE id=$1`;

// Se lanza DENTRO de una transacción para forzar el ROLLBACK cuando ya no quedan cupos
// (un simple `return` haría COMMIT del cambio de estado de la inscripción).
class NoCapacityError extends Error {}

const router = express.Router();

// Estado en inglés en la API (regla 11); en la base, en español.
const INTERVIEW_STATUS = { programada: 'scheduled', realizada: 'done', cancelada: 'cancelled' };
const fmtInterview = (r) => ({
  id: r.id, enrollment_id: r.enrollment_id, date: r.fecha, time: r.horario,
  link: r.link, place: r.lugar, note: r.nota, status: INTERVIEW_STATUS[r.estado],
});

// La entrevista que muestran las listas de postulaciones (§261): la programada si hay; si no, la última. Subconsulta
// por id (no LATERAL) para que ande igual en SQLite y en Postgres.
const INTERVIEW_COLS = `r.id AS i_id, r.fecha AS i_fecha, r.horario AS i_horario, r.link AS i_link, r.lugar AS i_lugar,
              r.nota AS i_nota, r.estado AS i_estado`;
const INTERVIEW_JOIN = `LEFT JOIN reuniones r ON r.id = (
         SELECT r2.id FROM reuniones r2 WHERE r2.enrollment_id = e.id
         ORDER BY CASE WHEN r2.estado = 'programada' THEN 0 ELSE 1 END, r2.created_at DESC, r2.id DESC LIMIT 1)`;
/** Saca las columnas i_* de la fila y las devuelve como `interview` (o null). */
function withInterview({ i_id, i_fecha, i_horario, i_link, i_lugar, i_nota, i_estado, ...row }) {
  const interview = i_id ? fmtInterview({ id: i_id, enrollment_id: row.id, fecha: i_fecha, horario: i_horario,
    link: i_link, lugar: i_lugar, nota: i_nota, estado: i_estado }) : null;
  return { ...row, interview };
}

// Tope de horas cargables a una inscripción: holgado (unas 40 h semanales durante 5 años), solo para
// rechazar valores absurdos o mal tipeados.
const MAX_HORAS = 10000;

// ── POST /api/enrollments ─────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('volunteer'), async (req, res) => {
  try {
    const { project_id, message } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id requerido' });
    const phone = parsePhone(req.body.phone);   // §291: opcional
    if (phone.error) return res.status(400).json({ error: phone.error });

    const project = await db.get(
      'SELECT id, titulo, cupos, cupos_ocupados FROM projects WHERE id=$1 AND status=$2',
      [project_id, 'active']
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado o inactivo' });

    if (project.cupos_ocupados >= project.cupos)
      return res.status(409).json({ error: 'El proyecto no tiene cupos disponibles' });

    // Verificar duplicado antes de insertar (evita race condition parcial)
    const already = await db.get(
      'SELECT id FROM enrollments WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    if (already) return res.status(409).json({ error: 'Ya estás inscripto en este proyecto' });

    await db.run(
      `INSERT INTO enrollments (user_id, project_id, status, mensaje, telefono)
       VALUES ($1,$2,'pending',$3,$4)`,
      [req.user.id, project_id, message || null, phone.value]
    );

    const enrollment = await db.get(
      `SELECT id, user_id, project_id, status, mensaje AS message, telefono AS phone,
              horas_realizadas, created_at, updated_at
       FROM enrollments WHERE user_id=$1 AND project_id=$2`,
      [req.user.id, project_id]
    );

    // Notificar a la ONG (in-app + email)
    const ngo = await db.get(
      `SELECT u.id, u.email, u.name AS user_name, n.nombre AS ngo_name
       FROM projects p
       JOIN ngos n ON n.id = p.ngo_id
       JOIN users u ON u.id = n.user_id
       WHERE p.id = $1`, [project_id]
    );
    if (ngo) {
      await db.run(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1,'new_enrollment','Nueva solicitud de inscripción',$2,$3)`,
        [ngo.id,
         `${req.user.name} quiere unirse a "${project.titulo}"`,
         JSON.stringify({ project_id, user_id: req.user.id })]
      ).catch(() => {}); // no bloquear si falla la notif

      const { subject, html } = newEnrollmentEmail({
        ngoName: ngo.ngo_name, volunteerName: req.user.name,
        projectTitle: project.titulo, projectId: project_id, appUrl: APP_URL,
      });
      sendEmail({ to: ngo.email, subject, html }).catch(() => {}); // fire-and-forget, no bloquea la respuesta
    }

    res.status(201).json({ enrollment, message: 'Inscripción enviada. Pendiente de aprobación.' });
  } catch (err) {
    // Manejar constraint UNIQUE a nivel de BD (race condition)
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Ya estás inscripto en este proyecto' });
    }
    console.error('POST /enrollments error:', err);
    res.status(500).json({ error: 'Error al inscribirse' });
  }
});

// ── GET /api/enrollments/my ───────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
  try {
    const enrollments = await db.all(
      `SELECT e.id, e.user_id, e.project_id, e.status, e.mensaje AS message, e.telefono AS phone,
              e.horas_realizadas AS hours_logged, e.created_at, e.updated_at,
              p.titulo AS title, p.foto_perfil AS image, p.tipo AS type,
              p.ubicacion AS location, p.status AS project_status,
              n.nombre AS ngo_name, n.foto_perfil AS ngo_logo,
              COALESCE(c.nombre, '') AS category,
              ${INTERVIEW_COLS}
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       JOIN ngos n ON n.id = p.ngo_id
       LEFT JOIN project_categorias pc ON pc.project_id = p.id
       LEFT JOIN categorias c ON c.id = pc.categoria_id
       ${INTERVIEW_JOIN}
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ enrollments: enrollments.map(withInterview) });
  } catch (err) {
    console.error('GET /enrollments/my error:', err);
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// ── GET /api/enrollments/project/:projectId ───────────────────────────────
// La ONG dueña o un coordinador activo de su equipo (§295).
router.get('/project/:projectId', requireAuth, requireRole('ngo', 'volunteer'), async (req, res) => {
  try {
    const pa = await projectAccess(req.user.id, req.params.projectId);
    if (!pa || !canManageEnrollments(pa.access)) return res.status(403).json({ error: 'Sin permiso sobre este proyecto' });

    const { status } = req.query;
    let sql = `
      SELECT e.id, e.user_id, e.project_id, e.status, e.mensaje AS message, e.telefono AS phone,
             e.horas_realizadas AS hours_logged, e.created_at, e.updated_at,
             u.name AS volunteer_name, u.email AS volunteer_email,
             u.avatar AS volunteer_avatar, u.bio AS volunteer_bio,
             v.cv_url, ${INTERVIEW_COLS}
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN voluntarios v ON v.user_id = e.user_id
      ${INTERVIEW_JOIN}
      WHERE e.project_id = $1
    `;
    const params = [req.params.projectId];
    if (status) { sql += ' AND e.status = $2'; params.push(status); }
    sql += ' ORDER BY e.created_at DESC';

    // has_cv (§168): true solo si la ONG puede abrir el CV con GET /api/voluntarios/:userId/cv (inscripción
    // pendiente o aprobada, §165). cv_url es el public_id de un PDF privado: no sale de acá. El teléfono (§291), con el
    // mismo criterio: rechazada o cancelada, null.
    const enrollments = (await db.all(sql, params)).map(withInterview).map(({ cv_url, ...e }) => {
      const open = e.status === 'pending' || e.status === 'approved';
      return { ...e, phone: open ? e.phone : null, has_cv: Boolean(cv_url) && open };
    });
    res.json({ enrollments });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener inscripciones' });
  }
});

// ── PATCH /api/enrollments/:id ────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('ngo', 'volunteer'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Status debe ser: approved o rejected' });

    // §295: el dueño o un coordinador activo de la ONG de esta postulación (lib/ngoAccess).
    const ngo = { id: await managedNgoOfEnrollment(req.user.id, req.params.id) };
    const enrollment = await db.get(
      `SELECT e.*, p.titulo, p.ngo_id, u.email AS volunteer_email, u.name AS volunteer_name,
              n.nombre AS ngo_name
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       JOIN ngos n ON n.id = p.ngo_id
       JOIN users u ON u.id = e.user_id
       WHERE e.id = $1 AND p.ngo_id = $2`,
      [req.params.id, ngo?.id]
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada o sin permiso' });

    const oldStatus = enrollment.status;
    const doneMessage = `Inscripción ${status === 'approved' ? 'aprobada' : 'rechazada'}`;

    // Idempotente: pedir el estado que ya tiene no cambia nada — ni el cupo, ni
    // notificación/email duplicados (antes cada re-aprobación mandaba otro email).
    if (oldStatus === status) return res.json({ message: doneMessage });

    // Estado + cupo en UNA transacción (antes eran queries sueltas: una falla a
    // mitad dejaba el contador desincronizado). El UPDATE es un compare-and-swap:
    // solo aplica si el estado sigue siendo el que leímos arriba. Sin esto, dos
    // requests concurrentes (doble click, reintento) leen el mismo `oldStatus` y
    // suman/restan el cupo dos veces — bug propio de Postgres (pool de conexiones).
    // Notificaciones y emails van DESPUÉS del COMMIT: son "best effort" y una query
    // fallida dentro de una transacción de Postgres la aborta entera.
    const outcome = await db.transaction(async (tx) => {
      const swap = await tx.run(
        'UPDATE enrollments SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND status=$3',
        [status, req.params.id, oldStatus]
      );
      if (swap.changes === 0) return 'stale';

      if (status === 'approved' && oldStatus !== 'approved') {
        // Cupo condicional y atómico: solo suma si todavía queda lugar. Impone la invariante
        // cupos_ocupados <= cupos (AI_RULES regla 20), que antes no se verificaba al aprobar:
        // el alta ya devolvía 409 con el proyecto lleno, pero como `cupos_ocupados` cuenta solo
        // aprobadas, podían acumularse pendientes y la ONG las aprobaba por encima del tope.
        // Sin leer-y-después-escribir: en Postgres, dos aprobaciones simultáneas con un solo
        // cupo libre se serializan sobre la fila del proyecto y la segunda ve 0 filas afectadas.
        const slot = await tx.run(
          'UPDATE projects SET cupos_ocupados = cupos_ocupados + 1 WHERE id=$1 AND cupos_ocupados < cupos',
          [enrollment.project_id]
        );
        if (slot.changes === 0) throw new NoCapacityError(); // → ROLLBACK: la inscripción sigue pendiente
      } else if (status === 'rejected' && oldStatus === 'approved') {
        await tx.run(RELEASE_SLOT_SQL, [enrollment.project_id]);
      }
      // Decidida la postulación, una entrevista que seguía programada ya no va (§261); la realizada queda.
      await tx.run(
        `UPDATE reuniones SET estado='cancelada', updated_at=CURRENT_TIMESTAMP WHERE enrollment_id=$1 AND estado='programada'`,
        [req.params.id]
      );
      return 'applied';
    }).catch((err) => {
      if (err instanceof NoCapacityError) return 'full';
      throw err;
    });

    if (outcome === 'full') {
      return res.status(409).json({ error: 'El proyecto no tiene cupos disponibles' });
    }

    if (outcome === 'stale') {
      // Otro request cambió el estado entre mi lectura y mi UPDATE.
      const current = await db.get('SELECT status FROM enrollments WHERE id=$1', [req.params.id]);
      if (current?.status === status) return res.json({ message: doneMessage }); // ya lo aplicó otro: nada que hacer
      return res.status(409).json({ error: 'La inscripción cambió mientras la revisabas. Actualizá la pantalla e intentá de nuevo.' });
    }

    // Notificar al voluntario
    const notifTitle = status === 'approved'
      ? `¡Inscripción aprobada en "${enrollment.titulo}"!`
      : `Inscripción no seleccionada en "${enrollment.titulo}"`;

    await db.run(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1,$2,$3,$4,$5)`,
      [enrollment.user_id,
       status === 'approved' ? 'enrollment_approved' : 'enrollment_rejected',
       notifTitle,
       status === 'approved'
         ? 'Ya podés ver los detalles en "Mis participaciones".'
         : 'Gracias por tu interés. Seguí explorando otros proyectos.',
       JSON.stringify({ project_id: enrollment.project_id })]
    ).catch(() => {});

    const templateFn = status === 'approved' ? enrollmentApprovedEmail : enrollmentRejectedEmail;
    const { subject, html } = templateFn({
      volunteerName: enrollment.volunteer_name, projectTitle: enrollment.titulo,
      ngoName: enrollment.ngo_name, appUrl: APP_URL,
    });
    sendEmail({ to: enrollment.volunteer_email, subject, html }).catch(() => {});

    res.json({ message: doneMessage });
  } catch (err) {
    console.error('PATCH /enrollments/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar inscripción' });
  }
});

// ── DELETE /api/enrollments/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const enrollment = await db.get(
      'SELECT * FROM enrollments WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada' });

    // Borrar + liberar el cupo en UNA transacción. El DELETE exige que el estado siga
    // siendo el leído arriba: si cambió (p. ej. la ONG la aprobó justo ahora) el
    // decremento sería incorrecto; y si ya no existe (doble click), no se decrementa
    // de nuevo — antes cada request repetido restaba un cupo de más.
    const outcome = await db.transaction(async (tx) => {
      const del = await tx.run(
        'DELETE FROM enrollments WHERE id=$1 AND user_id=$2 AND status=$3',
        [req.params.id, req.user.id, enrollment.status]
      );
      if (del.changes === 0) {
        const still = await tx.get('SELECT 1 AS x FROM enrollments WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
        return still ? 'stale' : 'gone';
      }
      if (enrollment.status === 'approved') await tx.run(RELEASE_SLOT_SQL, [enrollment.project_id]);
      return 'deleted';
    });

    if (outcome === 'gone') return res.status(404).json({ error: 'Inscripción no encontrada' });
    if (outcome === 'stale') return res.status(409).json({ error: 'La inscripción cambió mientras la cancelabas. Actualizá la pantalla e intentá de nuevo.' });

    res.json({ message: 'Inscripción cancelada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar' });
  }
});

// ── Entrevistas (§261, docs/archivo/PLAN_ENTREVISTAS.md) ──────────────────────────
// Una entrevista es una fila de `reuniones` atada a la postulación. La fecha y la hora son las de Argentina
// (UTC-3 todo el año, sin horario de verano): "futura" se compara contra ese instante.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida fecha, hora, link, lugar y nota del body. Devuelve { error } o { value } (textos vacíos → null). */
function parseInterview({ date, time, link, place, note }) {
  const realDate = typeof date === 'string' && DATE_RE.test(date)
    && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date); // descarta 2030-02-30
  if (!realDate) return { error: 'La fecha tiene que ser AAAA-MM-DD' };
  if (typeof time !== 'string' || !TIME_RE.test(time)) return { error: 'La hora tiene que ser HH:MM' };
  if (Date.parse(`${date}T${time}:00-03:00`) <= Date.now()) return { error: 'La entrevista tiene que ser en el futuro' };
  const error = firstError(
    checkText(link, { label: 'El link', max: 500 }),
    checkText(place, { label: 'El lugar', max: 200 }),
    checkText(note, { label: 'La nota', max: 500 }),
  );
  if (error) return { error };
  const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const value = { date, time, link: clean(link), place: clean(place), note: clean(note) };
  if (!value.link && !value.place) return { error: 'Indicá un link o un lugar para la entrevista' };
  if (value.link && !value.link.startsWith('https://')) return { error: 'El link tiene que empezar con https://' };
  return { value };
}

// ── POST /api/enrollments/:id/entrevista ──────────────────────────────────
router.post('/:id/entrevista', requireAuth, requireRole('ngo', 'volunteer'), async (req, res) => {
  try {
    const { error, value } = parseInterview(req.body || {});
    if (error) return res.status(400).json({ error });

    // §295: el dueño o un coordinador activo de la ONG de esta postulación (lib/ngoAccess).
    const ngo = { id: await managedNgoOfEnrollment(req.user.id, req.params.id) };
    const enrollment = await db.get(
      `SELECT e.id, e.user_id, e.project_id, e.status, p.titulo, n.nombre AS ngo_name,
              u.email AS volunteer_email, u.name AS volunteer_name
       FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       JOIN ngos n ON n.id = p.ngo_id
       JOIN users u ON u.id = e.user_id
       WHERE e.id = $1 AND p.ngo_id = $2`,
      [req.params.id, ngo?.id]
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción no encontrada o sin permiso' });

    // Inserta solo si la postulación SIGUE pendiente (si la aprobaron entre la lectura y acá, no entra nada); el
    // índice único parcial deja una sola programada aunque lleguen dos pedidos a la vez.
    const id = crypto.randomUUID();
    const ins = await db.run(
      `INSERT INTO reuniones (id, enrollment_id, user_id, project_id, fecha, horario, link, lugar, nota)
       SELECT $1, e.id, e.user_id, e.project_id, $2, $3, $4, $5, $6
       FROM enrollments e WHERE e.id = $7 AND e.status = 'pending'`,
      [id, value.date, value.time, value.link, value.place, value.note, enrollment.id]
    );
    if (ins.changes === 0)
      return res.status(409).json({ error: 'Solo se puede agendar una entrevista con la postulación pendiente' });
    const interview = fmtInterview(await db.get('SELECT * FROM reuniones WHERE id=$1', [id]));

    const [y, m, d] = value.date.split('-');
    await db.run(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,'interview_scheduled',$2,$3,$4)`,
      [enrollment.user_id, `Entrevista para "${enrollment.titulo}"`,
       `${enrollment.ngo_name} te propone una entrevista el ${d}/${m}/${y} a las ${value.time}.`,
       JSON.stringify({ project_id: enrollment.project_id, enrollment_id: enrollment.id })]
    ).catch(() => {});
    const { subject, html } = interviewScheduledEmail({
      volunteerName: enrollment.volunteer_name, projectTitle: enrollment.titulo, ngoName: enrollment.ngo_name,
      ...value, appUrl: APP_URL,
    });
    sendEmail({ to: enrollment.volunteer_email, subject, html }).catch(() => {});

    res.status(201).json({ interview });
  } catch (err) {
    if (isUniqueViolation(err))
      return res.status(409).json({ error: 'Ya hay una entrevista programada para esta postulación' });
    console.error('POST /enrollments/:id/entrevista error:', err);
    res.status(500).json({ error: 'Error al agendar la entrevista' });
  }
});

// ── PATCH /api/enrollments/:id/entrevista ─────────────────────────────────
// Sobre la entrevista PROGRAMADA de la postulación: { status: 'cancelled' } la cancela, { status: 'done' } la marca
// realizada (si ya pasó), y sin status la reprograma con los mismos datos y validaciones que el alta.
router.patch('/:id/entrevista', requireAuth, requireRole('ngo', 'volunteer'), async (req, res) => {
  try {
    const body = req.body || {};
    const { status } = body;
    if (status !== undefined && !['cancelled', 'done'].includes(status))
      return res.status(400).json({ error: 'status tiene que ser cancelled o done' });
    let value;
    if (status === undefined) {
      const parsed = parseInterview(body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      value = parsed.value;
    }

    // §295: el dueño o un coordinador activo de la ONG de esta postulación (lib/ngoAccess).
    const ngo = { id: await managedNgoOfEnrollment(req.user.id, req.params.id) };
    const current = await db.get(
      `SELECT r.*, p.titulo, n.nombre AS ngo_name
       FROM reuniones r
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN projects p ON p.id = e.project_id
       JOIN ngos n ON n.id = p.ngo_id
       WHERE r.enrollment_id = $1 AND r.estado = 'programada' AND p.ngo_id = $2`,
      [req.params.id, ngo?.id]
    );
    if (!current) return res.status(404).json({ error: 'No hay una entrevista programada para esta postulación' });
    if (status === 'done' && Date.parse(`${current.fecha}T${current.horario}:00-03:00`) > Date.now())
      return res.status(409).json({ error: 'La entrevista todavía no pasó' });

    // Compare-and-swap sobre el estado: si otro pedido la cambió en el medio, no se pisa.
    const swap = status === undefined
      ? await db.run(
        `UPDATE reuniones SET fecha=$1, horario=$2, link=$3, lugar=$4, nota=$5, updated_at=CURRENT_TIMESTAMP
         WHERE id=$6 AND estado='programada'`,
        [value.date, value.time, value.link, value.place, value.note, current.id])
      : await db.run(
        `UPDATE reuniones SET estado=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND estado='programada'`,
        [status === 'done' ? 'realizada' : 'cancelada', current.id]);
    if (swap.changes === 0)
      return res.status(409).json({ error: 'La entrevista cambió mientras la editabas. Actualizá la pantalla.' });
    const interview = fmtInterview(await db.get('SELECT * FROM reuniones WHERE id=$1', [current.id]));

    if (status !== 'done') {
      const [y, m, d] = interview.date.split('-');
      const [type, text] = status === 'cancelled'
        ? ['interview_cancelled', `${current.ngo_name} canceló la entrevista por "${current.titulo}".`]
        : ['interview_rescheduled', `${current.ngo_name} cambió la entrevista: ${d}/${m}/${y} a las ${interview.time}.`];
      await db.run(
        `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)`,
        [current.user_id, type, `Entrevista para "${current.titulo}"`, text,
         JSON.stringify({ project_id: current.project_id, enrollment_id: req.params.id })]
      ).catch(() => {});
    }
    res.json({ interview });
  } catch (err) {
    console.error('PATCH /enrollments/:id/entrevista error:', err);
    res.status(500).json({ error: 'Error al actualizar la entrevista' });
  }
});

// ── PATCH /api/enrollments/:id/horas ─────────────────────────────────────
// Carga/edita las horas cumplidas por un voluntario. Lo hace la ONG dueña
// del proyecto (no el propio voluntario) — son horas *verificadas*, no un
// auto-reporte; si el voluntario pudiera cargarlas él mismo no habría forma
// de confiar en el dato para las estadísticas del proyecto.
router.patch('/:id/horas', requireAuth, requireRole('ngo', 'volunteer'), async (req, res) => {
  try {
    const { horas } = req.body;
    // Número finito entre 0 y MAX_HORAS (también como string numérico, p. ej. "7.5"). Antes era parseFloat +
    // isNaN: "1e400" (o 1e400 en el JSON) pasaba como Infinity y rompía los totales, y "12abc" se guardaba
    // como 12 en silencio (REVISION B14).
    const h = typeof horas === 'number' ? horas
      : typeof horas === 'string' && horas.trim() !== '' ? Number(horas) : Number.NaN;
    if (!Number.isFinite(h) || h < 0 || h > MAX_HORAS)
      return res.status(400).json({ error: `Las horas tienen que ser un número entre 0 y ${MAX_HORAS}` });

    // §295: el dueño o un coordinador activo de la ONG de esta postulación (lib/ngoAccess).
    const ngo = { id: await managedNgoOfEnrollment(req.user.id, req.params.id) };
    const enrollment = await db.get(
      `SELECT e.* FROM enrollments e
       JOIN projects p ON p.id = e.project_id
       WHERE e.id=$1 AND p.ngo_id=$2 AND e.status='approved'`,
      [req.params.id, ngo?.id]
    );
    if (!enrollment) return res.status(404).json({ error: 'Inscripción aprobada no encontrada o sin permiso' });

    await db.run(
      'UPDATE enrollments SET horas_realizadas=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
      [h, req.params.id]
    );
    res.json({ message: 'Horas registradas', horas: h });
  } catch (err) {
    console.error('PATCH /enrollments/:id/horas error:', err);
    res.status(500).json({ error: 'Error al registrar horas' });
  }
});

module.exports = router;
// La entrevista de cada postulación, para otras listas (el panel de la ONG, §279): la misma consulta, sin copiarla.
module.exports.INTERVIEW_COLS = INTERVIEW_COLS;
module.exports.INTERVIEW_JOIN = INTERVIEW_JOIN;
module.exports.withInterview = withInterview;
