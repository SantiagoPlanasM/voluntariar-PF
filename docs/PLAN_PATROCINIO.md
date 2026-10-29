# PLAN_PATROCINIO.md — El patrocinio como acuerdo negociado (2026-10-29)

> **Estado (2026-10-29):** etapas 1 (§263: puntos y versión) y 2 (§264: charla y aceptación por versión) hechas, sin desplegar; faltan la 3 (pantalla) y la 4 (público). Decisiones del usuario del 2026-10-29. Lo hecho se registra en
> `PROJECT_ANALYSIS.md`; este documento solo ordena el trabajo. Las entrevistas para ONG van después, en otro plan.

## Qué hay hoy (§26, §33, §77, §140, §153)
- La empresa propone patrocinar un voluntariado activo (`POST /api/empresas/me/patrocinios`, con `mensaje` opcional)
  y puede retirar la propuesta mientras está en `propuesto`. La ONG acepta o rechaza (`PATCH
  /api/ngos/me/patrocinios/:empresaId/:projectId`), una sola vez. Las dos partes reciben aviso en la app y por mail.
- Tabla `empresa_voluntariados` (PK `empresa_id, project_id`): `aporte` (nadie lo escribe), `estado`
  (`propuesto`/`aceptado`/`rechazado`), `mensaje`, `created_at`, `updated_at`.
- No se ve en ningún lado público: el perfil de la empresa dice "Los voluntariados que patrocina se van a ver acá
  próximamente" (`CompanyPublicProfile.tsx`) y el detalle del voluntariado no nombra al patrocinador.

## Decisiones del usuario (2026-10-29)
1. El patrocinio pasa a ser un **acuerdo que se negocia**: la empresa y la ONG cargan **puntos** (a la izquierda lo
   que aporta la empresa; a la derecha lo que pide u ofrece la ONG), los editan antes de aceptar y **se hablan dentro
   del acuerdo** (no por el chat 1 a 1).
2. **El dinero entra, pero no se ve en público.** Un punto de tipo `dinero` lleva monto (en pesos), visible solo para
   la empresa y la ONG del acuerdo. Al cerrarse, en público se muestra solo "Patrocinado por X": ni puntos ni montos.
3. **Pagar el patrocinio por Mercado Pago:** no, por ahora.
4. **Entrevistas:** antes que el patrocinio (cambio de orden del usuario, 2026-10-29), en `PLAN_ENTREVISTAS.md`.
5. **Plazo:** puede ir después de la defensa (5/11). Elección de cómo seguir: a criterio de Claude (ver "Orden").

## Reglas del acuerdo
- **Puntos:** cada uno tiene `lado` (`empresa` u `ong`), `tipo` (`dinero`, `insumos`, `voluntarios`, `difusion`,
  `otro`), `detalle` (texto de hasta 300) y, solo si es `dinero`, `monto` (obligatorio, > 0; en otro tipo, 400). Cada parte **edita solo su lado**; para pedirle un cambio a la otra se usa
  la charla (así queda claro quién propuso qué).
- **Mientras está en `propuesto`** se pueden agregar, editar y borrar puntos y escribir en la charla. Con el acuerdo
  `aceptado` o `rechazado`, nada se edita (409), y la charla queda de solo lectura.
- **Versión:** `empresa_voluntariados.version` sube con cada cambio de puntos. Cada parte acepta **una versión**
  (`acepta_empresa_version`, `acepta_ong_version`). El acuerdo pasa a `aceptado` cuando las dos aceptaron la versión
  vigente. Si alguien cambia un punto después, la versión sube y la aceptación de la otra parte deja de valer: nadie
  acepta algo que cambió después.
- **Concurrencia (regla 21):** aceptar manda la versión que vio el usuario y el `UPDATE` es compare-and-swap
  (`... AND version = $n AND estado = 'propuesto'`); con versión vieja, 409 "El acuerdo cambió: revisalo de nuevo".
  Cambiar un punto sube la versión en la misma transacción (`tx.*`).
- **Rechazar:** cualquiera de las dos partes, con la propuesta en `propuesto`. Retirar (solo la empresa) sigue como hoy.
- **Lo que ya existe:** un `aceptado` actual queda aceptado y sin puntos; un `propuesto` actual sigue negociándose
  (su `mensaje` se muestra como el primer mensaje de la charla). El `PATCH` de la ONG pasa a ser "aceptar mi parte":
  hay que revisar qué tests de hoy asumen que la ONG sola cierra el acuerdo.
- **Avisos** (después del COMMIT): a la otra parte cuando cambian los puntos, llega un mensaje, alguien acepta, se
  cierra o se rechaza. La charla puede generar muchos: agrupar por acuerdo si molesta (a decidir con el uso).

## Modelo de datos (aditivo, en `migrate.js`, los dos motores)
- `empresa_voluntariados`: `version INTEGER NOT NULL DEFAULT 1`, `acepta_empresa_version INTEGER`,
  `acepta_ong_version INTEGER`.
- `patrocinio_puntos`: `id` (UUID de `crypto.randomUUID()`), `empresa_id`, `project_id` (FK compuesta a
  `empresa_voluntariados`, `ON DELETE CASCADE`), `lado`, `tipo`, `detalle`, `monto` (REAL, nulo salvo en `dinero`), `autor_id` (FK `users`, `SET NULL`),
  `created_at`, `updated_at`.
- `patrocinio_mensajes`: `id`, `empresa_id`, `project_id` (misma FK), `autor_id`, `cuerpo` (hasta 1000),
  `created_at`. Orden por `created_at, id`.

## API (borrador)
Las dos partes usan las mismas rutas, con autorización por pertenencia (la empresa del token o la ONG dueña del
proyecto, por `JOIN`, nunca por los ids de la URL):
- `GET /api/patrocinios/:empresaId/:projectId` — el acuerdo: estado, versión, aceptaciones, puntos de los dos lados,
  mensajes y qué puede hacer quien pregunta.
- `POST|PATCH|DELETE /api/patrocinios/:empresaId/:projectId/puntos[/:puntoId]` — solo el propio lado.
- `POST /api/patrocinios/:empresaId/:projectId/mensajes`
- `POST /api/patrocinios/:empresaId/:projectId/aceptar` `{ version }` y `.../rechazar`.
- **Públicos:** `GET /api/projects/:id` suma `sponsors: [{ id, name, logo }]` (solo `aceptado`); el perfil público
  de la empresa suma sus voluntariados patrocinados. **Sin puntos ni montos.**

## Frontend (borrador)
- Pantalla del acuerdo (empresa y ONG, la misma): dos columnas de puntos (una sola columna en el celular: primero la
  empresa, después la ONG), la charla debajo y la barra de aceptación ("Empresa: de acuerdo con esta versión · ONG:
  pendiente"). Se entra desde `NGOPatrocinios` y desde el panel de la empresa.
- "Patrocinado por" en el detalle del voluntariado y la lista en el perfil público de la empresa (reemplaza el
  "próximamente").

## Orden (cada etapa con tests rojo → verde, SQLite + Postgres + TZ Córdoba, mutación del código nuevo, docs y deploy)
1. **Backend: puntos y versión** (tablas, `GET` del acuerdo, ABM de puntos del propio lado).
2. **Backend: charla y aceptación por versión** (cambia el `PATCH` de hoy; migrar sus tests).
3. **Frontend: pantalla del acuerdo.**
4. **Público:** "Patrocinado por" en el detalle y en el perfil de la empresa.

**Congelamiento:** del 3/11 al 5/11 no se despliega nada (la demo tiene que ser la que se ensayó). Si una etapa no
llega verde y desplegada antes del 3/11, queda para después de la defensa.

## ⚠️ Riesgos y lo que no se va a poder verificar
- La pantalla en el celular y la experiencia de negociar: solo tests en jsdom (lo visual queda NO verificado).
- Los mails nuevos: Resend real no se prueba (dobles en los tests).
- Cambiar el cierre del acuerdo toca un flujo que hoy anda y que ya está en producción.
