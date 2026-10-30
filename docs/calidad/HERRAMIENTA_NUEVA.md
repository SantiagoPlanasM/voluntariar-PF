# HERRAMIENTA_NUEVA.md — Incorporación de SonarCloud (proceso de 5 pasos) y mapa de herramientas

> TP de Calidad, **eje 8**. La herramienta nueva es **SonarCloud** (SonarQube Cloud), elegida por el usuario
> (decisión D5, 2026-10-17). Se documentan los 5 pasos, la matriz de decisión con los pesos que eligió el usuario y
> el despliegue incremental, con los runs reales. Detalle técnico en `PROJECT_ANALYSIS.md §188–§206`.

## Paso 1 — Requisitos

Necesidad: el TP pide un **quality gate que bloquee** ante bugs críticos, duplicación > 5 % y cobertura del código
nuevo < 80 %, con **análisis estático y reporte automático** en el pipeline. El proyecto no tenía linter ni medición
de duplicación (`docs/archivo/contexto-2026-10-30/PROJECT_CONTEXT.md §4`).

Requisitos de la herramienta:
1. Medir bugs y vulnerabilidades por severidad, duplicación y cobertura **del código nuevo** (no solo total).
2. Correr en **GitHub Actions** y bloquear el pipeline.
3. Dejar un **reporte por análisis**, consultable por web y por API.
4. **Gratis** para un repo público.
5. **No sumar dependencias de producción** (regla 18 de `AI_RULES.md`): servicio externo, binario o devDependency.
6. **Usable y explicable en los 9 días** que quedaban hasta la entrega.

## Paso 2 — Mercado (4 alternativas)

| Candidato | Qué cubre | Cómo corre | Costo / licencia | Verificación (2026-10-17) |
|---|---|---|---|---|
| **SonarCloud** | Bugs, vulnerabilidades, code smells, duplicación, cobertura del código nuevo, complejidad, deuda, gate, PR decoration | Servicio externo + `SonarSource/sonarqube-scan-action@v8` (lee el `lcov` del CI) | Gratis en repos públicos | **Probado** (pasos 3 y 5). El plan gratis **no permite gates propios** (solo "Sonar way"; búsqueda en la doc y la comunidad de Sonar, §188). Por eso el gate del TP se evalúa con un script propio sobre las métricas del análisis |
| **ESLint + jscpd + gate propio** | Lint (bugs de patrón), duplicación con `--threshold` | Todo en el runner, devDependencies | MIT, gratis | No probado. Lo más caro: la **cobertura del código nuevo** habría que construirla a mano (`lcov` + `git diff`) |
| **Codacy** | Análisis estático, duplicación, cobertura, **gates con umbrales configurables**, checks en los PR | Servicio externo | **Plan Team gratis para open source** (página oficial de precios) | Por documentación y fuentes de terceros, **sin prueba de concepto**. No se confirmó una acción oficial de GitHub Actions |
| **Qlty** (sucesor de Code Climate) | Análisis estático, duplicación, cobertura de diff, quality gates | Servicio + CLI open source (Rust) | Gratis para open source según terceros; el CLI es gratis | Por documentación oficial (funciones) y terceros (precios), **sin prueba de concepto**. Producto separado desde dic. 2024 |

## Paso 3 — Prueba de concepto

En una rama aparte (`sonar-poc`), con un PR (#1) a `main`, sin tocar `main` hasta que funcionara (§188–§190):
- `sonar-project.properties`, el job `sonar` del CI y `.github/scripts/sonar-gate.js`: el gate del TP sobre las métricas del análisis, con tests primero, 11 tests y 13 mutantes muertos.
- **Run #4: en rojo**, por un error real del pipeline: `node --test <carpeta>` no corría los tests del gate. Es el **primer run fallido real** (§189). Se corrigió en un commit posterior.
- **Run #5: en verde.** El análisis del PR funcionó: cobertura 86,3 %, duplicación 2,2 % y la consulta de bugs críticos andando.

## Paso 4 — Matriz de decisión

Pesos elegidos por el usuario (suman 100). Puntajes de 1 a 5. El total ponderado está en una escala de 0 a 100 (Σ puntaje × peso / 5).

| Criterio | Peso | SonarCloud | ESLint+jscpd+gate | Codacy | Qlty |
|---|---|---|---|---|---|
| Cubre los 3 umbrales del gate del TP | 25 | 4 | 2 | 4 | 3 |
| Reporte automático por run | 15 | 5 | 3 | 5 | 4 |
| Integración con GitHub Actions | 15 | 5 | 5 | 4 | 4 |
| Curva de aprendizaje en 9 días | 15 | 4 | 3 | 3 | 3 |
| Impacto en dependencias (regla 18) | 10 | 5 | 2 | 5 | 4 |
| Costo | 10 | 5 | 5 | 5 | 5 |
| Madurez / comunidad | 5 | 5 | 5 | 4 | 3 |
| Qué tan fácil se explica en la defensa | 5 | 5 | 3 | 4 | 3 |
| **Total ponderado** | **100** | **92** | **65** | **84** | **72** |

**Justificación de los puntajes que deciden:**
- **Umbrales del gate:**
  - SonarCloud mide las 3 métricas, pero sus umbrales no se configuran en el plan gratis. Por eso tiene **4 y no 5**: hizo falta el script de ~30 líneas, que está probado.
  - Codacy **también 4**: según su página, los gates son configurables, pero no se probó.
  - ESLint + jscpd **2**: la cobertura del código nuevo habría que construirla a mano.
- **Integración y curva:** SonarCloud tiene acción oficial y **ya estaba funcionando** en la prueba de concepto. Codacy y Qlty se puntúan por documentación, sin prueba.
- **Dependencias:** ESLint + jscpd suman varias devDependencies (ESLint, typescript-eslint, plugins, jscpd). Los servicios externos no tocan `package.json`.

**Lectura honesta:** SonarCloud gana (92), pero **Codacy queda cerca (84)**. La diferencia sale sobre todo de la curva de aprendizaje y de la integración, y en esos dos criterios **SonarCloud está puntuado con una prueba real y Codacy solo con documentación**. Si Codacy cumpliera en la práctica lo que dice su página (gates configurables gratis para open source), le ganaría a SonarCloud en el criterio de más peso y la diferencia se achicaría. **Trabajo futuro:** una prueba de concepto de Codacy para confirmarlo.

**Cronología (también honesta):** la elección (D5) se hizo con el borrador de esta matriz (`PLAN_CALIDAD_TP.md §5`), en el que los datos de las alternativas no estaban verificados. La matriz completa, con pesos y puntajes, se terminó **después** de la prueba de concepto. El orden ideal del proceso es elegir con la matriz completa.

## Paso 5 — Despliegue incremental

| Etapa | Qué | Run | Resultado |
|---|---|---|---|
| 1. Prueba de concepto en una rama | Análisis del PR (solo lo cambiado), gate del TP | CI #4 / #5 | Rojo real → corregido → verde |
| 2. En `main`, gate bloqueante | Primer análisis de todo el proyecto | **CI #7** | **Rojo real: el gate encontró 2 bugs críticos** (`S2189`, `S2871`; §191) |
| 3. Corrección y ampliación del gate | 4 correcciones con tests (incluida la firma SHA-256) + el gate también bloquea vulnerabilidades críticas | CI #8 | Verde |
| 4. Mejora medida | Promesas sin manejar (36), ReDoS, inyección en logs, accesibilidad | CI #14, #15 | Bugs 39 → 0, issues 157 → 63 (`METRICAS.md §4`) |
| 5. Triage | 14 issues aceptadas con justificación, 17 corregidas | — | Gate "Sonar way" en OK (§204) |

**Qué encontró que no se sabía:** una **denegación de servicio real** (un email de 80 mil caracteres bloqueaba toda la API 3,4 s por pedido, §201) y una **inyección en los logs** desde el webhook de Mercado Pago (§202). También un falso positivo cuya "corrección" sugerida (`localeCompare`) habría roto la firma de Cloudinary (§191).

## Mapa de herramientas (eje 8)

| Propósito | Herramienta | Dónde |
|---|---|---|
| Tests unitarios y de integración del backend | `node:test` (sin dependencias) | `backend/test/`; `npm test` y `npm run test:pg` |
| Base real para los tests | SQLite temporal y **Postgres 16** (Docker en local, servicio en el CI) | `test/integration/helpers.js` |
| Tests del frontend | **Vitest 5** + Testing Library + jsdom | `frontend/src/**/*.test.tsx` |
| Cobertura | Runner de Node (`--experimental-test-coverage`, `lcov`) y `@vitest/coverage-v8` | `ci.yml`, `vite.config.ts` |
| Tipos | TypeScript 7 (`npm run typecheck`) | `frontend/` |
| **Análisis estático y gate** | **SonarCloud** + `sonar-gate.js` | job `sonar` de `ci.yml` |
| Mutation testing | Scripts propios (mutantes por reemplazo de texto, con corrida de control) | `PROJECT_ANALYSIS.md` (cada sección) |
| CI/CD | **GitHub Actions** (`ci.yml`, `deploy.yml`, `load.yml`) + deploy hooks de Render | `.github/workflows/` |
| Smoke y E2E post-deploy | Node (`fetch`), sin dependencias | `.github/scripts/post-deploy.js` |
| Stress y esfuerzo sostenido | **k6 2.3.0** (acción oficial en el CI; imagen Docker en local) | `load/`, workflow "Carga" |
| Vulnerabilidades de dependencias | `npm audit` | job `audit` de `ci.yml` |
| Registro de defectos | **GitHub Issues** + `gh` (labels, plantilla) | `REGISTRO_DEFECTOS.md`, `.github/ISSUE_TEMPLATE/` |
| Verificación visual | Chrome (con el usuario) contra el backend y Vite locales | §203 |

## Fuentes del paso 2

- SonarCloud, planes (gates propios en planes pagos): https://docs.sonarsource.com/sonarcloud/administering-sonarcloud/managing-subscription/subscription-plans
- Codacy, precios (Team gratis para open source): https://www.codacy.com/pricing
- Qlty, documentación (funciones): https://docs.qlty.sh/
- Para los precios de Qlty y la acción de Codacy solo había fuentes de terceros: **no se toman como verificadas**.
