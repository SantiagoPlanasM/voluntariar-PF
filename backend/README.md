# Voluntariar Backend API

API REST para la plataforma **Voluntariar – Red Social Solidaria**.  
Stack: **Node.js · Express · SQLite** (local) / **PostgreSQL** (nube).

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Registrar usuario (volunteer/ngo/company) |
| `POST` | `/api/auth/login` | ❌ | Login, devuelve JWT |
| `GET` | `/api/auth/me` | ✅ | Perfil del usuario autenticado |
| `PUT` | `/api/auth/me` | ✅ | Editar perfil |
| `GET` | `/api/projects` | ❌ | Feed de proyectos (filtros: category, type, search) |
| `GET` | `/api/projects/:id` | ❌ | Detalle de proyecto |
| `POST` | `/api/projects` | ✅ ngo | Crear proyecto |
| `PUT` | `/api/projects/:id` | ✅ ngo | Editar proyecto |
| `DELETE` | `/api/projects/:id` | ✅ ngo | Eliminar proyecto |
| `POST` | `/api/projects/:id/comments` | ✅ | Comentar proyecto |
| `POST` | `/api/projects/:id/ratings` | ✅ | Calificar proyecto |
| `POST` | `/api/enrollments` | ✅ volunteer | Inscribirse a proyecto |
| `GET` | `/api/enrollments/my` | ✅ | Mis inscripciones |
| `GET` | `/api/enrollments/project/:id` | ✅ ngo | Voluntarios de un proyecto |
| `PATCH` | `/api/enrollments/:id` | ✅ ngo | Aprobar/rechazar inscripción |
| `DELETE` | `/api/enrollments/:id` | ✅ | Cancelar inscripción |
| `GET` | `/api/ngos` | ❌ | Listar ONGs |
| `GET` | `/api/ngos/me` | ✅ ngo | Mi perfil ONG |
| `PUT` | `/api/ngos/me` | ✅ ngo | Editar perfil ONG |
| `GET` | `/api/ngos/:id` | ❌ | Perfil público de ONG |
| `GET` | `/api/ngos/:id/dashboard` | ✅ ngo | Dashboard de ONG |
| `GET` | `/api/notifications` | ✅ | Mis notificaciones |
| `PATCH` | `/api/notifications/:id/read` | ✅ | Marcar leída |
| `PATCH` | `/api/notifications/read-all` | ✅ | Marcar todas leídas |
| `GET` | `/health` | ❌ | Health check |

---

## Correr en LOCAL (SQLite – sin configuración de BD)

### Requisitos
- Node.js ≥ 18
- npm o pnpm

```bash
# 1. Clonar / descomprimir el proyecto
cd voluntariar-backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# No es necesario cambiar nada para modo local (SQLite por defecto)

# 4. Crear tablas
npm run db:migrate

# 5. Insertar datos de prueba
npm run db:seed

# 6. Levantar el servidor en modo desarrollo
npm run dev
```

El servidor queda en **http://localhost:3001**

### Usuarios de prueba (creados por seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Voluntario | maria@example.com | password123 |
| ONG | admin@sustentando.org | password123 |
| Empresa | admin@techcorp.com | password123 |

---

## Conectar el FRONT al back

En el proyecto React (Vite), crear o editar `.env`:

```
VITE_API_URL=http://localhost:3001/api
```

Luego en tu código usar `import.meta.env.VITE_API_URL` como base de las requests.

---

## Correr en la NUBE

### Opción A – Railway (recomendado, gratis para proyectos universitarios)

1. Crear cuenta en [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub** (subir el repo)  
   o usar la CLI: `npm i -g @railway/cli && railway login && railway init`
3. Agregar un plugin **PostgreSQL** al proyecto en Railway
4. En la sección **Variables** del servicio, configurar:
   ```
   USE_POSTGRES=true
   DATABASE_URL=${{Postgres.DATABASE_URL}}   ← Railway lo pone automático
   JWT_SECRET=un_secreto_largo_y_seguro
   NODE_ENV=production
   CORS_ORIGINS=https://tu-frontend.vercel.app
   ```
5. En **Settings → Start Command**: `npm run db:migrate && npm start`
6. Railway asigna una URL pública automáticamente.

---

### Opción B – Render (también gratis)

1. Crear cuenta en [render.com](https://render.com)
2. **New → Web Service** → conectar repo de GitHub
3. Build Command: `npm install`  
   Start Command: `npm run db:migrate && npm start`
4. Agregar **Environment Variables** (igual que Railway arriba)
5. Crear una **PostgreSQL Database** en Render y copiar la URL interna como `DATABASE_URL`

---

### Opción C – Supabase (solo BD) + cualquier hosting para el back

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **Settings → Database → Connection string → URI**
3. Copiar la URL (empieza con `postgresql://...`)
4. Pegarla en la variable `DATABASE_URL` del servidor (Railway / Render / VPS)
5. Poner `USE_POSTGRES=true`

---

### Variables de entorno en producción

```env
NODE_ENV=production
PORT=3001                      # Railway/Render lo sobreescriben automáticamente
USE_POSTGRES=true
DATABASE_URL=postgresql://...  # URL de la BD en la nube
JWT_SECRET=secreto_muy_largo_y_aleatorio
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://tu-front.vercel.app,https://otro-origen.com
```

> **Importante**: nunca subas el `.env` real a Git. El `.env.example` sí puede subirse.

---

## Estructura del proyecto

```
voluntariar-backend/
├── src/
│   ├── index.js              # Punto de entrada Express
│   ├── db/
│   │   └── index.js          # Adaptador SQLite / PostgreSQL
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   └── routes/
│       ├── auth.js           # Registro, login, perfil
│       ├── projects.js       # CRUD proyectos + feed
│       ├── enrollments.js    # Inscripciones
│       ├── ngos.js           # Perfiles ONG + dashboard
│       └── notifications.js  # Notificaciones
├── scripts/
│   ├── migrate.js            # Crea las tablas
│   └── seed.js               # Datos de prueba
├── data/                     # Generada automáticamente (SQLite)
│   └── voluntariar.sqlite
├── .env.example
└── package.json
```

---

## Ejemplo de uso (curl)

```bash
# Registrar usuario voluntario
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana López","email":"ana@test.com","password":"123456","role":"volunteer"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@example.com","password":"password123"}'

# Ver feed de proyectos
curl http://localhost:3001/api/projects

# Inscribirse a un proyecto (requiere token del login)
curl -X POST http://localhost:3001/api/enrollments \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"proj-1","message":"Me encantaría participar"}'
```
