# AI_RULES.md — Reglas para trabajar sobre VoluntariAR

> Obligatorias para cualquier IA o persona que modifique el código. Leer junto con `PROJECT_CONTEXT.md`. Si un pedido
> choca con una regla, avisar antes de seguir. Los números se citan como "regla N": no renumerar. Versión larga, con
> la historia de cada regla: `archivo/contexto-2026-10-30/AI_RULES.md`.

## Base

1. **Entender el flujo completo antes de tocar.** Para un endpoint: su ruta en `API_CONTEXT.md`, sus tablas en `DATABASE_CONTEXT.md` y las pantallas que lo usan en `FRONTEND_CONTEXT.md`. Hay lógica repartida (validaciones en los dos lados, mapeo español↔inglés).
2. **No romper la API.** El frontend depende de los nombres exactos de `fmt()`/`fmtNgo()`. Cambiar un campo sin actualizar su `interface` en `frontend/src/lib/api.ts` rompe la UI en silencio: no hay contrato compartido.
3. **Evitar duplicación.** Antes de escribir una validación o helper, buscar si ya existe en el otro lado de la pila. No sumar duplicación sin una razón explícita.
4. **Reutilizar helpers.** Backend: `db.query/run/get/all` del adaptador (`src/db/index.js`), nunca conexiones nuevas; para formatear un proyecto, importar `fmt` de `routes/projects.js`, no copiarlo. Frontend: todo HTTP por `lib/api.ts`, nunca `fetch()` directo.
5. **Refactorizar solo si se pide o si el cambio lo amerita**, nunca código ajeno a la tarea. Un refactor grande se documenta antes de hacerlo.
6. **Tipado consistente.** Todo campo nuevo del backend va a su `interface` de `api.ts` con el tipo correcto. Sin `any`.
7. **Una sola representación de cada modelo:** forma en `migrate.js`, mapeo en `fmt()`/`fmtNgo()`, contrato en `api.ts`. Un cambio de forma toca los tres.
8. **Sin `SELECT *` en endpoints públicos.** `fmt`/`fmtNgo`/`fmtEmpresa` son listas blancas (nunca `...fila`) y las subconsultas nombran sus columnas. `test/integration/public-columns.test.js` agrega una columna "secreta" a cada tabla y verifica que ningún endpoint público la devuelva: un endpoint público nuevo se suma a ese test.
9. **Documentar en el mismo cambio** toda decisión de arquitectura (`DATABASE_CONTEXT.md`, `API_CONTEXT.md`, etc.).
10. **Consistencia frontend↔backend verificada con grep**, no solo leyendo: el campo que manda el frontend tiene que coincidir con el que destructura `req.body` (ya pasó con `message`/`mensaje`). Dos endpoints que devuelven el mismo recurso tienen que dar la misma forma.

## Específicas del proyecto

11. **DB en español, API y frontend en inglés.** Ante la duda, seguir la tabla más parecida.
12. **Esquema aditivo.** Tabla nueva: `CREATE TABLE IF NOT EXISTS`. Columna nueva: `addColumnIfNotExists(tabla, columna, definición)`, nunca un `ALTER TABLE` suelto. Comentar en `migrate.js` qué migración es y cuándo se agregó.
13. **Toda query funciona en SQLite y Postgres**, o documenta por qué se bifurca. Antes de usar algo propio de Postgres, confirmar que `translatePg()` lo traduce. En Postgres los agregados (`SUM`/`COUNT`/`AVG`) llegan como string: `Number(x) || 0`. Las fechas son string en SQLite y `Date` en Postgres: nada de métodos de string, usar `toMillis()` (`src/lib/time.js`). BOOLEAN se compara con `true`/`false`, nunca `1`/`0`. `ON CONFLICT ... DO NOTHING` anda igual en los dos.
14. **No asumir que una tabla tiene API:** revisar `API_CONTEXT.md` ("Tablas sin API"). Lo que no tiene API se construye desde cero, no se "arregla".
15. **La autorización vive en el backend** (`requireRole`, dueño, `ngoAccess`); las guardas de la UI son cosméticas. Todo endpoint con control de dueño suma su caso a `test/integration/ownership.test.js`: el ajeno es rechazado, la base no cambia y el dueño puede con los mismos ids.
16. **Antes de "corregir" un bug documentado como pendiente**, preguntar al usuario si va en esta tarea.
17. **Secretos:** el de los JWT sale solo de `src/lib/jwtSecret.js` (`resolveJwtSecret`): obligatorio en producción; en dev y tests, `voluntariar_dev_secret`. Nunca `process.env.JWT_SECRET || ...` en otro archivo (un test lo controla). No hardcodear secretos nuevos.
18. **Sin ORMs, estado global (Redux/Zustand) ni librerías de fetching (React Query)** salvo pedido explícito.
19. **Errores para el usuario en español**, como `{ error: "..." }`, sin jerga ni stack traces.
20. **Invariante `cupos_ocupados <= cupos`** (no hay `CHECK` en la base): al tocar `enrollments.js` o los cupos de `projects.js`, verificarla. La imponen el alta y la aprobación (`UPDATE ... WHERE cupos_ocupados < cupos`) y `PUT /api/projects/:id` (`WHERE cupos_ocupados <= $n`).
21. **Lo que deja varias filas consistentes va en `db.transaction()`**, con `tx.*` adentro (nunca `db.*`: el adaptador lo rechaza). Contra la doble aplicación en `READ COMMITTED`: `UPDATE` atómico (`SET n = n + 1`) o compare-and-swap (`WHERE estado = $viejo` y mirar `changes`). Emails, notificaciones y llamadas externas, **después** del COMMIT. Un `INSERT` que puede chocar con un `UNIQUE` en paralelo se protege con `isUniqueViolation(err)` (`src/lib/dbErrors.js`) → **409**, nunca 500.
22. **Cambios de queries, tipos, concurrencia o adaptador se prueban también con `npm run test:pg`:** SQLite no reproduce carreras ni diferencias de tipos.
23. **Altas: id con `crypto.randomUUID()`, insertar y releer por id.** Nunca "la última fila por `created_at`" (en SQLite tiene resolución de 1 s). Los tests de altas corren también en SQLite.
24. **Subidas de archivos, en este orden:** (a) sesión y rol antes de leer el cuerpo; (b) validar todo (campos, permisos, límites y la **cabecera real** del archivo, no el `mimetype` declarado) antes de subir; (c) Cloudinary fuera de `db.transaction()`, y la fila y sus archivos se guardan juntos después; (d) si algo falla, borrar lo subido; (e) no exponer `provider_id` ni el secreto; (f) `storage.*` por propiedad, no desestructurado. Los tests nunca suben nada.
