# PLAN_FEBRERO.md — Lo que sigue hasta la presentación final

> Estado al 11/11/2026. El 5/11 fue la presentación de avances; la final es **después de febrero** (falta la fecha exacta).
> El proyecto es académico y no se lanza al mercado, pero se sigue mejorando. Las reglas de trabajo no cambian (`CLAUDE.md`).
> Producción está en `f0e6607` (CI y Deploy en verde el 11/11). Investigación de pagos:
> [informe de Mercado Pago](https://claude.ai/artifact/WF4evt666tG7cXNkGWJGc2).

## Devolución de los directores (5/11)

- Decir siempre cuántos encuestados hubo y la calidad de la muestra: 106 respuestas, del 20/03 al 07/04/2026, con sesgo (el 80,2 % ya había hecho voluntariado).
- Investigar a fondo donaciones, manejo de dinero y opciones de Mercado Pago (primer informe hecho).
- Repasar contenedores: SQLite y Postgres no tienen nada que ver con Docker.
- Practicar oratoria: grabarse y verse, velocidad y dicción.
- Iniciar sesión con Google u otro proveedor.
- Conectarse con Judith Analia Disderi por el trabajo de Bobadilla.

## Etapa 0. Antes del 14/11 (tiene fecha)

- [x] Base de Render (vencía el 14/11): copiada a Neon con `pg_dump`/`pg_restore`, mismos conteos en las 38 tablas (§310).
- [x] Pushear los commits locales y verificar CI y Deploy (2dd1de2, 8/11).

## Etapa 1. Mercado Pago

- [ ] **Prueba corta:** crear una suscripción con el token de un vendedor de prueba y confirmar a qué cuenta llega la plata. Decide el diseño de las donaciones mensuales. Pospuesta el 9/11: el script de prueba se arma de nuevo, quedó fuera del repo.
- [ ] Si funciona, plan y desarrollo de la donación mensual: alta, baja por el donante y aviso a la ONG.
- [ ] Mostrarle a la ONG cuánto recibe según el plazo, aclarando que depende de su provincia.
- [ ] Decidir si el patrocinio se paga por la pasarela (6,60 % al instante en Córdoba) o por transferencia.
- [x] Contracargos y devoluciones (§311): la donación pasa a `reembolsada` y deja de sumar. Falta activar el evento **Contracargos** en el panel de Webhooks.
- [x] Desvinculación (§313): el aviso `mp-connect` hace probar el token de la ONG; si Mercado Pago lo rechaza, se oculta el botón y se le avisa. Falta activar el evento **Vinculación de aplicaciones** en el panel de Webhooks.
- [ ] Si hay suscripciones, probar qué pasa con las activas al vencer o revocar el token.
- [ ] Confirmar en la documentación oficial lo que dijo el asistente de Mercado Pago antes de citarlo.

## Etapa 2. Patrocinio

Sin Figma: diseño propio del 11/11 ([lienzo](https://claude.ai/artifact/EvgwaAnYzYoiTzpAPSX6BZ)). Decidido: versión nueva **al guardar** (no por punto), la empresa **propone con puntos** y se avanza **paso a paso**.

1. [x] Backend: quién cambió qué, aceptaciones con fecha e historial (§324).
2. [x] Frontend: lista única con filtros, "agregado/editado por" y "cambió desde que aceptaste" (§325).
3. [x] Frontend: pantalla del historial de versiones (§326).
4. [x] Una versión por guardado: borrador en pantalla y "Guardar cambios" en una transacción (§327).
5. [ ] Proponer con puntos (versión 1).

Lo que pedía la etapa:

- [x] Una sola lista de puntos, marcando la parte de cada uno, en vez de las dos columnas (§325).
- [x] Mostrar quién editó y cuándo (§324, §325).
- [x] Historial de cambios por versión (§324, §326).

## Etapa 3. Lo que quedó sin cumplir

En este orden, salvo que el usuario diga otra cosa (orden propuesto, sin confirmar):

1. [x] **Validación de ONG con panel de administración** (§317 backend, §318 frontend): pantalla "Validar la ONG", panel de admin e insignia azul. Falta que el usuario cargue `ADMIN_EMAILS` en Render (con un mail que ya tenga cuenta) y la pruebe en la interfaz.
   - [ ] Opcional, ofrecido el 11/11 y sin decidir: exigirle al admin haber entrado con Google (mail verificado). Hoy el registro con contraseña no verifica el mail: un mail de `ADMIN_EMAILS` sin cuenta lo podría registrar cualquiera.
   - [x] **Pantalla de postulaciones** (§319; pedido del 11/11, fuera del orden): todas las de la ONG juntas, filtros, de a 50 y decisión en lote con tope de cupos, también para la coordinación. Falta la prueba del usuario en la interfaz.
2. [x] **Iniciar sesión con Google** (§314): pantalla de rol la primera vez; un mail con cuenta se vincula solo si Google lo da por verificado. Falta el Client ID de Google Cloud.
   - [x] **Fechas de los voluntariados y Calendar** (§315): inicio y fin opcionales, con hora opcional; Google Calendar y .ics en el detalle y en "Próximos". Las entrevistas ya lo tenían (§268).
3. [ ] **Notificaciones instantáneas**, por el WebSocket que ya existe. **Lo próximo.**
4. [ ] **Reputación de ONG y usuarios.** Antes, que el usuario defina qué se mide (reseñas, horas, postulaciones respondidas…).
5. [ ] **Empleados de empresa con cupos reservados** (`PLAN_EQUIPOS.md`, pasos 3 y 4). Toca la invariante de cupos: con cuidado.

**Si sobra tiempo:** versión instalable en el celular (PWA) y paginación de los listados. **No hacer:** escalar a varias instancias.

## Etapa 4. Orden y deuda chica

- [ ] Sacar `NGOEmpleados`, con su pantalla y ruta; decidir qué pasa con la tabla `empleados` y su API.
- [ ] Cloudinary por carpetas: antes revisar `CLOUDINARY_FOLDER` en Render y probar una subida real.
- [ ] `NGOProjectDetail.tsx`: `toLocaleString()` sin idioma; usar `es-AR`.
- [ ] Ver por qué `node --watch` se reinicia solo en Windows (§308).
- [ ] Reescribir `GUION_DEFENSA.md` para la presentación final y sumar la línea de la muestra.

## Te toca a vos

- [ ] Cargar `ADMIN_EMAILS` en el panel de Render (servicio del backend; varios, separados por coma) con el mail de una cuenta tuya que ya exista en prod.
- [ ] Probar en la interfaz la validación de ONG (pedirla con una ONG, aprobar o rechazar como admin) y la pantalla de postulaciones (filtros, lote, cupos).

- [ ] Figma del patrocinio.
- [ ] Consultar a un contador si la donación por Mercado Pago es deducible de Ganancias.
- [ ] Preguntar a Mercado Libre Solidario por los requisitos y si hay tarifa para ONG. Lo hace la ONG, no la plataforma.
- [ ] Contactar a Judith Analia Disderi y contarme de qué trata el trabajo de Bobadilla.
- [ ] Practicar oratoria y repasar contenedores.
- [ ] IPI: pendientes de `PLAN_CIERRE.md` §1. Además, cambiar la comisión de referencia de 6,29 % (CABA) por 6,60 % (Córdoba), y decidir si sigue la prueba piloto como trabajo futuro.
- [ ] Fecha exacta de la presentación final.
