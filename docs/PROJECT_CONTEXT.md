# PROJECT_CONTEXT.md — VoluntariAR

> Documento maestro: leer primero. Cada capa se detalla en `BACKEND_CONTEXT.md`, `API_CONTEXT.md`,
> `DATABASE_CONTEXT.md` y `FRONTEND_CONTEXT.md`; las reglas de trabajo están en `AI_RULES.md`. Estado al 30/10/2026.

## Qué es

**VoluntariAR** es una red social de voluntariado, proyecto final de la Universidad Católica de Córdoba. Conecta tres roles (`users.role`, fijo desde el registro):

| Rol | Qué hace |
|---|---|
| `volunteer` | Explora (lista, mapa, "Para vos"), se postula (con teléfono opcional), ve sus participaciones, horas y certificados, comenta y califica, sigue ONG, proyectos y voluntarios, sube su CV privado, dona, chatea. Puede ser **miembro del equipo** de una o varias ONG |
| `ngo` | Publica y edita voluntariados (foto con encuadre, cupos, roles, requisitos, lugar en el mapa), aprueba o rechaza postulaciones, agenda entrevistas, carga horas, ve KPIs y el embudo, publica Momentos, vincula Mercado Pago, negocia patrocinios, muestra datos de transparencia e invita a su equipo (coordinación o comunicación) |
| `company` | Propone y negocia patrocinios con las ONG (acuerdo por puntos y versiones), tiene un panel de impacto y figura como patrocinadora en público |

Cualquier visitante puede explorar sin cuenta (`optionalAuth`).

## Arquitectura

Monorepo con dos paquetes npm (`backend/`, `frontend/`) y `render.yaml` para Render.

```
React 18 SPA (Vite, React Router 7, Tailwind 4) ── lib/api.ts (fetch + JWT) ──► Express 4 (Node ≥22)
                                               ◄── WebSocket (chat) ──────────  ws, mismo JWT
Express ── adaptador dual (src/db/index.js) ──► SQLite (dev y tests) | PostgreSQL (prod)
        ── servicios externos ──► Cloudinary (archivos), Resend (correo), Mercado Pago (pagos)
```

- **Backend:** rutas en `/api/auth`, `/projects` (y la foto en `projectPhoto.js`), `/enrollments`, `/ngos` (y `/ngos/me/mercadopago`), `/empresas`, `/voluntarios`, `/follows`, `/messages`, `/posts`, `/notifications`, `/faqs`, `/donaciones`, `/patrocinios`, `/equipo`. Bibliotecas en `src/lib/` (ver `BACKEND_CONTEXT.md`).
- **Base:** **38 tablas**, todas en `backend/scripts/migrate.js` (idempotente). `seed.js` carga datos de demo con ids legibles (`user-vol-1`, `ngo-1`).
- **Frontend:** un layout único, `app/layout/AppShell.tsx` (barra inferior en el celular, lateral en escritorio), usado por `Root` (`/`), `NGOLayout` (`/ngo/*`) y `CompanyLayout` (`/company/*`), estos dos con `RequireRole`. Pantallas en `app/components/`, kit en `app/ui/`, lógica pura en `app/volunteering/` y `app/team/`. Estado global: solo `AuthContext` y `ChatContext`.

## Stack

| Capa | Tecnologías |
|---|---|
| Backend | Express 4.19, `jsonwebtoken` 9, `bcryptjs` 2.4, `better-sqlite3` 13 (binarios precompilados; `backend/.npmrc` con `ignore-scripts=true`), `pg` 8, `multer` 2 (subidas), `ws` 8 (chat), `cors`, `dotenv`. Sin devDependencies: tests con `node:test`, recarga con `node --watch` |
| Frontend | React 18.3, React Router 7.13, Vite 6, Tailwind 4.1, `lucide-react`, `leaflet` (mapas con OpenStreetMap). TypeScript 7 con `strict` (`npm run typecheck`; Vite no chequea tipos). Vitest 5 + Testing Library 16 |
| Infra | Render (API, sitio estático y Postgres gratis; la base vence el 14/11/2026). CI y deploy en GitHub Actions; SonarCloud |

**No se usa** (regla 18): ORM, migraciones versionadas, Redux/Zustand, React Query, linter.

## Convenciones

- **DB en español, API y frontend en inglés.** El puente son `fmt()` / `fmtNgo()` / `fmtEmpresa()`, listas blancas: un campo nuevo que no se agregue ahí no llega al frontend.
- **IDs:** `TEXT` con UUID; las altas lo generan con `crypto.randomUUID()` y releen por id.
- **SQL:** parámetros `$1, $2...` siempre; el adaptador los traduce para SQLite (`translatePg`).
- **Errores:** `{ error: "mensaje en español" }` con su código HTTP; nunca stack traces. El cliente los relanza como `ApiError` con `status`.
- **Esquema:** solo aditivo (`CREATE TABLE IF NOT EXISTS`, `addColumnIfNotExists`).

## Sesión y permisos

- `POST /api/auth/register` y `/login` devuelven `{ token, user }`. JWT de 7 días (`JWT_EXPIRES_IN`), sin refresh ni revocación: cerrar sesión borra el token del navegador (`localStorage`, `v_token`). El secreto sale solo de `src/lib/jwtSecret.js`.
- Al cargar, `AuthContext` revalida con `GET /api/auth/me` y cierra la sesión solo ante 401 o 404 (no ante un 502 de Render dormido).
- `middleware/auth.js`: `requireAuth`, `optionalAuth`, `requireRole(rol)`. La propiedad de cada recurso se verifica en el endpoint (`WHERE ... AND ngo_id = $n`).
- **Equipo de la ONG:** `src/lib/ngoAccess.js` decide qué puede hacer sobre una ONG su cuenta o un miembro (`ngo_miembros`, roles coordinación y comunicación). Editar voluntariados, Mercado Pago y patrocinios es solo de la cuenta de la ONG.
- Las guardas de la UI (`RequireRole`) son cosméticas: la autorización real está en el backend (regla 15).

## Riesgos y deuda conocidos

- **Sin paginación real:** los listados usan un `limit` alto (Explorar pide 500).
- **Escala horizontal:** las conexiones del chat y el limitador de intentos viven en memoria.
- **Validaciones duplicadas** en los dos lados (regex de auth, palabras prohibidas). Un test exige que `backend/src/lib/badWords.js` y `frontend/src/lib/badWords.ts` sean iguales.
- En `projects.js`, `ngos.js` y `empresas.js` hay rutas registradas después de `module.exports`: es el patrón para exportar helpers (`fmt`, `validateProject`, `hasBadWord`).
- **Render gratis:** la API se duerme a los 15 minutos y la base vence el 14/11/2026.
- `NGOEmpleados` (`/ngo/empleados/:id`, fichas sin cuenta) ya no tiene links: se saca después de la defensa (`PLAN_CIERRE.md` §4).
