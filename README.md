# VoluntariAR 🌱

> Red social de voluntariado — Trabajo Final de Grado, Universidad Católica de Córdoba
> Conecta voluntarios, ONG y empresas con proyectos sociales en Córdoba, Argentina

**En producción (Render, plan gratuito):** sitio <https://voluntariar-g0u6.onrender.com> · API
<https://voluntariar-api-lxq7.onrender.com/health>. La API se duerme sin uso y tarda ~1 minuto en despertar.

---

## Índice
1. [Descripción](#descripción)
2. [Stack tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Correr en local](#correr-en-local)
6. [Calidad y CI/CD](#calidad-y-cicd)
7. [Deploy en Render](#deploy-en-render)
8. [Variables de entorno](#variables-de-entorno)
9. [API](#api)
10. [Base de datos](#base-de-datos)
11. [Validaciones](#validaciones)
12. [Documentación](#documentación)

---

## Descripción

VoluntariAR es una plataforma web que permite:

- **Explorar sin cuenta:** voluntariados activos con búsqueda, filtros, categorías y mapa
- **Voluntarios:** inscribirse, seguir ONG y voluntariados, ver sus participaciones y las horas que la ONG les certifica, y recibir recomendaciones ("Para vos")
- **ONG:** publicar voluntariados (fugaces o sostenidos), aceptar o rechazar postulaciones, certificar horas, cargar KPIs de impacto y gestionar su equipo
- **Empresas:** proponer patrocinios (RSE) y ver el impacto de lo que patrocinan
- **Donaciones con Mercado Pago** (Checkout Pro, **modo prueba**): cada ONG cobra en **su propia cuenta** (marketplace); la plataforma no toca la plata ni cobra comisión
- **Momentos:** fotos de las jornadas, con "me gusta", de quien participó o de la ONG
- **Mensajes:** chat en tiempo real y un **Asistente** de preguntas frecuentes (sin IA)
- **Perfiles con foto y CV:** el CV es un PDF privado, que solo abren las ONG donde la persona se postuló, con un link que vence
- **Notificaciones** que llevan a su pantalla, **tema claro u oscuro**, y **privacidad**: "Privacidad y términos" y "Borrar mi cuenta" en Configuración, con confirmación por email

### Roles del sistema

| Rol | Acceso |
|-----|--------|
| `volunteer` | Inicio, Explorar, inscripciones, Mis voluntariados, perfil con CV, Momentos (con inscripción aprobada), mensajes, donar |
| `ngo` | Panel, crear y editar voluntariados, postulaciones, horas, KPIs, equipo, patrocinios, Momentos de sus proyectos, cuenta de Mercado Pago |
| `company` | Panel con el impacto de lo patrocinado, propuestas de patrocinio, mensajes, donar |

---

## Stack tecnológico

### Frontend
| Tecnología | Uso |
|------------|-----|
| React 18 + React Router 7 | UI y navegación SPA |
| Vite 6 | Bundler y servidor de desarrollo |
| Tailwind CSS 4 | Estilos, con tokens propios y modo oscuro (`src/styles/theme.css`) |
| TypeScript 7 | Chequeo de tipos (`npm run typecheck`) |
| Vitest 5 + Testing Library | Tests de componentes y de funciones |
| Lucide React | Íconos |

### Backend
| Tecnología | Uso |
|------------|-----|
| Node.js ≥ 22.12 | Runtime (lo exige `better-sqlite3@13`; Vitest 5 del frontend también pide ≥ 22.12) |
| Express 4 | Framework HTTP, con SQL a mano y parámetros `$1, $2…` (sin ORM) |
| pg / better-sqlite3 | PostgreSQL en producción, SQLite en desarrollo y tests |
| jsonwebtoken + bcryptjs | Sesión con JWT y hash de contraseñas |
| multer | Subida de archivos (fotos y CV) |
| ws | Chat en tiempo real (WebSocket) |

**Integraciones, por su API REST y sin SDK:** Mercado Pago (pagos y OAuth del marketplace), Cloudinary (fotos y CV privados) y Resend (emails).

### Base de datos
- **Local y tests:** SQLite (archivo generado automáticamente)
- **Producción:** PostgreSQL (Render)

El adaptador de `backend/src/db/index.js` cambia según `USE_POSTGRES` y traduce las diferencias entre los dos motores.

---

## Arquitectura

```
┌──────────────────────────────────────┐
│ Frontend (React SPA)                 │
│ AppShell (navegación por rol)        │
│ AuthContext · ChatContext            │
│ lib/api.ts → fetch() con JWT         │
└──────────────┬───────────────────────┘
               │ HTTP/JSON y WebSocket
               ▼
┌──────────────────────────────────────┐      ┌──────────────────────┐
│ Backend (Express)                    │─────▶│ Mercado Pago (REST)  │
│ CORS → JWT → requireRole             │─────▶│ Cloudinary (REST)    │
│ /api/auth /projects /enrollments     │─────▶│ Resend (REST)        │
│ /ngos /empresas /voluntarios         │      └──────────────────────┘
│ /follows /posts /messages            │
│ /notifications /donaciones /faqs     │
│ /ngos/me/mercadopago · /ws (chat)    │
└──────────────┬───────────────────────┘
               │ SQL
               ▼
┌──────────────────────────────────────┐
│ SQLite (local) · PostgreSQL (prod)   │
│ 35 tablas                            │
└──────────────────────────────────────┘
```

---

## Estructura del proyecto

```
voluntariar-PF/
├── render.yaml                     ← Servicios de Render (API, sitio y base)
├── .github/workflows/              ← ci.yml (tests, cobertura, SonarCloud), deploy.yml (deploy + smoke + E2E), load.yml (k6)
├── load/                           ← Pruebas de carga con k6 (stress, sostenido, producción)
├── docs/                           ← Documentación (índice en docs/README.md)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── layout/             ← AppShell y navConfig: la navegación de los tres roles
│       │   ├── ui/                 ← Kit propio (Button, Avatar, Meter, Sheet, …)
│       │   ├── volunteering/       ← Tarjetas y la regla de qué botón se ve (cardActions)
│       │   ├── components/         ← Pantallas
│       │   └── routes.tsx          ← Rutas
│       ├── lib/                    ← api.ts (cliente HTTP y tipos), AuthContext, ChatContext, formato de fechas, tema
│       └── styles/                 ← theme.css (tokens, modo oscuro) y fuentes
└── backend/
    ├── src/
    │   ├── index.js                ← Entrada: Express, rutas, errores y WebSocket
    │   ├── db/                     ← Adaptador SQLite / PostgreSQL
    │   ├── middleware/auth.js      ← JWT + requireRole
    │   ├── lib/                    ← payments, storage, email, inputs, tokenCrypto, rateLimit, time, …
    │   ├── routes/                 ← Un archivo por recurso (ver "API")
    │   └── ws/                     ← Chat
    ├── scripts/                    ← migrate.js, seed.js, vincular-mp-manual.js, run-tests-pg.js
    └── test/                       ← unit/ e integration/ (contra una base real temporal)
```

---

## Correr en local

### Requisitos
- Node.js ≥ 22.12 (con Node 20 o anterior, `better-sqlite3@13` no funciona: el proceso se cae con `Segmentation fault`)
- npm

### Paso 1 — Clonar

```bash
git clone https://github.com/SantiagoPlanasM/voluntariar-PF.git
cd voluntariar-PF
```

### Paso 2 — Backend (Terminal 1)

```bash
cd backend

# backend/.npmrc evita que npm intente compilar better-sqlite3 con node-gyp (el paquete ya trae
# sus binarios). Si ves errores de `node-gyp` o "Python", revisá que exista backend/.npmrc.
npm install

cp .env.example .env       # sirve como está para desarrollo
npm run db:reset           # 35 tablas + datos base + usuarios y proyectos de prueba
npm run dev                # → API en http://localhost:3001
```

Sin las variables de Cloudinary, Mercado Pago o Resend la API arranca igual y lo dice en el log: no se pueden subir
fotos ni CV, no se puede donar y los emails se omiten.

### Paso 3 — Frontend (Terminal 2)

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:3001/api
npm run dev                # → App en http://localhost:5173
```

### Verificar que funciona

`http://localhost:3001/health` responde `{"status":"ok","timestamp":"…","commit":null}` (en Render, `commit` es el
commit desplegado).

### Usuarios de prueba (solo local; el seed se niega a correr con `NODE_ENV=production`)

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

### Comandos útiles

```bash
# backend
npm run db:migrate   # crear o actualizar tablas e índices (también actualiza las respuestas del Asistente)
npm run db:seed      # datos de prueba (no duplica)
npm run db:reset     # las dos cosas, desde cero
npm run dev          # desarrollo (node --watch)
npm test             # tests contra SQLite
npm run test:pg      # los mismos tests contra PostgreSQL (necesita uno en localhost:5432)

# frontend
npm test             # tests (Vitest)
npm run test:coverage
npm run typecheck    # TypeScript 7 (nunca `npx tsc`: el paquete `tsc` de npm no es TypeScript)
npm run build
```

---

## Calidad y CI/CD

Al 23/10/2026 (CI #41): **932 tests de backend en SQLite y 934 en PostgreSQL** (en UTC y con la zona horaria de
Córdoba), **954 de frontend**, cobertura de líneas del 93,23 % y del 90,81 %, SonarCloud con 0 issues abiertas y
`npm audit` en 0.

- **CI** (`.github/workflows/ci.yml`, en cada push): tipos y build del frontend, todas las suites, cobertura con umbral,
  SonarCloud con quality gate y `npm audit`.
- **Deploy** (`deploy.yml`): solo si el CI está en verde. Dispara Render, espera a que `/health` muestre el commit nuevo y
  corre un smoke y un E2E de donación contra Mercado Pago.
- **Carga** (`load.yml`): k6, a mano.

El detalle (plan de pruebas, defectos, métricas, sesión exploratoria) está en [`docs/calidad/`](docs/calidad/), y el
informe del TP de Calidad en [`docs/calidad/informe/INFORME_TP_CALIDAD.pdf`](docs/calidad/informe/INFORME_TP_CALIDAD.pdf).
Cómo correr cada suite: [`docs/calidad/COMO_CORRER_PRUEBAS.md`](docs/calidad/COMO_CORRER_PRUEBAS.md).

---

## Deploy en Render

Render lee `render.yaml` (**New → Blueprint**) y crea la base `voluntariar-db`, la API `voluntariar-api` y el sitio
`voluntariar`. La API corre `npm run db:migrate && npm start` al arrancar.

- **El auto-deploy de Render está apagado.** Despliega `deploy.yml` con los deploy hooks de los dos servicios
  (secrets `RENDER_DEPLOY_HOOK_API` y `RENDER_DEPLOY_HOOK_WEB`), y el E2E usa sus propios secrets de la cuenta de prueba.
- **Las variables secretas** (`sync: false` en `render.yaml`) se cargan en el panel de cada servicio: `RESEND_API_KEY`,
  las tres `CLOUDINARY_*` y las de Mercado Pago (ver la tabla de abajo).

### ⚠️ Plan gratuito de Render

- Los servicios **se duermen tras 15 minutos** sin uso; el primer pedido tarda ~1 minuto.
- La base PostgreSQL gratuita **vence a los 30 días**. La de este proyecto vence el **14 de noviembre de 2026**; después
  hay que crear otra y volver a cargar los datos (`docs/DEMO_DATOS.md`).

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Local | Producción |
|----------|-------|------------|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3001` | Automático (Render) |
| `USE_POSTGRES` | `false` | `true` |
| `DATABASE_URL` | — | URL interna de Render |
| `JWT_SECRET` | el de `.env.example` | **obligatorio**, largo y seguro (sin él, la API no arranca en producción) |
| `JWT_EXPIRES_IN` | `7d` | `7d` |
| `CORS_ORIGINS` | `http://localhost:5173` | URL del sitio |
| `APP_URL` | `http://localhost:5173` | URL pública del sitio (links de los emails) |
| `RESEND_API_KEY` | vacía (los emails se omiten) | API key de Resend |
| `EMAIL_FROM` | opcional | Remitente |
| `EMAIL_REDIRECT_TO` | opcional | Modo prueba: manda todos los emails a esa casilla |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | vacías (no se suben fotos ni CV: 503) | Las tres, de la cuenta de Cloudinary |
| `CLOUDINARY_FOLDER` | opcional | Carpeta de los archivos |
| `MP_ACCESS_TOKEN` | vacía (no se puede donar) | Token de la aplicación de Mercado Pago |
| `MP_WEBHOOK_SECRET` | opcional | Clave para validar la firma de los avisos |
| `MP_TOKEN_KEY` | opcional | Clave (32 bytes en base64) para cifrar los tokens de las ONG. **Tiene que ser la misma en Render y en el `.env` local** |
| `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI` | opcionales | OAuth para que cada ONG vincule su cuenta (hecho, sin probar en vivo) |

### Frontend (`frontend/.env`)

| Variable | Local | Producción |
|----------|-------|------------|
| `VITE_API_URL` | `http://localhost:3001/api` | `https://voluntariar-api-lxq7.onrender.com/api` |

---

## API

Cada ruta, con su autenticación, cuerpo, respuestas y errores, está en [`docs/API_CONTEXT.md`](docs/API_CONTEXT.md)
(88 rutas). Acá van los grupos:

| Prefijo | Archivo | Qué hace |
|---|---|---|
| `/api/auth` | `routes/auth.js` | Registro, login, perfil propio, foto, borrar la cuenta |
| `/api/projects` | `routes/projects.js` | Voluntariados: listado y búsqueda, detalle, alta y edición, comentarios, reseñas, recomendaciones, KPIs |
| `/api/enrollments` | `routes/enrollments.js` | Inscripciones: postularse, cancelar, aceptar o rechazar (ONG) y certificar horas (ONG) |
| `/api/ngos` | `routes/ngos.js` | Perfil de ONG, panel, equipo |
| `/api/ngos/me/mercadopago` | `routes/mercadopago.js` | Vincular y desvincular la cuenta de Mercado Pago de la ONG |
| `/api/empresas` | `routes/empresas.js` | Perfil de empresa, patrocinios, panel |
| `/api/voluntarios` | `routes/voluntarios.js` | Perfil de voluntario, habilidades, CV |
| `/api/follows` | `routes/follows.js` | Seguir ONG, voluntariados y voluntarios; el Inicio |
| `/api/posts` | `routes/posts.js` | Momentos: publicar fotos, "me gusta", moderación |
| `/api/messages` | `routes/messages.js` | Chat (REST); los mensajes nuevos llegan por WebSocket en `/ws` |
| `/api/notifications` | `routes/notifications.js` | Notificaciones y no leídas |
| `/api/donaciones` | `routes/donaciones.js` | Donar con Mercado Pago, la vuelta del pago y el aviso (webhook) |
| `/api/faqs` | `routes/faqs.js` | El Asistente de preguntas frecuentes |
| `/api/categorias`, `/api/roles`, `/api/habilidades` | `src/index.js` | Catálogos |
| `/health` | `src/index.js` | Estado y commit desplegado |

---

## Base de datos

**35 tablas**, creadas por `scripts/migrate.js`, que también agrega columnas e índices y actualiza los datos base sin
borrar nada. Detalle de cada tabla y columna: [`docs/DATABASE_CONTEXT.md`](docs/DATABASE_CONTEXT.md).

| Grupo | Tablas |
|---|---|
| Usuarios y perfiles | `users`, `voluntarios`, `ngos`, `empresas`, `empleados`, `account_deletion_tokens` |
| Catálogos | `categorias`, `habilidades`, `roles`, `faqs` |
| Voluntariados | `projects`, `requisitos`, `kpis`, `enrollments`, `comments`, `ratings`, `reuniones` |
| Plata | `donaciones`, `ngo_cuentas_mp`, `mp_oauth_states` |
| Social | `posts`, `post_media`, `post_likes`, `messages`, `notifications` |
| Relaciones N:M | `ngo_categorias`, `empresa_categorias`, `project_categorias`, `project_roles`, `voluntario_habilidades`, `empresa_voluntariados`, `ngo_follows`, `project_follows`, `volunteer_follows` |

---

## Validaciones

Todo lo que llega del cliente se valida **en el servidor**: primero el tipo, después los límites, y el error vuelve
como `400` con un mensaje en español. El frontend repite algunas reglas para avisar antes de enviar, pero no reemplaza
al backend. Las principales:

| Campo | Regla |
|-------|-------|
| Email | Formato `algo@dominio.xx`, hasta 254 caracteres (el tope va antes del regex) |
| Contraseña | De 8 caracteres a 72 bytes (límite de bcrypt), con una mayúscula y un número |
| Nombre y apellido | Solo letras y espacios, al menos 2 caracteres |
| Monto de una donación | Pesos enteros, de $100 a $500.000 |
| Fotos y CV | El tipo se lee de los primeros bytes (JPEG, PNG o WebP; PDF), no del que declara el navegador; hasta 8.000.000 bytes |
| Cupos, horas, reseñas | Enteros estrictos (`"3.7"` o `"1e21"` se rechazan) |
| Comentarios y publicaciones | Palabras no permitidas, por palabra completa y sin distinguir acentos |
| Rol, estados, montos | También con `CHECK` en la base |

Con el código de cada regla y sus tests: sección 5 del [informe del TP](docs/calidad/informe/INFORME_TP_CALIDAD.pdf).

---

## Documentación

El índice de toda la documentación, con qué es vigente y qué es histórico, está en [`docs/README.md`](docs/README.md).
Para trabajar en el código, empezar por [`CLAUDE.md`](CLAUDE.md) y [`docs/AI_RULES.md`](docs/AI_RULES.md).

---

## Licencia

Proyecto académico — Universidad Católica de Córdoba
