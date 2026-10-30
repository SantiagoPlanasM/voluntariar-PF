# GUION_DEFENSA.md — Guion y checklist para la defensa (5 de noviembre de 2026)

> **A confirmar con la cátedra:** cuánto dura la defensa, si la demo es en vivo o grabada, y qué tienen que ver los
> evaluadores (código, documentación, tests). Los tiempos de abajo son una sugerencia para unos 15 minutos de demo.
>
> Datos de demo: `docs/DEMO_DATOS.md`. Estado del proyecto: `docs/PLAN_FALTANTE.md`. Detalle técnico: `docs/PROJECT_ANALYSIS.md`.

## 1. Días antes (D-3 a D-1)

- [ ] **Datos de demo cargados** en producción, y el checklist de `DEMO_DATOS.md §3` completo.
- [ ] **Último deploy** de los dos servicios (`voluntariar-api` y `voluntariar`) con el commit final. En el log de arranque de la API:
      `Fotos: Cloudinary (…)`, `Pagos: Mercado Pago` y `Email: …`.
- [ ] **Una donación de prueba completa** (con el comprador de prueba) que termine en "¡Gracias!". El proyecto tiene que ser de una ONG con **Mercado Pago vinculado** (la ONG SANTI, vinculada a mano con el vendedor de prueba): sin cuenta vinculada, el botón "Donar" no aparece (§215).
- [ ] **Credenciales a mano**, en papel o en el celular, no en el repo: las cuentas de la demo, el **usuario comprador de prueba**
      de Mercado Pago y la tarjeta de prueba (titular `APRO`).
- [ ] **Capturas de respaldo:** el usuario decidió no grabar un video. Sacá capturas de las pantallas clave por si el sitio no responde:
  - portada y CV en Configuración;
  - un voluntariado **con foto** y el campo de **teléfono** al postularse;
  - el panel de la ONG con el **embudo** y una **entrevista agendada**, y el teléfono de un postulante;
  - el perfil de la ONG con sus **datos de transparencia**;
  - el **acuerdo de patrocinio** con puntos de los dos lados y "Patrocinado por" en un voluntariado;
  - la donación con "¡Gracias!" y el panel de la empresa. **Las capturas viejas no sirven:** el frontend se rediseñó entero el 21/10 (§240).
- [ ] **Plan B local** probado en tu notebook: backend con `npm run db:reset` (seed) y `npm run dev`, frontend con `npm run dev`.
      Sin Cloudinary, Mercado Pago ni Resend configurados, se ve todo menos subir fotos y CV y donar.
- [ ] **La base gratuita vence el 14 de noviembre**: no la toques después de cargar los datos.
- [ ] **Sin deploys del 3 al 5 de noviembre** (decisión del usuario): lo que no esté en producción el 2/11 no entra en la demo.

## 2. El día (30 minutos antes)

- [ ] **Despertá la API**: abrí `https://voluntariar-api-lxq7.onrender.com/health` y esperá la respuesta (en el plan gratuito, ~1 minuto).
      Después abrí el sitio.
- [ ] **Sesiones abiertas.** La sesión se guarda por navegador, así que necesitás **un navegador o un perfil distinto por cuenta**:
  - perfil 1: la **voluntaria** (Lucía);
  - perfil 2: la **ONG 1**;
  - ventana de incógnito: la **empresa**;
  - otra ventana de incógnito, para el **checkout de Mercado Pago** con el comprador de prueba.
- [ ] Probá que el **Asistente** responda (Mensajes → "Asistente VoluntariAR", arriba de todo) y que la **campanita** del panel de la ONG cargue.
- [ ] Elegí el **tema** (claro u oscuro) en Configuración → Apariencia, según el proyector. Por defecto sigue al sistema.
- [ ] Wifi de respaldo (los datos del celular), por si falla la red del lugar.

## 3. Recorrido sugerido (~15 minutos)

| Min | Qué mostrar | Qué decir |
|---|---|---|
| 0–1 | **Portada sin sesión** y **Explorar** (búsqueda, chips de categoría, "Filtros" con **"Carga horaria"** y el botón **Mapa**) | El problema: conectar voluntarios, ONG y empresas. Se puede explorar sin cuenta. El filtro de horas lo pidió la coordinadora de FONBEC en la entrevista (§283) |
| 1–4 | **Voluntaria:** **Inicio** (voluntariados y publicaciones de lo que sigue), **"Para vos"** en Explorar (cada tarjeta dice **por qué** se recomienda), detalle de un proyecto **con su foto** y **"Inscribirme"** con el **teléfono opcional** (§291), **Mis voluntariados** (pestañas Próximos y Postulaciones; en una entrevista, **"Agregar a Google Calendar"**; en Realizados, el **"Certificado"** para imprimir o guardar como PDF), **perfil** (foto, "Sobre mí", habilidades) y el **CV en Configuración** (menú ☰ del perfil) | El CV es privado: no tiene URL pública; la ONG lo abre con un link que vence a los 10 minutos. El teléfono también es privado: la ONG lo ve solo mientras la postulación está pendiente o aprobada. Las recomendaciones pesan el historial (una aprobada vale el doble), lo que sigue, las habilidades, la cercanía y los cupos, y muestran a lo sumo 2 de la misma ONG (§280) |
| 4–7 | **ONG:** **Panel** (resumen, **embudo de postulaciones** de §284 y "Postulaciones sin responder" con el **teléfono** y el link **"Entrevista"** de §279), **"Editar perfil"** con los **datos de transparencia** (CUIT con dígito verificador y link a balances, que se ven en el perfil público, §285), el detalle de un voluntariado con **"Ver CV"**, la **foto del voluntariado** (§282), **"Agendar entrevista"** a una postulación pendiente, **"Acceso del equipo"** (§293–§296: invitar a una voluntaria como Coordinación; ella acepta en Configuración → Equipos y abre el panel de la ONG, donde aprueba postulaciones; la voluntaria de Comunicación solo publica Momentos) (la voluntaria la ve en Mis voluntariados con el chip **"Entrevista"**), aprobar, **cargar horas**, **KPIs**, **"Editar"** el voluntariado (el lugar en el mapa es obligatorio si es presencial), **"Agregar al calendario"** de la entrevista (§271) y **campanita** del panel | Las horas las certifica la ONG, no el voluntario. Los cupos no se pueden pasar, ni con dos aprobaciones a la vez. Al aprobar o rechazar, la entrevista programada se cancela sola |
| 7–8 | **Momentos:** **Crear** → "Nueva publicación" (voluntariado, hasta 5 fotos y texto) y el "me gusta" | Solo publica quien participó (inscripción aprobada) o la ONG |
| 8–10 | **Empresa:** **"Patrocinar este proyecto"** y después **"Ver acuerdo"**: los **puntos** de cada lado (lo que aporta la empresa: dinero, empleados, insumos; lo que pide la ONG: difusión, etc.), la **charla** dentro del acuerdo, y que **las dos partes acepten la misma versión** → el voluntariado muestra **"Patrocinado por"** y el perfil público de la empresa lo lista. Cerrar con el **Panel** de la empresa y sus KPIs | Responsabilidad social empresaria (RSE) medible y negociada. Si alguien cambia un punto, la versión sube y hay que volver a aceptar: nadie acepta algo que cambió después. Los montos son privados de las partes |
| 10–13 | **Donación en vivo:** "Donar" → Mercado Pago → **iniciar sesión con el comprador de prueba** → pagar → "¡Gracias!" → lo recaudado sube → la ONG recibe la notificación | Modo prueba: no se cobra dinero real. La app nunca ve la tarjeta. El estado lo decide el backend consultando a Mercado Pago, nunca la URL de vuelta |
| 13–14 | **Mensajes:** chat voluntaria ↔ ONG y el **Asistente** de preguntas frecuentes, fijado arriba | Chat en tiempo real con WebSocket. El asistente es sin IA: busca por palabras clave |
| 14–15 | **Configuración** → **"Cambiar contraseña"** (el ojo muestra lo escrito), "Privacidad y términos" y **"Borrar mi cuenta"** (sin borrar nada). Si sobra tiempo: en el login, **"¿Olvidaste tu contraseña?"** | Ley 25.326: acceso, corrección y borrado; el borrado se confirma por email. La recuperación no dice si un email tiene cuenta: responde igual siempre, y el link vence en 1 hora y sirve una vez |

## 4. Qué contar de lo técnico (si preguntan)

- **Arquitectura:** React + Vite en el frontend; Express con SQL a mano (sin ORM) en el backend. **SQLite** en desarrollo y tests, **Postgres** en producción, con un adaptador único.
- **Calidad (TP de Calidad, `docs/calidad/informe/`):** el informe tiene el corte del 23/10 (**932 tests de backend en SQLite y 934 en Postgres**, y **954 de frontend**); al 30/10, con las entrevistas, el patrocinio negociado, las contraseñas, la foto del voluntariado, el embudo, la transparencia y el teléfono (§272–§291), son **1088, 1090 y 1187** (1087 reales en el backend: el runner cuenta `helpers.js`), con el equipo de la ONG, el encuadre de la foto y los refactors del frontend (§293–§299). Todos corren en UTC y con la zona horaria de Córdoba, en cada push (GitHub Actions). Cobertura de líneas al 30/10: backend 94,26 % (CI) y frontend 92,93 % (local). SonarCloud con 0 issues abiertas, 3 aceptadas con su motivo y quality gate en verde (`docs/calidad/METRICAS.md §7`).
  **Complejidad:** el archivo más complejo (`routes/projects.js`, 342 de complejidad cognitiva) bajó a 257 al sacar el puntaje de las recomendaciones a funciones puras (`lib/recommender.js`, con 15 tests unitarios y una prueba diferencial: 65 recomendaciones iguales antes y después, §287). Las contraseñas salieron de `routes/auth.js`, que bajó de 108 a 74 (§290). La lógica de los formularios del frontend pasó a módulos con tests y mutación: `CreateVoluntariado.tsx` bajó de 124 a 84 y `ProjectDetails.tsx` de 112 a 105 (§298–§299; corte del 30/10 en `docs/calidad/METRICAS.md §8`). Deploy con smoke y E2E contra Mercado Pago. Tipos de TypeScript sin errores y `npm audit` en 0.
  Además, **mutation testing** en cada cambio (se rompe el código a propósito y se comprueba que algún test lo detecte), **32 defectos registrados** en GitHub Issues, todos corregidos, y una **sesión exploratoria** que encontró 8 defectos que la suite no veía (contraste en modo oscuro, textos viejos del asistente).
- **Concurrencia y plata:** las acreditaciones van en una transacción, con *compare-and-swap*. Un aviso repetido o cinco a la vez acreditan una sola vez, y eso está probado contra Postgres con conexiones en paralelo. Lo mismo en el acuerdo de patrocinio (las dos partes aceptando a la vez lo cierran una sola vez, §264) y en las entrevistas (una sola programada por postulación, con un índice único parcial, §261).
- **Integraciones sin SDK:** Cloudinary y Mercado Pago van por su API REST, con `fetch`. La firma y las rutas se verificaron contra la documentación oficial y el **código del SDK oficial**, sin sumar dependencias.
- **Privacidad por diseño:** las listas blancas de columnas en los endpoints públicos; el CV privado con link que vence; el 404 uniforme para no revelar quién cargó un CV; el borrado con un código de un solo uso, del que solo se guarda el hash.
- **Trampas resueltas:** las fechas (string en SQLite y `Date` en Postgres; los días que salían corridos por la zona horaria), los agregados de Postgres que llegan como texto y los montos en `float4` (por eso se dona en pesos enteros).

## 5. Limitaciones, contadas con honestidad (preguntas esperables)

| Pregunta posible | Respuesta corta |
|---|---|
| ¿Por qué el aviso (webhook) de Mercado Pago no se usa? | En **modo prueba**, los avisos de pagos reales no validan la firma, y la simulación del panel sí. La donación se confirma igual cuando el comprador vuelve, consultando el pago a Mercado Pago (`PROJECT_ANALYSIS.md §176`). Con credenciales productivas habría que volver a probarlo |
| **¿Adónde llega la plata de la ONG?** | **A la cuenta de Mercado Pago de cada ONG** (Marketplace, §215–§225): la preferencia se crea con el token de la ONG dueña del proyecto, así que la plata le llega directo y la plataforma nunca la toca ni cobra comisión. Sin cuenta vinculada, la ONG no recibe donaciones y el botón no aparece. Los tokens se guardan cifrados. **Límite:** el botón "Vincular Mercado Pago" (OAuth) está hecho pero no se probó en vivo, porque necesita activar las credenciales productivas; para la demo, la ONG se vinculó cargando a mano el token de su vendedor de prueba, y una donación real de prueba se acreditó en esa cuenta |
| ¿Y si el comprador cierra la pestaña antes de volver? | La donación queda pendiente. Trabajo futuro: buscar los pagos pendientes por `external_reference` |
| ¿Por qué los emails te llegan a vos? | El remitente es de prueba (Resend sin dominio propio). Con un dominio verificado llegarían a cada persona |
| ¿Y si alguien se olvida la contraseña? | "¿Olvidaste tu contraseña?" en el login (§275): manda un link de un solo uso que vence en 1 hora (en la base solo queda su hash). La respuesta es la misma haya o no cuenta, así no se puede averiguar quién está registrado. En la demo el mail llega a la casilla de prueba, como todos. **Límite:** cambiar la contraseña no cierra las sesiones abiertas en otros dispositivos (los JWT no se revocan) |
| ¿Por qué tarda la primera vez? | Plan gratuito de Render: la API se duerme y tarda ~1 minuto en despertar |
| ¿La charla del acuerdo es en tiempo real? | No: el mensaje de la otra parte aparece al recargar o al hacer un cambio (llega el aviso en la campanita). El chat 1 a 1 de Mensajes sí es en tiempo real |
| ¿Las entrevistas mandan recordatorio? | No: avisan al agendar (en la app y por mail) y al reprogramar o cancelar (en la app). Un recordatorio el día antes necesita una tarea programada, que el plan gratuito no tiene |
| ¿Qué pasa con más usuarios? | Explorar trae hasta 500 proyectos (con aviso); haría falta paginación real. El límite de intentos de login y de subidas está en memoria (por proceso) |
| ¿Se borran todas las fotos al borrar una cuenta? | El CV, las fotos de Momentos y, si es una ONG, las fotos de sus voluntariados sí. Borrar un voluntariado también borra su foto y las de sus Momentos (§289). Las fotos de perfil anteriores pueden quedar en Cloudinary, porque no se guarda su id |
| ¿Quién más puede gestionar una ONG? | Desde §293, su **equipo**: voluntarios invitados por la ONG, que tienen que aceptar. Coordinación ve y decide postulaciones, CV, entrevistas y horas; Comunicación publica Momentos. Editar voluntariados, Mercado Pago y patrocinios siguen siendo solo de la cuenta de la ONG. Todo lo controla una función central en el backend (`ngoAccess`), con tests de permisos para cada rol |
| ¿Las ONG están verificadas? | **No.** Los datos de transparencia (CUIT y link a balances) los carga la ONG, y el perfil lo dice: "VoluntariAR no los verifica". El CUIT se valida con el dígito verificador de AFIP, pero eso no prueba que sea de esa ONG. La verificación (objetivo 11) queda como trabajo futuro, y esto es el primer paso |
| ¿Por qué un teléfono y no solo el email? | Lo pidió FONBEC: para coordinar, les sirve más. Es opcional, se da por postulación (no queda en el perfil) y la ONG lo ve solo mientras la postulación está pendiente o aprobada |

**Trabajo futuro** (decidido, sin hacer): **probar en vivo la vinculación por OAuth** (necesita credenciales productivas), **pagar el patrocinio por Mercado Pago** desde el acuerdo, recordatorios de entrevistas, empleados de empresa con invitación (`BACKEND_ROADMAP_ANALYSIS.md §2.4`), chat empresa ↔ ONG y voluntarios (§2.5), conciliación de donaciones pendientes, `recaudado` en `NUMERIC`, paginación real y un chatbot con IA.

## 6. Plan B

| Si pasa… | Hacé… |
|---|---|
| El sitio no despierta | Esperá 1 minuto más; si sigue sin responder, el **plan B local** o las **capturas** |
| Mercado Pago falla en el checkout | Verificá que estés **logueado con el comprador de prueba**. Si igual falla, mostrá una donación ya hecha (lo recaudado y la notificación) y explicá el flujo |
| El email de borrar la cuenta no llega | Explicá la limitación del remitente de prueba (`/privacidad` → "Limitaciones de esta demo") |
| Se cae la red | Datos del celular o plan B local |
