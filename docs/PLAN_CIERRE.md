# PLAN_CIERRE.md — Lo que queda (y lo que se puede hacer) al 29/10/2026

> Fechas: **2/11** se muestra el informe del TP (congelado) y es el **último día para desplegar**. **Del 3 al 5/11, sin
> deploys.** **5/11** defensa. **14/11** vence la base gratuita de Render.

## 1. Para retomar ya (quedó a medio hacer)

**Estado:** 3 commits locales **sin pushear**:
- `c7b026f`: S5145 del webhook, con un test en rojo, que corrige el siguiente;
- `6d15be7`: el arreglo de ese test;
- `f24750a`: el refactor de las recomendaciones a `src/lib/recommender.js`.

1. **Verificar y pushear.** Correr las cuatro suites del backend (SQLite y Postgres, UTC y Córdoba) y el frontend **solo**. Si dan verde, pushear y seguir el CI y el deploy.
   - Ya verificado: los tests de recomendaciones y donaciones (SQLite, y recomendaciones en Postgres) y 12 tests unitarios nuevos.
   - Prueba diferencial del refactor: 65 recomendaciones iguales al código viejo.
2. **Mutación de `src/lib/recommender.js`**, sobre los tests unitarios nuevos. No se corrió.
3. **Documentar §287:**
   - las aceptadas de Sonar revisadas: S5145 arreglada y S8475, S8480 y S6845 aceptadas con su motivo;
   - el refactor y la prueba diferencial;
   - el defecto encontrado (abajo) y los errores propios: un commit con un test en rojo y otro `node -e` con escapes;
   - `BACKEND_CONTEXT` con `lib/recommender.js` y `CLAUDE.md` con los conteos nuevos.
4. **Defecto encontrado en el refactor:** la consulta de roles de las recomendaciones no tiene `ORDER BY`, así que el motivo "Busca tus habilidades: A, B" cambia de orden entre bases (el código viejo ya lo hacía). Arreglo: `ORDER BY ro.nombre`, con un test.
5. **Sonar:** después del push, confirmar en SonarCloud que la complejidad de `routes/projects.js` bajó (era 342) y que S5145 se cerró sola.
6. **Documentación del TP (punto 4 del pedido, no hecho):** actualizar `docs/calidad/METRICAS.md` y `TRIAGE_SONAR.md` con los números de hoy:
   - SonarCloud: 0 issues abiertas, 0 hotspots, cobertura 91,4 % y 92,8 % en el código nuevo, duplicación 1,2 %, deuda 0;
   - tests: 1030/1032 y 1124;
   - el estado de las 4 aceptadas.
   
   **No tocar el informe HTML/PDF** (está congelado).

## 2. Opcional antes del 2/11 (código; cada uno con tests y deploy)
- **Seguir bajando la complejidad:**
  - `CreateVoluntariado.tsx` (124): separar los pasos en componentes;
  - `ProjectDetails.tsx` (112);
  - `routes/auth.js` (108): separar las contraseñas en su propio archivo.
  
  Cuanto más cerca del 2/11, más riesgo: conviene parar el 1/11.
- **Recorte de la foto en las tarjetas de Explorar:** hoy se recorta al centro en formato vertical. Podría mostrarse la foto entera o elegir el encuadre.
- ~~**Borrar la foto de Cloudinary al borrar un voluntariado**~~: hecho en §289, con el OK del usuario. También borra las fotos de sus Momentos.
- **Teléfono de contacto en la postulación** (lo pidió la entrevistada de FONBEC): quedó sin decidir porque es un dato personal.

## 3. Te toca a vos (no lo puedo hacer yo)

**Datos de producción antes de la demo:**
- La ONG SANTI tiene un CUIT y un link de transparencia **inventados**: reemplazarlos o borrarlos.
- "Test" tiene una foto de prueba: reemplazarla desde Editar (la vieja se borra sola de Cloudinary).
- Cargar fotos reales a los voluntariados de la demo (la carpeta local es `imagenes-demo/`).

**Probar en la interfaz:**
- "¿Olvidaste tu contraseña?" de punta a punta, con una cuenta descartable (el mail llega a la casilla de prueba);
- el aviso de cambio de contraseña;
- el patrocinio y las entrevistas en el celular.

**IPI** (`docs/IPI/IPI_completo.md`, fuera de git):
- fechas y cargo de las entrevistas, y consentimiento;
- verificar las citas y los números contra el audio;
- reflexiones personales;
- figuras y capturas;
- pruebas de aceptación;
- definiciones de la RAE;
- canal de difusión de la encuesta;
- fecha de la portada;
- horas de desarrollo para el ROI;
- actualizar los números (hoy: 37 tablas, 1030/1032 y 1124 tests, y lo de §279–§286).

Después, correr la corrección v3.

**Defensa:**
- datos de demo y plan B local;
- capturas nuevas (con foto, embudo, transparencia y entrevista desde el panel);
- confirmar el formato con la cátedra;
- ensayar `GUION_DEFENSA.md`, que hay que actualizar con §279–§286;
- la presentación.

## 4. Después de la defensa (trabajo futuro, ya decidido o diseñado)
- **Equipo de la ONG con cuentas reales y empleados de empresa con cupos reservados** (`docs/PLAN_EQUIPOS.md`). Hay tres decisiones abiertas para el usuario.
- **Verificación de ONG:** el objetivo 11, que sigue sin cumplirse. Los datos de transparencia son el primer paso.
- **Donaciones recurrentes de montos chicos** (suscripciones de Mercado Pago), de la entrevista a FONBEC.
- **Probar la vinculación OAuth de Mercado Pago** con credenciales productivas, y **pagar el patrocinio** por la pasarela.
- **Seguridad de la sesión:** revocar las sesiones al cambiar la contraseña (versión de sesión en `users`) y pasar el token del WebSocket al primer mensaje (S8480).
- **Notificaciones instantáneas,** recordatorios de entrevistas y reputación de usuarios.
- **Recomendaciones por distancia real** (coordenadas del navegador), paginación de los listados y estado compartido para escalar.
- **Material de capacitación por voluntariado** y un asistente que guíe al donante.
- **Antes del 14/11:** decidir qué hacer con la base de Render, que vence: migrarla, pagarla o exportar los datos.
