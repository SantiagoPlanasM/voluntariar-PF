# PLAN_CIERRE.md — Lo que queda (y lo que se puede hacer) al 4/11/2026

> Fechas: **del 3 al 5/11, sin deploys.** **5/11** defensa. **14/11** vence la base gratuita de Render.
>
> Producción está en `f4e2995` (CI y Deploy en verde el 31/10; `/health` confirmado el 4/11). **Cualquier push a `main`
> despliega, aunque sea solo de documentación:** `deploy.yml` corre con cada CI en verde y no filtra por rutas. Hasta
> después de la defensa, los commits quedan locales.

## 1. Te toca a vos antes de la defensa (no lo puedo hacer yo)

**Datos y prueba en producción** (checklist completa en `GUION_DEFENSA.md §1` y `DEMO_DATOS.md §3`):
- cargar el equipo de la ONG 1 (`DEMO_DATOS.md`, paso 2.5);
- una donación de prueba completa, hasta "¡Gracias!";
- credenciales a mano y capturas de respaldo (las anteriores al 21/10 no sirven).

**Probar en la interfaz:**
- el equipo con dos cuentas, el teléfono y el encuadre de la foto;
- "¿Olvidaste tu contraseña?" de punta a punta, con una cuenta descartable (el mail llega a la casilla de prueba);
- el aviso de cambio de contraseña;
- el patrocinio, las entrevistas y el equipo en un celular real.

**Defensa:**
- plan B local;
- confirmar el formato con la cátedra;
- ensayar `GUION_DEFENSA.md`, cronometrando el cambio de sesión entre Martín y Sofía;
- la presentación.

**IPI** (`docs/IPI/IPI_completo.md`, fuera de git). Los números están al CI de `f4e2995` y la corrección v3 dio 7,0/10. Falta:
- fechas y cargo de las entrevistas, y consentimiento;
- verificar las citas y los números contra el audio;
- reflexiones personales;
- figuras y capturas;
- pruebas de aceptación;
- definiciones de la RAE;
- canal de difusión de la encuesta;
- fecha de la portada;
- horas de desarrollo para el ROI.

## 2. Después de la defensa (trabajo futuro, ya decidido o diseñado)

**Con fecha:**
- **Antes del 14/11:** decidir qué hacer con la base de Render, que vence: migrarla, pagarla o exportar los datos.

**Decidido:**
- **Empleados de empresa con cupos reservados** (`PLAN_EQUIPOS.md`, pasos 3 y 4). Un empleado con lugar reservado igual pasa por la aprobación de la ONG.
- **Sacar `NGOEmpleados`** (el directorio de fichas sin cuenta, `/ngo/empleados/:id`): desde §296 no tiene ningún link y el equipo real es "Acceso del equipo". Hay que retirar la pantalla y la ruta, y decidir qué pasa con la tabla `empleados` y su API.
- **Cloudinary por carpetas:** una subcarpeta por tipo (perfiles, momentos, voluntariados, CV). Lo viejo no se mueve. Antes hay que revisar `CLOUDINARY_FOLDER` en Render y probar una subida real.

**Diseñado o pedido, sin fecha:**
- **Verificación de ONG:** el objetivo 11, que sigue sin cumplirse. Los datos de transparencia son el primer paso.
- **Donaciones recurrentes de montos chicos** (suscripciones de Mercado Pago), de la entrevista a FONBEC.
- **Probar la vinculación OAuth de Mercado Pago** con credenciales productivas, y **pagar el patrocinio** por la pasarela.
- **Seguridad de la sesión:** revocar las sesiones al cambiar la contraseña (versión de sesión en `users`) y pasar el token del WebSocket al primer mensaje (S8480).
- **Notificaciones instantáneas,** recordatorios de entrevistas y reputación de usuarios.
- **Recomendaciones por distancia real** (coordenadas del navegador), paginación de los listados y estado compartido para escalar.
- **Material de capacitación por voluntariado** y un asistente que guíe al donante.
- **Seguir bajando la complejidad:** quedan `routes/projects.js` (265), `ProjectDetails.tsx` (105), `routes/enrollments.js` (94) y el JSX de los pasos de `CreateVoluntariado.tsx` (84), sin apuro: Sonar no marca issues.
