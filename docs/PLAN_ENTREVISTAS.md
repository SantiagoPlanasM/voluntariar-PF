# PLAN_ENTREVISTAS.md — Entrevistas de la ONG con quienes se postulan (2026-10-29)

> **Estado:** plan, sin código todavía. Decisión del usuario del 2026-10-29: "agendar ante una postulación". Va
> **después** de `PLAN_PATROCINIO.md`. Lo hecho se registra en `PROJECT_ANALYSIS.md`.

## Qué hay hoy
- Una postulación (`enrollments`) está en `pending`, `approved`, `rejected` o `cancelled`. La ONG dueña la aprueba o
  rechaza con `PATCH /api/enrollments/:id`; el voluntario la ve en "Mis voluntariados" (`MyParticipation.tsx`) y
  puede cancelarla.
- La tabla `reuniones` existe desde el primer esquema y **ningún endpoint la usa**: `user_id`, `project_id`, `fecha`,
  `horario`, `link`, `estado` (`programada`/`realizada`/`cancelada`), `empleado_id` (de la ONG, opcional).
- `DESIGN.md` 1.1 sacó el chip "Entrevista" de las postulaciones porque el backend no lo tenía.

## Cómo funcionaría
1. En una postulación **pendiente**, la ONG toca **"Agendar entrevista"**: fecha, hora, modalidad (link o lugar) y
   una nota opcional. La postulación sigue `pending`: la entrevista no es un estado de `enrollments`, es una
   `reunion` atada a la postulación.
2. El voluntario recibe aviso (app y mail) y en "Mis voluntariados" ve el chip **"Entrevista"** con la fecha, la hora y
   el link o el lugar.
3. La ONG puede **reprogramarla** o **cancelarla** (con aviso) y, pasada la fecha, marcarla **realizada**.
4. Después aprueba o rechaza la postulación **como hoy**. La entrevista no es obligatoria para aprobar (decisión del
   usuario: no cambiar el flujo de aprobación).
5. Si la postulación se cancela, se rechaza o se aprueba, la entrevista programada se cancela sola (en la misma
   transacción, `tx.*`).

## Reglas
- Una sola entrevista **programada** por postulación a la vez (índice único parcial o control en la transacción, en
  los dos motores; probarlo con dos pedidos simultáneos, regla 21).
- Fecha y hora futuras al agendar o reprogramar; fechas sin hora con `formatDateOnly` en el frontend y comparaciones
  con `toMillis()` en el backend (las trampas de fechas del `CLAUDE.md`).
- Solo la ONG dueña del proyecto (por `JOIN` a `projects.ngo_id`) agenda, reprograma, cancela o marca realizada; el
  voluntario solo ve las suyas. El link se valida como URL `https:`.

## Modelo de datos (aditivo, en `migrate.js`)
- `reuniones`: agregar `enrollment_id` (FK a `enrollments`, `ON DELETE CASCADE`), `lugar` y `nota` (texto corto) y
  `updated_at`. `user_id` y `project_id` quedan (los llena el backend desde la postulación, nunca el cliente).

## API (borrador)
- `POST /api/enrollments/:id/entrevista` — agendar (ONG dueña, postulación `pending`).
- `PATCH /api/enrollments/:id/entrevista` — reprogramar, cancelar o marcar realizada.
- `GET /api/enrollments/project/:projectId` y `GET /api/enrollments/my` suman `interview: { date, time, link,
  place, note, status } | null`.

## Frontend (borrador)
- Panel de la ONG, postulaciones del voluntariado: botón "Agendar entrevista" en cada pendiente, con un formulario
  chico (modal), y la entrevista agendada visible en la fila con "Reprogramar · Cancelar · Marcar realizada".
- "Mis voluntariados": chip "Entrevista" (vuelve el de `DESIGN.md`) con fecha, hora, link o lugar.

## Orden
1. Backend: agendar, ver, reprogramar, cancelar, realizada y la cancelación automática (tests rojo → verde en SQLite,
   Postgres y TZ Córdoba; mutación del código nuevo).
2. Frontend: panel de la ONG y "Mis voluntariados".
3. Docs (`API_CONTEXT`, `DATABASE_CONTEXT`, `FRONTEND_CONTEXT`, `DESIGN.md` por el chip) y deploy.

**Congelamiento:** del 3/11 al 5/11 no se despliega nada (igual que en `PLAN_PATROCINIO.md`).

## ⚠️ Lo que no se va a poder verificar
- La pantalla real y los mails reales (Resend con dobles).
- Recordatorios automáticos el día antes: quedan fuera (necesitan una tarea programada que hoy no hay en Render free).
