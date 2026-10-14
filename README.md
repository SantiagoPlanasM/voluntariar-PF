# VoluntariAR 🌱

> Red Social Solidaria — Proyecto universitario UCC  
> Conecta voluntarios con proyectos sociales en Córdoba, Argentina

---

## Índice
1. [Descripción](#descripción)
2. [Stack tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Correr en local](#correr-en-local)
6. [Deploy en Render](#deploy-en-render)
7. [Variables de entorno](#variables-de-entorno)
8. [Endpoints de la API](#endpoints-de-la-api)
9. [Base de datos](#base-de-datos)
10. [Validaciones](#validaciones)
11. [Documentación técnica](#documentación-técnica)

---

## Descripción

VoluntariAR es una plataforma web que permite:

- **Voluntarios**: explorar proyectos sociales, inscribirse y hacer seguimiento de sus participaciones
- **ONGs**: publicar proyectos, gestionar inscripciones, aprobar/rechazar voluntarios y ver estadísticas
- **Empresas**: patrocinar voluntariados (RSE)
- **Momentos**: voluntarios y ONGs comparten fotos de las jornadas (estilo Instagram, con "me gusta"); cualquier persona puede verlas
- **Feed público**: cualquier persona puede ver los proyectos sin registrarse

### Roles del sistema

| Rol | Acceso |
|-----|--------|
| `volunteer` | Feed, búsqueda, inscripciones, perfil, horas realizadas, publicar Momentos (con inscripción aprobada) |
| `ngo` | Dashboard, crear/editar proyectos, gestionar voluntarios, empleados, publicar y moderar Momentos de sus proyectos |
| `company` | Registro y patrocinio de voluntariados |

---

## Stack tecnológico

### Frontend
| Tecnología | Uso |
|------------|-----|
| React 18 | UI |
| React Router 7 | Navegación SPA |
| Vite | Bundler |
| Tailwind CSS 4 | Estilos |
| Lucide React | Íconos |

### Backend
| Tecnología | Uso |
|------------|-----|
| Node.js ≥ 22.12 | Runtime (lo exige `better-sqlite3@13`; el test runner del frontend, Vitest 5, pide ≥ 22.12) |
| Express 4 | Framework HTTP |
| JWT (jsonwebtoken) | Autenticación |
| bcryptjs | Hash de contraseñas |
| pg | Cliente PostgreSQL |
| better-sqlite3 | Base de datos local |

### Base de datos
- **Local**: SQLite (archivo `data/voluntariar.sqlite`, generado automáticamente)
- **Producción**: PostgreSQL (Render)

El adaptador en `backend/src/db/index.js` cambia automáticamente según `USE_POSTGRES`.

---

## Arquitectura

```
┌─────────────────────────────────┐
│   Frontend (React SPA)          │
│   React Router + AuthContext    │
│   api.ts → fetch() → JWT        │
└────────────┬────────────────────┘
             │ HTTP / JSON
             ▼
┌─────────────────────────────────┐
│   Backend (Express)             │
│   CORS → JWT Middleware         │
│   /auth /projects /enrollments  │
│   /ngos /notifications          │
│   /categorias /roles /habilidades│
│   Validaciones email/pass/datos │
└────────────┬────────────────────┘
             │ SQL
             ▼
┌─────────────────────────────────┐
│   Base de datos                 │
│   SQLite (local)                │
│   PostgreSQL (producción)       │
│   31 tablas + 31 índices        │
└─────────────────────────────────┘
```

---

## Estructura del proyecto

```
voluntariar-v2/
├── render.yaml                   ← Config automática para Render
├── README.md
├── .gitignore
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/       ← Pantallas y componentes UI
│   │   │   └── routes.tsx        ← Definición de rutas
│   │   ├── lib/
│   │   │   ├── api.ts            ← Cliente HTTP centralizado + tipos
│   │   │   ├── AuthContext.tsx   ← Estado global de sesión
│   │   │   ├── ChatContext.tsx   ← Chat en tiempo real (WebSocket)
│   │   │   ├── format.ts         ← Fechas ("hace 5 min"), recorte de textos
│   │   │   └── imageCompress.ts  ← Compresión de fotos en el navegador (Momentos)
│   │   └── styles/               ← CSS global + Tailwind
│   ├── .env.example
│   └── package.json
└── backend/
    ├── src/
    │   ├── index.js              ← Entry point Express
    │   ├── db/
    │   │   └── index.js          ← Adaptador SQLite / PostgreSQL
    │   ├── middleware/
    │   │   └── auth.js           ← JWT verify + requireRole
    │   ├── lib/
    │   │   ├── email.js          ← Envío de emails (Resend) + modo prueba
    │   │   ├── emailTemplates.js
    │   │   ├── storage.js        ← Fotos en Cloudinary (subida/borrado firmados)
    │   │   └── time.js           ← Fechas iguales en SQLite y PostgreSQL
    │   └── routes/
    │       ├── auth.js           ← Registro, login, perfil
    │       ├── projects.js       ← CRUD proyectos + búsqueda
    │       ├── enrollments.js    ← Inscripciones + horas
    │       ├── ngos.js           ← Perfiles ONG + dashboard + empleados
    │       ├── empresas.js       ← Perfiles de empresa + patrocinios + dashboard
    │       ├── voluntarios.js    ← Perfil de voluntario + habilidades
    │       ├── follows.js        ← Seguir ONGs/proyectos + feed
    │       ├── messages.js       ← Chat (REST + WebSocket)
    │       ├── notifications.js
    │       ├── faqs.js           ← Chatbot de preguntas frecuentes
    │       └── posts.js          ← Momentos: fotos, "me gusta", moderación
    ├── scripts/
    │   ├── migrate.js            ← Crea las 31 tablas + índices + datos base
    │   └── seed.js               ← 12 proyectos y usuarios de prueba
    ├── .env.example
    └── package.json
```

---

## Correr en local

### Requisitos
- Node.js ≥ 22.12 (con Node 20 o anterior, `better-sqlite3@13` directamente no funciona: el proceso se cae con `Segmentation fault`)
- npm

### Paso 1 — Clonar

```bash
git clone https://github.com/TU_USUARIO/voluntariar-mvp.git
cd voluntariar-mvp
```

### Paso 2 — Backend (Terminal 1)

```bash
cd backend

# Instalar dependencias (no hace falta ningún flag).
# backend/.npmrc evita que npm intente compilar better-sqlite3 con node-gyp (pide Python +
# herramientas de C++ y, si faltan, aborta toda la instalación). El paquete ya trae sus
# binarios compilados. Si ves errores de `node-gyp` o "Python", revisá que exista backend/.npmrc.
npm install

# Configurar entorno (en local no hay que cambiar nada)
cp .env.example .env

# Crear las 31 tablas + índices + categorías/roles/habilidades base
npm run db:migrate

# Insertar 12 proyectos y usuarios de prueba
npm run db:seed

# Levantar el servidor
npm run dev
# → API corriendo en http://localhost:3001
```

### Paso 3 — Frontend (Terminal 2)

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env
# Abrí el .env y asegurate que diga:
# VITE_API_URL=http://localhost:3001/api

# Levantar
npm run dev
# → App corriendo en http://localhost:5173
```

### Verificar que funciona

Abrí `http://localhost:3001/health` en el navegador.  
Debe responder: `{"status":"ok","timestamp":"..."}`

### Usuarios de prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| Voluntario | maria@example.com | Password1 |
| Voluntario | juan@example.com | Password1 |
| Voluntario | lucia@example.com | Password1 |
| ONG | admin@sustentando.org | Password1 |
| ONG | admin@greencba.org | Password1 |
| ONG | admin@bancoalimentos.org | Password1 |
| ONG | admin@techsocial.org | Password1 |
| Empresa | admin@techcorp.com | Password1 |

### Comandos útiles del backend

```bash
npm run db:migrate   # Crear/actualizar tablas e índices
npm run db:seed      # Insertar datos de prueba (no duplica)
npm run db:reset     # Recrear todo desde cero
npm run dev          # Desarrollo con hot-reload (node --watch: reinicia al guardar un módulo)
npm start            # Producción
npm test             # Tests del backend contra SQLite
npm run test:pg      # Los mismos tests contra PostgreSQL real (variables TEST_PG_*, base `voluntariar_test`)
```

### Tests

```bash
cd backend  && npm test && npm run test:pg   # 347 tests en SQLite, 349 en PostgreSQL (+2 solo de Postgres)
cd frontend && npm test                      # 314 tests (Vitest)
cd frontend && npm run typecheck                # chequeo de tipos (TypeScript 7; 0 errores)
```
*(Cifras al 2026-10-13; el historial y lo que NO se pudo verificar está en `docs/PROJECT_ANALYSIS.md`.)*

---

## Deploy en Render

Render lee `render.yaml` en la raíz y crea los servicios automáticamente.

### Pasos

**1. Subir a GitHub**
```bash
git init
git add .
git commit -m "feat: VoluntariAR MVP"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/voluntariar-mvp.git
git push -u origin main
```

**2. En Render**
- Crear cuenta en [render.com](https://render.com)
- **New → Blueprint** → conectar el repo
- Render crea automáticamente:
  - PostgreSQL (`voluntariar-db`)
  - Backend (`voluntariar-api`)
  - Frontend (`voluntariar`)

**3. Variables de entorno en Render**

En `voluntariar-api` → Environment:

| Variable | Valor |
|----------|-------|
| `JWT_SECRET` | Generá uno: `openssl rand -base64 32` |
| `CORS_ORIGINS` | URL del frontend, ej: `https://voluntariar.onrender.com` |

En `voluntariar` (frontend) → Environment:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | URL del backend + `/api`, ej: `https://voluntariar-api.onrender.com/api` |

**4. Manual Deploy** en ambos servicios.

### ⚠️ Plan gratuito de Render

- Los servicios **se duermen tras 15 min** sin uso. La primera request tarda ~30s.
- La BD PostgreSQL gratuita **expira a los 90 días**.
- Para la demo, abrí el backend 2 minutos antes para que despierte.

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Local | Producción |
|----------|-------|------------|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3001` | Automático (Render) |
| `USE_POSTGRES` | `false` | `true` |
| `DATABASE_URL` | — | URL interna de Render |
| `JWT_SECRET` | cualquier string | string largo y seguro |
| `JWT_EXPIRES_IN` | `7d` | `7d` |
| `CORS_ORIGINS` | `http://localhost:5173` | URL del frontend en Render |
| `APP_URL` | `http://localhost:5173` | URL pública del frontend (links de los emails) |
| `RESEND_API_KEY` | vacía (los emails se omiten) | API key de Resend |
| `EMAIL_FROM` | opcional | Remitente (default: dominio de pruebas de Resend) |
| `EMAIL_REDIRECT_TO` | opcional | Modo prueba: manda TODOS los emails a esa casilla |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | vacías (Momentos responde 503 al publicar) | Las tres, de la cuenta de Cloudinary |
| `CLOUDINARY_FOLDER` | opcional | Carpeta de las fotos (vacío = sin carpeta) |

> **En Render:** `render.yaml` ya declara `APP_URL` y `EMAIL_FROM` con su valor, y `RESEND_API_KEY` y las tres `CLOUDINARY_*` con `sync: false` (el valor no va en el repo: se carga en el panel del servicio, *Environment*). Las opcionales (`EMAIL_REDIRECT_TO`, `CLOUDINARY_FOLDER`) no están declaradas: si las querés, agregalas a mano en el panel. Sin `CLOUDINARY_*` publicar un Momento responde 503; sin `RESEND_API_KEY` los emails se omiten.

### Frontend (`frontend/.env`)

| Variable | Local | Producción |
|----------|-------|------------|
| `VITE_API_URL` | `http://localhost:3001/api` | `https://voluntariar-api.onrender.com/api` |

---

## Endpoints de la API

### Autenticación
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Registrar (volunteer/ngo/company) |
| `POST` | `/api/auth/login` | ❌ | Login → JWT |
| `GET` | `/api/auth/me` | ✅ | Perfil + perfil extendido |
| `PUT` | `/api/auth/me` | ✅ | Editar perfil |

### Proyectos
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/projects` | ❌ | Feed con filtros: category, type, search |
| `GET` | `/api/projects/:id` | ❌ | Detalle + comentarios + ratings |
| `POST` | `/api/projects` | ✅ ngo | Crear proyecto |
| `PUT` | `/api/projects/:id` | ✅ ngo | Editar proyecto |
| `DELETE` | `/api/projects/:id` | ✅ ngo | Eliminar proyecto |
| `POST` | `/api/projects/:id/comments` | ✅ | Comentar |
| `POST` | `/api/projects/:id/ratings` | ✅ | Calificar (1–5) |

### Inscripciones
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/enrollments` | ✅ volunteer | Inscribirse a un proyecto |
| `GET` | `/api/enrollments/my` | ✅ | Mis inscripciones |
| `GET` | `/api/enrollments/project/:id` | ✅ ngo | Voluntarios de un proyecto |
| `PATCH` | `/api/enrollments/:id` | ✅ ngo | Aprobar o rechazar |
| `PATCH` | `/api/enrollments/:id/horas` | ✅ volunteer | Registrar horas realizadas |
| `DELETE` | `/api/enrollments/:id` | ✅ | Cancelar inscripción |

### ONGs
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/ngos` | ❌ | Listar ONGs |
| `GET` | `/api/ngos/me` | ✅ ngo | Mi perfil + stats |
| `PUT` | `/api/ngos/me` | ✅ ngo | Editar perfil ONG |
| `GET` | `/api/ngos/:id` | ❌ | Perfil público de ONG |
| `GET` | `/api/ngos/:id/projects` | ❌ | Proyectos de una ONG |
| `GET` | `/api/ngos/:id/dashboard` | ✅ ngo | Stats + inscripciones pendientes |
| `GET` | `/api/ngos/:id/empleados` | ✅ ngo | Equipo de la ONG |
| `POST` | `/api/ngos/:id/empleados` | ✅ ngo | Agregar empleado |

### Catálogos
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/categorias` | ❌ | Lista de categorías |
| `GET` | `/api/roles` | ❌ | Lista de roles disponibles |
| `GET` | `/api/habilidades` | ❌ | Lista de habilidades |

### Momentos (fotos de voluntariados)
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/posts` | opcional | Lista paginada (`limit`/`offset`; filtros `project_id`, `user_id`) |
| `GET` | `/api/posts/:id` | opcional | Una publicación |
| `GET` | `/api/posts/eligible-projects` | volunteer/ngo | Proyectos en los que se puede publicar |
| `POST` | `/api/posts` | volunteer/ngo | Publicar (multipart: `project_id`, `caption`, hasta 5 `photos`) |
| `POST` / `DELETE` | `/api/posts/:id/like` | ✅ | Dar / quitar "me gusta" |
| `DELETE` | `/api/posts/:id` | ✅ | Borrar (el autor o la ONG dueña del proyecto) |

> La lista completa y las formas exactas de las respuestas están en `docs/API_CONTEXT.md` (este README resume solo los grupos principales).

### Sistema
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |

---

## Base de datos

### Tablas principales (31 en total; detalle completo en `docs/DATABASE_CONTEXT.md`)

```
users               id · name · email · password · role (CHECK)
voluntarios         id · user_id → users · nombre · apellido · cv_url
ngos                id · user_id → users · nombre · mision · alias
empresas            id · user_id → users · nombre · industria
empleados           id · ngo_id → ngos · nombre · apellido · rol (CHECK)
categorias          id · nombre · descripcion · icono
habilidades         id · nombre · descripcion
roles               id · nombre · descripcion
projects            id · ngo_id → ngos · titulo · tipo (CHECK) · status (CHECK)
                    cupos · cupos_ocupados (CHECK ≥ 0)
                    meta_financiera · recaudado · costo (CHECK ≥ 0)
requisitos          id · project_id → projects · descripcion
kpis                id · project_id → projects · nombre · valor
enrollments         id · user_id · project_id · status (CHECK)
                    horas_realizadas · UNIQUE(user_id, project_id)
donaciones          id · user_id · project_id · ngo_id · monto (CHECK > 0)
reuniones           id · empleado_id · user_id · project_id · estado (CHECK)
comments            id · project_id · user_id · comment
ratings             id · project_id · user_id · rating (CHECK 1-5)
notifications       id · user_id · type · title · read
posts               id · user_id → users · project_id → projects · caption · created_at   (Momentos)
post_media          id · post_id → posts · url · provider_id (Cloudinary) · position
post_likes          post_id → posts · user_id → users   (PK compuesta: un me gusta por persona)

Tablas N:M:
ngo_categorias          · project_categorias
project_roles           · voluntario_habilidades
empresa_voluntariados   · ngo_follows · project_follows
```

### Índices

Todos los campos de búsqueda frecuente tienen índice:
`enrollments(user_id)`, `enrollments(project_id)`, `enrollments(status)`,
`projects(ngo_id)`, `projects(status)`, `projects(tipo)`,
`comments(project_id)`, `ratings(project_id)`,
`notifications(user_id)`, `kpis(project_id)`, `reuniones(project_id)`, etc.

---

## Validaciones

Todas las validaciones corren en **frontend y backend**:

| Campo | Regla |
|-------|-------|
| Email | Formato real con regex, rechaza `a@a` |
| Nombre | Solo letras y espacios, mínimo 2 caracteres |
| Contraseña | Mínimo 8 chars + 1 mayúscula + 1 número |
| Rol | CHECK en BD: `volunteer`, `ngo`, `company` |
| Ubicación | Obligatoria (acepta "Remoto") |
| Duración | Obligatoria para proyectos fugaces |
| Horas semanales | Número positivo obligatorio para proyectos sostenidos |
| Cupos | Entero positivo obligatorio |
| Valores monetarios | CHECK `>= 0` en BD |
| Comentarios | Blacklist básica de palabras |

---

## Licencia

Proyecto académico — Universidad Católica de Córdoba

---

## Documentación técnica

La carpeta [`docs/`](docs/) contiene el detalle de cada parte del proyecto:

| Archivo | Contenido |
|---|---|
| [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) | Visión general, flujos y rutas del sistema |
| [`BACKEND_CONTEXT.md`](docs/BACKEND_CONTEXT.md) | Backend: estructura, variables de entorno, emails, fotos |
| [`DATABASE_CONTEXT.md`](docs/DATABASE_CONTEXT.md) | Las 31 tablas, columnas, restricciones e índices |
| [`API_CONTEXT.md`](docs/API_CONTEXT.md) | Todos los endpoints y la forma exacta de sus respuestas |
| [`FRONTEND_CONTEXT.md`](docs/FRONTEND_CONTEXT.md) | Rutas, componentes y reglas del frontend (incluye Momentos) |
| [`AI_RULES.md`](docs/AI_RULES.md) | Reglas de trabajo del proyecto |
| [`BACKEND_ROADMAP_ANALYSIS.md`](docs/BACKEND_ROADMAP_ANALYSIS.md) | Análisis de lo que falta del roadmap |
| [`PROJECT_ANALYSIS.md`](docs/PROJECT_ANALYSIS.md) | Historial de decisiones, bugs, errores propios y **lo que no se pudo verificar** |

