# METRICAS.md — Métricas del producto, del proceso y del proyecto, interpretadas

> TP de Calidad, **eje 4** (T11). **Todas las cifras salen de ejecuciones del propio proyecto**: los logs del CI
> (GitHub Actions, leídos con `gh run view --log`), la API pública de SonarCloud, el workflow de carga (k6) y el
> registro de defectos. Fecha de corte: **2026-10-17**. Último CI completo: **CI #15** (`80042fb`,
> https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39069697534). Detalle técnico en
> `PROJECT_ANALYSIS.md §183–§205`.

## 1. Métricas de producto (interpretadas)

### 1.1 Pruebas y cobertura (CI #15)

| Métrica | Valor | Umbral / meta | Lectura |
|---|---|---|---|
| Tests del backend, SQLite (UTC y Córdoba) | **808 / 808** | 0 fallidos | Todo en verde en las dos zonas horarias. Ojo: 808 incluye `helpers.js`, que el runner cuenta como test; **807 reales** (§183) |
| Tests del backend, Postgres 16 (UTC y Córdoba) | **810 / 810** | 0 fallidos | +2 que solo existen en Postgres (concurrencia real) |
| Tests del frontend (UTC y Córdoba) | **699 / 699** | 0 fallidos | 75 archivos |
| Cobertura del backend (líneas / ramas / funciones) | **92,95 % / 84,57 % / 90,59 %** (UTC) | ≥ 80 % en las tres (bloqueante) | Holgada. Lo más bajo: `db/index.js`, porque la rama de Postgres no corre en el job de SQLite (§1) |
| Cobertura del frontend (líneas / sentencias / ramas / funciones) | **90,11 % / 86,36 % / 81,18 % / 82,11 %** (CI #19) | las cuatro ≥ 80 % (bloqueante desde §212; antes solo líneas, §186) | **Pasa en las cuatro.** En el CI #15 era 83,26 / 79,75 / 74,08 / 67,99: sentencias, ramas y funciones no llegaban. Subió con el test de contrato de `lib/api.ts` (§209), tests de componentes (§210) y el borrado de `ProjectCard`, que era código muerto (§211). El margen más chico es ramas: **36 ramas** sobre el 80 % |
| Cobertura total en SonarCloud (backend + frontend) | **86,3 %** (líneas 90,1 %, ramas 78,0 %) | — | Combina los dos `lcov` del CI |
| Cobertura del código nuevo (SonarCloud) | **89,9 %** | ≥ 80 % (gate del TP) | Lo que se cambió desde el primer análisis del CI quedó bien cubierto |

### 1.2 Análisis estático (SonarCloud, análisis de `80042fb` + el triage)

| Métrica | Proyecto | Backend | Frontend | Lectura |
|---|---|---|---|---|
| Líneas de código (ncloc) | **17.083** | 5.546 | 11.537 | El frontend es 2/3 del código |
| Duplicación | **2,2 %** | 2,5 % | 2,1 % | Bajo el 5 % del gate; la deuda conocida (`safeMoney` copiada en 4 componentes, §172) entra en ese 2,1 % |
| Complejidad ciclomática | **4.045** | 1.424 | 2.621 | — |
| Complejidad cognitiva | **2.720** | 1.091 | 1.629 | La más alta: `routes/projects.js` (333 en 934 líneas), `ExploreScreen.tsx` (161), `ProjectDetails.tsx` (123), `CreateVoluntariado.tsx` (92), `ProjectMap.tsx` (88). Son los candidatos a dividir si el proyecto sigue |
| Densidad de comentarios | 8,3 % | 14,7 % | 5,0 % | El backend explica sus decisiones; el frontend casi no comenta |
| Deuda técnica (sqale_index) | **126 min** (ratio 0,0 %, calificación **A**) | 38 min | 88 min | Son las 63 de `S7773` (`Number.parseInt`), cosméticas. Arregladas en §229: **0 min** en el análisis de `8e7d9e4` |
| Bugs / vulnerabilidades abiertos | **0 / 0** (calificaciones **A / A**) | — | — | 1 bug y 5 vulnerabilidades **aceptados con justificación** (`TRIAGE_SONAR.md`) |
| Gate del TP / gate "Sonar way" | **pasa / OK** | | | Dos gates distintos (§204) |

### 1.3 Rendimiento (Carga #1, k6 2.3.0, https://github.com/SantiagoPlanasM/voluntariar-PF/actions/runs/39065266810)

| Prueba | p95 | p99 | Errores | Umbral | Lectura |
|---|---|---|---|---|---|
| Stress, hasta 50 usuarios (runner) | **3,06 ms** | — | 0 % | p95 < 500 ms | Sobra margen |
| Stress, de 50 a 100 usuarios (sin umbral) | 4,56 ms | — | 0 % | — | **No apareció el punto de quiebre**: con solo lecturas y los datos del seed, 100 usuarios no alcanzan |
| Esfuerzo sostenido, 20 usuarios × 10 min | **3,17 ms** | 6,46 ms | 0 % | p95 < 300 ms | Sin degradación visible en el agregado (k6 no da la evolución minuto a minuto) |
| Producción (Render gratis), 10 usuarios × 2 min | **418,90 ms** | 799,16 ms | 0 % | p95 < 2 s | Unas **100 veces más lento** que el runner (mediana 103 ms contra 1,4 ms): plan gratuito, Postgres por red y la distancia GitHub ↔ Render. No se midió qué parte es cada cosa |

### 1.4 Acoplamiento entre módulos (medido el 2026-10-19 sobre `d7efe16`)

SonarCloud no informa acoplamiento para JavaScript. Se midió con un script que recorre los `require`/`import`
**relativos** de cada módulo de producción (sin tests ni paquetes de npm): **Ce** (eferente, a cuántos módulos
propios depende), **Ca** (aferente, cuántos dependen de él) e inestabilidad **I = Ce / (Ca + Ce)** (0 = estable,
1 = inestable). El script no quedó en el repo (§237).

| | Módulos | Dependencias | Ce promedio | Mayor Ce | Mayor Ca |
|---|---|---|---|---|---|
| Backend (`backend/src`) | 33 | 101 | 3,06 | `index.js` (19: monta todas las rutas) | `db/index.js` (15), `middleware/auth.js` (13), `lib/inputs.js` (8) |
| Frontend (`frontend/src`) | 69 | 245 | 3,55 | `app/routes.tsx` (30: todas las pantallas) | `lib/api.ts` (49), `lib/AuthContext.tsx` (38), `lib/format.ts` (28) |

**Lectura:**
- Los módulos con mayor Ce son los puntos de armado (`index.js`, `routes.tsx`), lo esperable.
- Los de mayor Ca son estables (I ≈ 0): un cambio en `db/index.js` o en `lib/api.ts` repercute en 15 y 49 módulos.
  Por eso son los más protegidos: la base corre toda la suite en **dos motores** y `api.ts` tiene un test de
  contrato de todo el cliente HTTP (§209).
- Entre rutas del backend hay solo 4 dependencias: `follows.js` y `ngos.js` importan `fmt` de `projects.js` (a
  propósito, para no copiarlo), `follows.js` importa `fmtNgo` de `ngos.js` y `ngos.js` importa `validateEmail` de
  `auth.js`. Esta última es acoplamiento entre rutas que podría vivir en `lib/` (deuda chica, no se tocó).

## 2. Métricas de proceso

### 2.1 Tasa de éxito del pipeline (de `gh run list`, 24 runs)

| Workflow | Runs | En verde | Tasa | Duración media |
|---|---|---|---|---|
| **CI** | 15 | 13 | **86,7 %** | 4,4 min (1,3 – 7,3) |
| **Deploy** | 8 | 5 | **62,5 %** | 1,3 min (0,8 – 2,9) |
| Carga | 1 | 1 | 100 % | 14,9 min |

**Lectura:** los 2 rojos del CI fueron **defectos reales detectados por el propio pipeline** (§189: un comando que no corría los tests; §191: el gate encontró 2 bugs críticos). Los 3 rojos del deploy fueron de **configuración** (los secretos de la cuenta de E2E), y los detectó el E2E, que es para lo que está. Ningún rojo fue un test inestable.

### 2.2 Tiempo hasta volver a verde después de una falla

| Falla | Qué detectó | Volvió a verde | Tiempo |
|---|---|---|---|
| CI #4 | `node --test <carpeta>` no corría los tests del gate | CI #5 | **5,1 min** |
| CI #7 | El gate: 2 bugs críticos de SonarCloud | CI #8 | **30,0 min** (triage + 4 correcciones con tests) |
| Deploy #1, #2, #3 | Login 401, la cuenta era una ONG, email mal cargado | Deploy #4 | 38,6 / 18,4 / 7,0 min |

**Lectura:** las fallas del código se corrigieron en minutos y siempre en un commit posterior, sin reescribir el run fallido (decisión del usuario). Las de configuración tardaron más porque dependían de pasos manuales (crear la cuenta, cargar los secretos).

### 2.3 Defectos escapados a producción (`REGISTRO_DEFECTOS.md`)

**4 de 18 = 22,2 % sobre el registro.** El registro es una **selección**: con todos los hallazgos de `REVISION.md`, encontrados antes de producción, la tasa sería mucho menor. Los 4 escapados (D07, D16, D17, D18) son de **flujos que dependen de un servicio externo o de lo que ve otro rol** (el panel de la ONG después de una donación real): justo lo que las pruebas con dobles no ven. Es el argumento para el E2E contra Mercado Pago en cada deploy (§193–§196).

## 3. Métrica de proyecto: densidad de pruebas

**Tests por KLOC de código productivo** (tests del CI #15 y ncloc de SonarCloud, que no cuenta comentarios ni líneas en blanco):

| | Tests | KLOC | Densidad |
|---|---|---|---|
| Backend | 807 (sin `helpers.js`) | 5,546 | **145,5 tests/KLOC** |
| Frontend | 699 | 11,537 | **60,6 tests/KLOC** |
| Frontend, CI #19 (§209–§211) | 864 | 11,386 | **75,9 tests/KLOC** |

**Lectura:** el backend tiene **2,4 veces más pruebas por línea** que el frontend. Es coherente con la cobertura (backend 92,9 % de líneas contra 83,3 %) y con dónde estuvo el esfuerzo de calidad: la plata, los cupos y la autorización viven en el backend. Si el proyecto sigue, el frontend es donde conviene sumar pruebas, sobre todo de ramas (74 %). **Actualización (CI #19):** con §209–§211 el frontend pasó a 75,9 tests/KLOC y a 81,18 % de ramas; el backend sigue teniendo casi el doble de densidad.

## 4. Mejora medida antes/después (SonarCloud, historial de análisis)

| Análisis | Bugs | Vulnerab. | Code smells | Deuda | Fiabilidad / seguridad | Qué pasó |
|---|---|---|---|---|---|---|
| `77f4fdf` (run #7, primer análisis del CI) | 39 | 18 | 103 | 416 min | **E / D** | El gate del TP falló: 2 bugs críticos (§191) |
| `959f74b` (run #8) | 37 | 17 | 103 | 416 min | C / C | Los 2 críticos y SHA-1 corregidos (§191) |
| `2a53138` | **1** | **5** | 103 | 416 min | C / C | 36 promesas revisadas (§200), ReDoS (§201) y logs (§202) |
| `80042fb` | 1 | 5 | **71** | 256 min | C / C | Accesibilidad: 32 issues (§203) |
| Después del triage (estado actual) | **0** | **0** | **63** | **126 min** | **A / A** | 14 aceptadas con justificación (§204) |

**Issues abiertas: 157 → 63** (todas cosméticas). Sin tocar comportamiento, salvo en los 2 defectos de seguridad reales (ReDoS e inyección en logs) y las tarjetas que no se podían usar con el teclado, que **sí** cambiaron el comportamiento, a propósito y con tests.

**Salvedad:** el primer análisis de la historia (15:46, 33.577 líneas) es del **análisis automático** de SonarCloud, que corrió antes de apagarlo y contaba los tests como código: **no se usa como línea de base**.

## ⚠️ No verificado

- La duración de los deploys (1,3 min de media) mide el workflow de GitHub, que espera a que `/health` muestre el commit nuevo. No es el tiempo de build de Render.
- Los tiempos de recuperación incluyen el tiempo de trabajo (análisis y correcciones), no solo el de la máquina.
- La deuda técnica de SonarCloud es una estimación de la herramienta (minutos por regla), no una medición.
- Las calificaciones A/A del estado actual salen de las medidas vivas de SonarCloud después de aceptar las issues. No hay un análisis nuevo del CI con ese estado (se verá en el próximo push).
