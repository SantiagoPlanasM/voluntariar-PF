# PLAN_CIERRE.md — Lo que queda (y lo que se puede hacer) al 29/10/2026

> Fechas: **2/11** se muestra el informe del TP (congelado) y es el **último día para desplegar**. **Del 3 al 5/11, sin
> deploys.** **5/11** defensa. **14/11** vence la base gratuita de Render.

## 1. ~~Para retomar ya~~ (hecho)

Los tres commits locales del 29/10 se verificaron y pushearon. La mutación del recomendador, el `ORDER BY ro.nombre` de los roles y la documentación están en §287–§288. Los números de Sonar y de los tests están en `docs/calidad/METRICAS.md` §7 y, con el corte del 30/10 a la noche, §8. `TRIAGE_SONAR.md` tiene las 3 aceptadas. El informe HTML/PDF sigue congelado.

## 2. Opcional antes del 2/11 (código; cada uno con tests y deploy)
- **Seguir bajando la complejidad** (hecho en §290, §298 y §299: auth.js separado; la lógica pura de CreateVoluntariado y ProjectDetails, en módulos con tests; el JSX de los pasos no se partió):
  - `CreateVoluntariado.tsx` (124): separar los pasos en componentes;
  - `ProjectDetails.tsx` (112);
  - `routes/auth.js` (108): separar las contraseñas en su propio archivo.
  
  Cuanto más cerca del 2/11, más riesgo: conviene parar el 1/11.
- ~~**Recorte de la foto en las tarjetas de Explorar**~~: hecho en §297 (la ONG elige el encuadre). Texto original: hoy se recorta al centro en formato vertical. Podría mostrarse la foto entera o elegir el encuadre.
- ~~**Borrar la foto de Cloudinary al borrar un voluntariado**~~: hecho en §289, con el OK del usuario. También borra las fotos de sus Momentos.
- ~~**Teléfono de contacto en la postulación**~~: hecho en §291, con el OK del usuario. Es opcional y la ONG lo ve solo con la postulación pendiente o aprobada.
- ~~**`routes/auth.js`**~~: las contraseñas se separaron en §290.

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
- **Sacar `NGOEmpleados`** (el directorio de fichas sin cuenta, `/ngo/empleados/:id`): desde §296 no tiene ningún link y el equipo real es "Acceso del equipo". Decisión del usuario del 30/10: no hace falta más y se saca después. Hay que retirar la pantalla y la ruta, y decidir qué pasa con la tabla `empleados` y su API.
- **Equipo de la ONG con cuentas reales y empleados de empresa con cupos reservados** (`docs/PLAN_EQUIPOS.md`). Hay tres decisiones abiertas para el usuario.
- **Verificación de ONG:** el objetivo 11, que sigue sin cumplirse. Los datos de transparencia son el primer paso.
- **Donaciones recurrentes de montos chicos** (suscripciones de Mercado Pago), de la entrevista a FONBEC.
- **Probar la vinculación OAuth de Mercado Pago** con credenciales productivas, y **pagar el patrocinio** por la pasarela.
- **Seguridad de la sesión:** revocar las sesiones al cambiar la contraseña (versión de sesión en `users`) y pasar el token del WebSocket al primer mensaje (S8480).
- **Notificaciones instantáneas,** recordatorios de entrevistas y reputación de usuarios.
- **Recomendaciones por distancia real** (coordenadas del navegador), paginación de los listados y estado compartido para escalar.
- **Material de capacitación por voluntariado** y un asistente que guíe al donante.
- **Antes del 14/11:** decidir qué hacer con la base de Render, que vence: migrarla, pagarla o exportar los datos.
