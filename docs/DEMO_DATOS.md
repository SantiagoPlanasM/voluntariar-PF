# DEMO_DATOS.md — Cómo cargar los datos de demo en producción (por la interfaz)

> Decisión del usuario (2026-10-16): los datos de demo de producción se cargan **a mano, por la interfaz**. `seed.js` está
> bloqueado en producción a propósito (`PROJECT_ANALYSIS.md §116`). Esta guía dice **qué cuentas crear, qué cargar y en qué
> orden** para que la defensa muestre todos los módulos. Tiempo estimado: 1 a 2 horas.
>
> **No pongas contraseñas en este archivo ni en el repo** (está en GitHub). Anotalas aparte.
> **No uses datos de personas reales** (nombres, fotos, CV): inventados o propios. Las fotos, tuyas o libres de derechos.

## 0. Antes de empezar

- Despertá la API: abrí el sitio y esperá a que cargue la portada (en el plan gratuito, ~1 minuto la primera vez).
- La base gratuita de Render **vence el 14 de noviembre**; la defensa es el 5. Cargá todo con tiempo, pero no antes de los
  últimos cambios de esquema (hoy no hay ninguno pendiente).
- Cada cuenta necesita un email distinto. Sirven alias tipo `tuemail+ong1@gmail.com`: los emails automáticos te llegan a vos
  igual, porque el remitente es de prueba (§177, "Limitaciones de esta demo" en `/privacidad`).
- Para registrar una ONG o una empresa, elegí el rol en el formulario de registro.

## 1. Cuentas

| # | Rol | Nombre sugerido | Para mostrar |
|---|---|---|---|
| 1 | ONG | "Manos Verdes Córdoba" | Medio ambiente, con proyectos con meta de financiamiento |
| 2 | ONG | "Banco de Alimentos Barrial" | Alimentación, con proyectos sin meta |
| 3 | Empresa | "TecnoSur S.A." | Patrocinio y panel de la empresa |
| 4 | Voluntario/a | "Lucía Gómez" | El caso completo: CV, aprobada, horas, Momentos, reseña |
| 5 | Voluntario/a | "Martín Ruiz" | Inscripción pendiente (la ONG ve su CV) |
| 6 | Voluntario/a | "Sofía Paz" | Inscripción rechazada, seguidores |
| — | Comprador de prueba de Mercado Pago | (ya lo tenés) | Pagar las donaciones (no es una cuenta de la app) |

## 2. Orden de carga

### 2.1 ONGs (cuentas 1 y 2)
1. Registrarse como ONG.
2. **Perfil → "Editar perfil" → "Cambiar foto"**: el logo.
3. En el mismo "Editar perfil": descripción, misión, ubicación y **categoría**.
4. **Vincular Mercado Pago** (el aviso "Configurar" del Panel, o Configuración → "Cuenta de Mercado Pago"): sin cuenta vinculada la ONG no recibe donaciones y el botón "Donar" no aparece (§215). El botón OAuth no se probó en vivo; la ONG SANTI se vinculó a mano con `scripts/vincular-mp-manual.js`.
5. **Panel → "Crear voluntariado"** (en el celular, "Crear"), dos por ONG:
   - uno **fugaz** y uno **sostenido**;
   - con **imagen** (URL), **ubicación en el mapa** (paso Detalles: escribir la dirección, "Buscar en el mapa" y elegir el resultado, o tocar el mapa; el pin se arrastra. **Desde §260 es obligatoria en un presencial**: sin el pin no deja seguir), roles y requisitos;
   - en la ONG 1, con **meta de financiamiento** (por ejemplo $50.000), para que se vea la barra;
   - en la ONG 2, sin meta (para mostrar "Recaudado en donaciones").
6. En un proyecto de la ONG 1, **KPIs**: dos indicadores con valor y fecha.

### 2.2 Empresa (cuenta 3)
1. Registrarse como empresa, logo ("Cambiar foto"), industria y descripción.
2. Desde el detalle de un proyecto de la ONG 1: **"Patrocinar este proyecto"** → proponer, con mensaje.
3. **El acuerdo** (§263–§266): como empresa, Perfil → el patrocinio → **"Ver acuerdo"** y cargar puntos de su lado (uno de **Dinero** con monto, uno de **Voluntarios de la empresa**). Como ONG 1, **Patrocinios → "Ver acuerdo: puntos y charla"**: un punto de su lado (por ejemplo **Difusión**: el logo en las remeras) y un mensaje en la **charla**; la empresa contesta.
4. **Cerrar el acuerdo:** la empresa toca **"Estoy de acuerdo"** y después la ONG también (en el acuerdo o con "Aceptar" en Patrocinios). Tiene que decir **"Acuerdo cerrado: Aceptado"**. Si alguien cambia un punto en el medio, hay que volver a aceptar. (Dejá otra propuesta **pendiente** en la ONG 2, para mostrar los dos estados.)
5. Mirar el **Panel** de la empresa: los KPIs de lo patrocinado.

### 2.3 Voluntarios (cuentas 4, 5 y 6)
1. Registrarse y, en **Perfil → "Editar perfil"**: "Cambiar foto", "Sobre mí", ubicación y **habilidades**.
2. **Lucía y Martín: Configuración (menú ☰ del perfil) → "Mi CV" → subir un PDF** (inventado).
3. Seguir ONGs, proyectos y entre ellos (para que el **Inicio** y los contadores tengan datos).
4. Inscribirse:
   - Lucía en un proyecto de la ONG 1;
   - Martín en el mismo proyecto;
   - Sofía en un proyecto de la ONG 2.
5. Como **ONG 1**: en el detalle del voluntariado, aprobar a Lucía (y **cargarle horas**), dejar a Martín **pendiente**, abrir su CV con **"Ver CV"** y **"Agendar entrevista"** para Martín (fecha futura, un link `https://…` o un lugar, y una nota). No lo apruebes: al aprobar o rechazar, la entrevista se cancela sola.
   Como **ONG 2**: rechazar a Sofía.

### 2.4 Contenido y actividad
1. **Lucía**: **Crear → "Nueva publicación"** con 2 o 3 fotos del proyecto aprobado; un comentario y una **reseña** del proyecto.
2. **ONG 1**: una publicación en Momentos desde su panel.
3. **Mensajes**: Lucía ↔ ONG 1, y empresa ↔ ONG 1.
4. **Donaciones** (con el **comprador de prueba**, iniciando sesión en el checkout; ver §173). Solo a proyectos de una ONG **con Mercado Pago vinculado** (paso 2.1.4):
   - una a un proyecto **con meta** de la ONG 1;
   - una a un proyecto **sin meta** de la ONG 2.

   Cada una tiene que terminar en "¡Gracias!".

## 3. Chequeo final (antes de la defensa)

- [ ] **Portada** sin sesión: números reales (proyectos, voluntarios, ONGs; §129) y proyectos activos.
- [ ] **Explorar**: el mapa con los pines y la búsqueda.
- [ ] **Detalle** de los proyectos: la barra de financiamiento (con meta) y "Recaudado en donaciones" (sin meta).
- [ ] **"Patrocinado por"** en el proyecto con el acuerdo aceptado, y el proyecto en la pestaña Patrocinios del **perfil público de la empresa**. Sin montos a la vista.
- [ ] **Martín → Mis voluntariados → Postulaciones**: el chip **"Entrevista"** con la fecha, la hora y el link o el lugar.
- [ ] **ONG 1 → campanita**: "Nueva solicitud de inscripción" y "Recibiste una donación".
- [ ] **Perfil público** de Lucía: foto, habilidades, participaciones (con las horas de cada voluntariado, §271) y Momentos.
- [ ] **ONG 1 → una entrevista agendada → "Agregar al calendario"** (Google Calendar o `.ics`, §271).
- [ ] **Asistente** (Mensajes → "Asistente VoluntariAR", arriba de todo): responde una pregunta frecuente con los nombres de pantalla actuales (§246).
- [ ] **Configuración → "Privacidad y términos"** abre, y en el registro aparece el link.
- [ ] **Borrar mi cuenta**: probalo con una cuenta descartable (no con las de la demo).
- [ ] **Contraseñas** (§272–§275), con la cuenta descartable: Configuración → **"Cambiar contraseña"** (el ojo de cada campo muestra lo escrito) y, sin sesión, **"¿Olvidaste tu contraseña?"** en el login. El mail llega a la **casilla de prueba** (`EMAIL_REDIRECT_TO`), no a la de la cuenta; el link lleva a `/restablecer` y vence en 1 hora.
