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

---

## Descripción

VoluntariAR es una plataforma web que permite:

- **Voluntarios**: explorar proyectos sociales, inscribirse y hacer seguimiento de sus participaciones
- **ONGs**: publicar proyectos, gestionar inscripciones, aprobar/rechazar voluntarios y ver estadísticas
- **Empresas**: patrocinar voluntariados (RSE)
- **Feed público**: cualquier persona puede ver los proyectos sin registrarse

### Roles del sistema

| Rol | Acceso |
|-----|--------|
| `volunteer` | Feed, búsqueda, inscripciones, perfil, horas realizadas |
| `ngo` | Dashboard, crear/editar proyectos, gestionar voluntarios, empleados |
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
| Node.js ≥ 18 | Runtime |
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
│   24 tablas + 18 índices        │
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
│   │   │   └── AuthContext.tsx   ← Estado global de sesión
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
    │   └── routes/
    │       ├── auth.js           ← Registro, login, perfil
    │       ├── projects.js       ← CRUD proyectos + búsqueda
    │       ├── enrollments.js    ← Inscripciones + horas
    │       ├── ngos.js           ← Perfiles ONG + dashboard + empleados
    │       └── notifications.js
    ├── scripts/
    │   ├── migrate.js            ← Crea las 24 tablas + índices + datos base
    │   └── seed.js               ← 12 proyectos y usuarios de prueba
    ├── .env.example
    └── package.json
```

---

## Correr en local

### Requisitos
- Node.js ≥ 18
- npm

### Paso 1 — Clonar

```bash
git clone https://github.com/TU_USUARIO/voluntariar-mvp.git
cd voluntariar-mvp
```

### Paso 2 — Backend (Terminal 1)

```bash
cd backend

# Instalar dependencias
npm install

# Configurar entorno (en local no hay que cambiar nada)
cp .env.example .env

# Crear las 24 tablas + índices + categorías/roles/habilidades base
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
npm run dev          # Desarrollo con hot-reload
npm start            # Producción
```

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

### Sistema
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |

---

## Base de datos

### Tablas principales (24 en total)

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

Tablas N:M:
ngo_categorias          · project_categorias
project_roles           · voluntario_habilidades
empresa_voluntariados   · ngo_follows · project_follows
```

### Índices (18)

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
