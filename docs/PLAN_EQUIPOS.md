# PLAN_EQUIPOS.md — Equipo de la ONG con cuentas reales y empleados de empresa con cupos reservados

> **Estado:** plan, sin código. Pedido del usuario el 2026-10-29. Se decidió hacerlo **después de la defensa
> (5/11)**: los dos tocan permisos y la regla de cupos, que hoy están probados contra la concurrencia, y no conviene
> cambiarlos justo antes. En el IPI va como trabajo futuro.

## 1. Equipo de la ONG con cuentas reales

### Qué pidió el usuario
Vincular voluntarios como equipo de la ONG, para que puedan ver las entrevistas y "interactuar más con los
voluntariados que un usuario voluntario normal".

### Cómo está hoy
- `empleados` (§76) son **fichas sin cuenta**: nombre, apellido, email, rol (`coordinador`, `comunicador`, `admin`,
  `otro`). Nadie entra con ellas; son un directorio.
- **Todo** lo de la ONG lo hace una sola cuenta, la del usuario con `role='ngo'`. El backend lo controla en unos
  **28 lugares** de 5 archivos (`auth`, `enrollments`, `mercadopago`, `ngos`, `projects`) con
  `ngos.user_id = req.user.id`. No hay una capa central de permisos (`PROJECT_CONTEXT.md §13`).

### Propuesta
- **Tabla nueva `ngo_miembros`:** `ngo_id`, `user_id` (un usuario común, `role='volunteer'`), `rol` (`coordinador` |
  `comunicador`), `estado` (`invitado` | `activo`), `invitado_por`, `created_at`, `UNIQUE(ngo_id, user_id)`. El dueño
  sigue siendo la cuenta `ngo` (no se toca el modelo de roles de `users`).
- **Invitación con consentimiento** (como `BACKEND_ROADMAP_ANALYSIS.md §2.4`): la ONG invita por email; si la persona
  tiene cuenta, le llega una notificación y acepta o rechaza; si no, un email para registrarse y después aceptar. Sin
  aceptación no ve nada.
- **Permisos por rol** (lo que ve un miembro activo, solo de esa ONG):

  | Acción | Dueño (`ngo`) | Coordinador | Comunicador |
  |---|---|---|---|
  | Ver postulaciones, CV y entrevistas | Sí | Sí | No |
  | Aprobar o rechazar, agendar entrevistas, cargar horas | Sí | Sí | No |
  | Publicar Momentos en nombre de la ONG | Sí | Sí | Sí |
  | Crear, editar o cancelar voluntariados | Sí | No | No |
  | Mercado Pago, patrocinios, borrar la cuenta | Sí | No | No |

- **Una función central** `ngoAccess(userId, ngoId)` → `'owner' | 'coordinador' | 'comunicador' | null`, en un
  módulo nuevo (`src/lib/ngoAccess.js`), que reemplaza los `ngos.user_id = $n` de las rutas que se abren a miembros.
  Las que siguen siendo solo del dueño no cambian.
- **Frontend:** un voluntario que es miembro activo ve "Panel de <ONG>" en su menú y entra a un panel con las
  pantallas que su rol permite (las mismas de la ONG, con lo que no puede hacer oculto). Lo que se oculta es solo
  comodidad: el control real es del backend (regla 15).
- **Qué pasa con `empleados`:** se mantiene como directorio. Opcional: `empleados.user_id` para enlazar una ficha
  con el miembro.

### Pruebas que hacen falta
- `ownership.test.js`: por cada ruta abierta a miembros, un miembro de **otra** ONG, un invitado sin aceptar y un
  comunicador (donde no corresponde) reciben 403/404 y la base no cambia.
- Invitación: aceptar dos veces, rechazar, invitar a alguien que ya es miembro (409), a una ONG o una empresa (400).
- Que la entrevista y el CV respeten lo mismo que hoy (el CV solo con la postulación pendiente o aprobada).

### Riesgo y tamaño
**Grande.** Cambia el control de acceso en decenas de lugares; el riesgo es abrir algo de más. Por eso conviene la
función central con su test de permisos **antes** de tocar las rutas, y migrarlas de a una.

## 2. Empleados de empresa con cupos reservados

### Qué pidió el usuario
Vincular voluntarios a una empresa para que la empresa pueda **reservar lugares** de un voluntariado para sus
empleados.

### Cómo está hoy
- No hay vínculo entre una empresa y sus empleados. El diseño ya estaba pensado
  (`BACKEND_ROADMAP_ANALYSIS.md §2.4`, decisión de `PROJECT_ANALYSIS.md §30`): un empleado es un usuario
  `role=volunteer` vinculado a la empresa **con invitación y aceptación**.
- El acuerdo de patrocinio (§263–§266) ya tiene puntos del tipo **"Voluntarios de la empresa"**, pero son texto: no
  reservan nada.
- La regla de cupos (`cupos_ocupados <= cupos`, AI_RULES regla 20) la imponen el alta y la aprobación con un
  `UPDATE` condicional.

### Propuesta
- **`empresa_voluntarios`** (como en el roadmap): `empresa_id`, `user_id`, `cargo`, `estado` (`invitado` |
  `activo`). La empresa invita, el voluntario acepta. La empresa ve la participación de sus empleados (horas
  certificadas por voluntariado) solo si aceptaron.
- **Reserva de cupos** ligada al acuerdo de patrocinio: cuando el acuerdo se cierra con un punto "Voluntarios de la
  empresa" con **cantidad**, se crea `cupos_reservados(project_id, empresa_id, cantidad, usados)`. La ONG ve la
  reserva en el voluntariado.
- **La regla de cupos pasa a ser:** `cupos_ocupados + (reservados sin usar de todas las empresas) <= cupos`. Una
  persona común solo ocupa cupos libres; un empleado activo de la empresa usa primero los reservados de su empresa
  (`usados = usados + 1 WHERE usados < cantidad`, compare-and-swap) y después los libres.
- **Liberar:** si el voluntariado empieza, finaliza o la empresa retira el patrocinio, lo no usado vuelve a los
  libres.

### Pruebas que hacen falta
- Concurrencia en Postgres: dos empleados por el último reservado, un externo y un empleado por el último libre, y
  aprobar mientras se libera la reserva. La suma nunca pasa de `cupos`.
- Un empleado invitado (sin aceptar) no usa reservados; uno de otra empresa tampoco.

### Riesgo y tamaño
**Grande.** Toca la invariante de cupos, que hoy está probada contra carreras (§39, §40) y que no tiene `CHECK` en
la base. Conviene primero `empresa_voluntarios` (sin reservas) y después las reservas, cada una con su sección y su
mutación.

## 3. Orden propuesto (después del 5/11)
1. `ngoAccess` + tests de permisos, sin cambiar rutas.
2. Invitación al equipo de la ONG y las rutas de postulaciones, entrevistas y CV abiertas a coordinadores.
3. `empresa_voluntarios` con invitación y el panel de la empresa con sus empleados.
4. Reservas de cupos desde el acuerdo de patrocinio.

**Decisiones del usuario (2026-10-30):**
- **Roles:** alcanzan coordinador y comunicador.
- **Membresía:** una persona puede ser miembro de **varias ONG**, con un rol en cada una.
- **Empleados con lugar reservado:** **igual pasan por la ONG**. La reserva les guarda el lugar, pero la ONG aprueba.
- **Cuándo:** el **equipo de la ONG (pasos 1 y 2) se hace y se despliega antes del 2/11**, cambiando el plan
  original de dejarlo para después de la defensa. Los pasos 3 y 4 (empresa) quedan para después del 5/11.
