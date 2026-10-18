# COMO_CORRER_PRUEBAS.md — Un comando por tipo de prueba

> TP de Calidad, entregable "código de las pruebas: unitarias, integración, smoke, stress y esfuerzo; todas
> ejecutables con un comando". Todo corre igual en el pipeline (`.github/workflows/`) y en local.

## Requisitos

- **Node ≥ 22** e instalar las dependencias: `npm install` en `backend/` y en `frontend/`.
- **Para Postgres:** un Postgres 16 en `localhost:5432`, por ejemplo
  `docker run --rm -d -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=voluntariar_test postgres:16`.
- **Para la carga:** [k6](https://k6.io) instalado, o Docker con la imagen `grafana/k6` (abajo).

## Comandos

| Tipo | Comando | Dónde | Qué corre |
|---|---|---|---|
| **Unitarias + integración (API) del backend, SQLite** | `npm test` | `backend/` | `node --test`: `test/unit/` y `test/integration/` contra una base SQLite temporal (808 en el CI #15; 807 reales) |
| **Las mismas contra Postgres** | `npm run test:pg` | `backend/` | Toda la suite contra Postgres 16 (810: +2 de concurrencia real) |
| Con la zona horaria de Córdoba | `TZ=America/Argentina/Cordoba npm test` (en PowerShell: `$env:TZ='America/Argentina/Cordoba'; npm test`) | `backend/` | Detecta fechas corridas un día |
| **Cobertura del backend** | `node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include='scripts/**'` | `backend/` | La misma medición que el CI |
| **Unitarias / componentes del frontend** | `npm test` | `frontend/` | Vitest + Testing Library (699) |
| **Cobertura del frontend** | `npm run test:coverage` | `frontend/` | Falla si las líneas bajan del 80 % |
| **Tipos** | `npm run typecheck` | `frontend/` | TypeScript 7 (nunca `npx tsc`) |
| **Scripts del pipeline** (gate, post-deploy, reporte de carga) | `node --test ".github/scripts/*.test.js"` y `node --test "load/lib/*.test.js"` | raíz | **Con comillas:** una carpeta suelta no anda (§189) |
| **Smoke** (solo lectura) | `API_URL=https://voluntariar-api-lxq7.onrender.com WEB_URL=https://voluntariar-g0u6.onrender.com node .github/scripts/post-deploy.js smoke` | raíz | `/health`, proyectos, estadísticas, portada y `/explore` |
| **E2E con Mercado Pago** | `API_URL=… E2E_EMAIL=… E2E_PASSWORD=… node .github/scripts/post-deploy.js e2e` | raíz | Necesita la cuenta voluntaria dedicada. Crea **una** donación pendiente (no paga) |
| **Stress** | `k6 run -e BASE_URL=http://localhost:3001 load/stress.js` | raíz | Rampa hasta 100 usuarios; umbral hasta 50 |
| **Esfuerzo sostenido** | `k6 run -e BASE_URL=http://localhost:3001 load/soak.js` | raíz | 20 usuarios × 10 min (`-e SOAK_DURATION=1m` para una prueba corta, que no es la oficial) |
| **Carga corta en producción** | `k6 run -e BASE_URL=https://voluntariar-api-lxq7.onrender.com load/prod.js` | raíz | 10 usuarios × 2 min. **Nunca después del 25/10/2026** |

**Stress y esfuerzo sostenido sin instalar k6** (Docker; en Windows, `host.docker.internal` llega a la API local):

```
docker run --rm -v "$PWD:/work" -w /work grafana/k6:2.3.0 run -e BASE_URL=http://host.docker.internal:3001 load/stress.js
```

**La API local para la carga** (base temporal con datos de demo, sin servicios externos):

```
cd backend
SQLITE_PATH=/tmp/carga.sqlite NODE_ENV=development node scripts/migrate.js
SQLITE_PATH=/tmp/carga.sqlite NODE_ENV=development node scripts/seed.js
SQLITE_PATH=/tmp/carga.sqlite NODE_ENV=development PORT=3001 node src/index.js
```

## En el pipeline

| Workflow | Cuándo | Qué hace |
|---|---|---|
| **CI** (`ci.yml`) | Cada push a `main` y cada PR | Backend en SQLite y Postgres × UTC y Córdoba, con cobertura (umbral 80 %); frontend (tests, cobertura, tipos y build); `npm audit`; SonarCloud + el gate del TP |
| **Deploy** (`deploy.yml`) | Cuando el CI de un push a `main` termina en verde (o a mano) | Deploy hooks de Render → espera el commit nuevo en `/health` → smoke → E2E de Mercado Pago |
| **Carga** (`load.yml`) | A mano ("Run workflow") | Stress + esfuerzo sostenido contra la API del runner; con la opción `produccion`, además la carga corta en Render |

Los reportes quedan en el **resumen de cada run** y como **artefactos**: `tap.txt` y `lcov.info` del backend, `junit.xml` y `coverage/` del frontend, y `stress`/`soak`/`prod` (`.md` y `.json`) de la carga.

## Regenerar el informe en PDF

Después de editar `docs/calidad/informe/INFORME_TP_CALIDAD.html` (por ejemplo, para completar la carátula):

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --no-pdf-header-footer --print-to-pdf="C:\…\docs\calidad\informe\INFORME_TP_CALIDAD.pdf" "file:///C:/…/docs/calidad/informe/INFORME_TP_CALIDAD.html"
```

O abrir el HTML en Chrome → Imprimir → Guardar como PDF (márgenes predeterminados, sin encabezados ni pies).
