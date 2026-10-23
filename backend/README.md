# VoluntariAR — Backend

API REST + WebSocket de VoluntariAR. Node ≥ 22 y Express 4, con SQL a mano y parámetros `$1, $2…` (sin ORM).
Usa **SQLite** en desarrollo y tests, y **Postgres** en producción (Render), con un único adaptador en `src/db/index.js`.

> **Este archivo no lista los endpoints a propósito:** la versión anterior tenía 26 y el código tiene 88. La referencia
> es [`docs/API_CONTEXT.md`](../docs/API_CONTEXT.md) (cada ruta, con cuerpo, respuestas y errores), y la arquitectura
> está en [`docs/BACKEND_CONTEXT.md`](../docs/BACKEND_CONTEXT.md). Índice de toda la documentación:
> [`docs/README.md`](../docs/README.md).

## Correr en local

```bash
cd backend
cp .env.example .env       # sirve como está para desarrollo (en producción JWT_SECRET es obligatorio)
npm install
npm run db:reset           # migraciones + datos de prueba (SQLite)
npm run dev                # http://localhost:3001  (WebSocket del chat en ws://localhost:3001/ws)
```

Sin las variables de Cloudinary, Mercado Pago o Resend, la API arranca igual y lo dice en el log: no se pueden subir
fotos ni CV, no se puede donar y los emails se omiten. Usuarios de prueba (contraseña `Password1`):
`maria@example.com`, `juan@example.com` y `lucia@example.com` (voluntarios), `admin@sustentando.org` (ONG) y
`admin@techcorp.com` (empresa); la lista completa la imprime `npm run db:seed`. El seed no corre con `NODE_ENV=production`.

## Tests

```bash
npm test                   # todo en SQLite
npm run test:pg            # todo en Postgres (necesita uno en localhost:5432)
```

Comandos, cobertura y el Postgres en Docker: [`docs/calidad/COMO_CORRER_PRUEBAS.md`](../docs/calidad/COMO_CORRER_PRUEBAS.md).
Todo cambio se prueba también con `TZ=America/Argentina/Cordoba` (ver `CLAUDE.md`).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/index.js` | Arranque: Express, CORS, rutas, manejador de errores y WebSocket |
| `src/routes/` | Un archivo por recurso (auth, projects, enrollments, ngos, empresas, voluntarios, follows, posts, messages, notifications, donaciones, mercadopago, faqs) |
| `src/db/` | Adaptador SQLite/Postgres y traducción de SQL |
| `src/lib/` | Pagos (Mercado Pago), archivos (Cloudinary), email (Resend), validaciones, tiempo |
| `src/middleware/` | Autenticación (JWT) y roles |
| `src/ws/` | Chat en tiempo real |
| `scripts/` | `migrate.js`, `seed.js` y utilidades (por ejemplo, vincular Mercado Pago a mano) |
| `test/` | `unit/` e `integration/` (contra una base real temporal) |

## Producción

Render, definido en `render.yaml`. El servicio corre `npm run db:migrate && npm start` al arrancar. El auto-deploy
está apagado: el workflow `deploy.yml` despliega cuando el CI está en verde y después corre el smoke y el E2E contra
Mercado Pago. Variables y detalles: [`../README.md`](../README.md) → "Deploy en Render" y "Variables de entorno".
