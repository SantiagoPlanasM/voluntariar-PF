# GUION_DEFENSA.md — Guion y checklist para la defensa (5 de noviembre de 2026)

> **A confirmar con la cátedra:** cuánto dura la defensa, si la demo es en vivo o grabada, y qué tienen que ver los
> evaluadores (código, documentación, tests). Los tiempos de abajo son una sugerencia para unos 15 minutos de demo.
>
> Datos de demo: `docs/DEMO_DATOS.md`. Estado del proyecto: `docs/PLAN_FALTANTE.md`. Detalle técnico: `docs/PROJECT_ANALYSIS.md`.

## 1. Días antes (D-3 a D-1)

- [ ] **Datos de demo cargados** en producción, y el checklist de `DEMO_DATOS.md §3` completo.
- [ ] **Último deploy** de los dos servicios (`voluntariar-api` y `voluntariar`) con el commit final. En el log de arranque de la API:
      `Fotos: Cloudinary (…)`, `Pagos: Mercado Pago` y `Email: …`.
- [ ] **Una donación de prueba completa** (con el comprador de prueba) que termine en "¡Gracias!".
- [ ] **Credenciales a mano**, en papel o en el celular, no en el repo: las cuentas de la demo, el **usuario comprador de prueba**
      de Mercado Pago y la tarjeta de prueba (titular `APRO`).
- [ ] **Plan B grabado:** un video corto (3–5 min) del recorrido, por si el sitio no responde.
- [ ] **Plan B local** probado en tu notebook: backend con `npm run db:reset` (seed) y `npm run dev`, frontend con `npm run dev`.
      Sin Cloudinary, Mercado Pago ni Resend configurados, se ve todo menos subir fotos y CV y donar.
- [ ] **La base gratuita vence el 14 de noviembre**: no la toques después de cargar los datos.

## 2. El día (30 minutos antes)

- [ ] **Despertá la API**: abrí `https://voluntariar-api-lxq7.onrender.com/health` y esperá la respuesta (en el plan gratuito, ~1 minuto).
      Después abrí el sitio.
- [ ] **Sesiones abiertas.** La sesión se guarda por navegador, así que necesitás **un navegador o un perfil distinto por cuenta**:
  - perfil 1: la **voluntaria** (Lucía);
  - perfil 2: la **ONG 1**;
  - ventana de incógnito: la **empresa**;
  - otra ventana de incógnito, para el **checkout de Mercado Pago** con el comprador de prueba.
- [ ] Probá que el **chatbot** responda y que la **campanita** de la ONG cargue.
- [ ] Wifi de respaldo (los datos del celular), por si falla la red del lugar.

## 3. Recorrido sugerido (~15 minutos)

| Min | Qué mostrar | Qué decir |
|---|---|---|
| 0–1 | **Portada sin sesión** y **Explorar** (mapa, búsqueda, filtros) | El problema: conectar voluntarios, ONG y empresas. Se puede explorar sin cuenta |
| 1–4 | **Voluntaria:** feed "Siguiendo", detalle de un proyecto, inscripción, **perfil con foto, habilidades y CV** | El CV es privado: no tiene URL pública; la ONG lo abre con un link que vence a los 10 minutos |
| 4–7 | **ONG:** panel, solicitudes con el **ícono de CV**, aprobar, **cargar horas**, **KPIs**, **campanita** | Las horas las certifica la ONG, no el voluntario. Los cupos no se pueden pasar, ni con dos aprobaciones a la vez |
| 7–8 | **Momentos:** publicar fotos de una jornada y el "me gusta" | Solo publica quien participó (inscripción aprobada) o la ONG |
| 8–10 | **Empresa:** proponer un patrocinio, que la ONG acepte, y el **panel de la empresa** con los KPIs | Responsabilidad social empresaria (RSE) medible |
| 10–13 | **Donación en vivo:** "Donar" → Mercado Pago → **iniciar sesión con el comprador de prueba** → pagar → "¡Gracias!" → lo recaudado sube → la ONG recibe la notificación | Modo prueba: no se cobra dinero real. La app nunca ve la tarjeta. El estado lo decide el backend consultando a Mercado Pago, nunca la URL de vuelta |
| 13–14 | **Chat** voluntaria ↔ ONG y el **chatbot** de preguntas frecuentes | Chat en tiempo real con WebSocket |
| 14–15 | **`/privacidad`** y **"Borrar mi cuenta"** (sin borrar nada) | Ley 25.326: acceso, corrección y borrado; el borrado se confirma por email |

## 4. Qué contar de lo técnico (si preguntan)

- **Arquitectura:** React + Vite en el frontend; Express con SQL a mano (sin ORM) en el backend. **SQLite** en desarrollo y tests, **Postgres** en producción, con un adaptador único.
- **Calidad:** al 2026-10-16, **782 tests de backend en SQLite y 784 en Postgres**, y **694 de frontend**, también con la zona horaria de Córdoba. Tipos de TypeScript sin errores y `npm audit` en 0.
  Además, **mutation testing** en cada cambio: se rompe el código a propósito y se comprueba que algún test lo detecte.
- **Concurrencia y plata:** las acreditaciones van en una transacción, con *compare-and-swap*. Un aviso repetido o cinco a la vez acreditan una sola vez, y eso está probado contra Postgres con conexiones en paralelo.
- **Integraciones sin SDK:** Cloudinary y Mercado Pago van por su API REST, con `fetch`. La firma y las rutas se verificaron contra la documentación oficial y el **código del SDK oficial**, sin sumar dependencias.
- **Privacidad por diseño:** las listas blancas de columnas en los endpoints públicos; el CV privado con link que vence; el 404 uniforme para no revelar quién cargó un CV; el borrado con un código de un solo uso, del que solo se guarda el hash.
- **Trampas resueltas:** las fechas (string en SQLite y `Date` en Postgres; los días que salían corridos por la zona horaria), los agregados de Postgres que llegan como texto y los montos en `float4` (por eso se dona en pesos enteros).

## 5. Limitaciones, contadas con honestidad (preguntas esperables)

| Pregunta posible | Respuesta corta |
|---|---|
| ¿Por qué el aviso (webhook) de Mercado Pago no se usa? | En **modo prueba**, los avisos de pagos reales no validan la firma, y la simulación del panel sí. La donación se confirma igual cuando el comprador vuelve, consultando el pago a Mercado Pago (`PROJECT_ANALYSIS.md §176`). Con credenciales productivas habría que volver a probarlo |
| ¿Y si el comprador cierra la pestaña antes de volver? | La donación queda pendiente. Trabajo futuro: buscar los pagos pendientes por `external_reference` |
| ¿Por qué los emails te llegan a vos? | El remitente es de prueba (Resend sin dominio propio). Con un dominio verificado llegarían a cada persona |
| ¿Por qué tarda la primera vez? | Plan gratuito de Render: la API se duerme y tarda ~1 minuto en despertar |
| ¿Qué pasa con más usuarios? | Explorar trae hasta 500 proyectos (con aviso); haría falta paginación real. El límite de intentos de login y de subidas está en memoria (por proceso) |
| ¿Se borran todas las fotos al borrar una cuenta? | El CV y las fotos de Momentos sí; las fotos de perfil anteriores pueden quedar en Cloudinary |

**Trabajo futuro** (decidido, sin hacer): empleados de empresa con invitación (`BACKEND_ROADMAP_ANALYSIS.md §2.4`), chat empresa ↔ ONG y voluntarios (§2.5), conciliación de donaciones pendientes, `recaudado` en `NUMERIC`, paginación real y un chatbot con IA.

## 6. Plan B

| Si pasa… | Hacé… |
|---|---|
| El sitio no despierta | Esperá 1 minuto más; si sigue sin responder, el **video** o el **plan B local** |
| Mercado Pago falla en el checkout | Verificá que estés **logueado con el comprador de prueba**. Si igual falla, mostrá una donación ya hecha (lo recaudado y la notificación) y explicá el flujo |
| El email de borrar la cuenta no llega | Explicá la limitación del remitente de prueba (`/privacidad` → "Limitaciones de esta demo") |
| Se cae la red | Datos del celular o plan B local |
