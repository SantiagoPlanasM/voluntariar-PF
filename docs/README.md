# docs/ — Qué hay acá y qué leer

Índice de la documentación de VoluntariAR. Cada documento tiene un solo propósito. Los **vigentes** se actualizan con
cada cambio. Los **históricos** cumplieron su función: se conservan porque la bitácora y el informe los citan, pero no
describen el estado actual (cada uno lo dice en su primera línea).

## Por dónde empezar

| Si querés… | Leé |
|---|---|
| Entender el proyecto en 5 minutos | [`../README.md`](../README.md) |
| Trabajar en el código (persona o IA) | [`../CLAUDE.md`](../CLAUDE.md) → [`AI_RULES.md`](AI_RULES.md) → [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) |
| Ver el TP de Calidad | [`calidad/informe/INFORME_TP_CALIDAD.pdf`](calidad/informe/INFORME_TP_CALIDAD.pdf) y [`calidad/`](calidad/) |
| Preparar la defensa | [`GUION_DEFENSA.md`](GUION_DEFENSA.md) y [`DEMO_DATOS.md`](DEMO_DATOS.md) |
| Saber por qué algo es como es | [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md) (bitácora; tiene un índice por etapa al principio) |

## Vigentes: referencia del sistema

| Documento | Para qué |
|---|---|
| [`AI_RULES.md`](AI_RULES.md) | Las reglas numeradas de trabajo. Obligatorias |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Documento maestro: qué es, roles, stack, módulos |
| [`BACKEND_CONTEXT.md`](BACKEND_CONTEXT.md) | Arquitectura del backend, flujos internos y convenciones |
| [`API_CONTEXT.md`](API_CONTEXT.md) | Cada endpoint: auth, cuerpo, respuestas y errores |
| [`DATABASE_CONTEXT.md`](DATABASE_CONTEXT.md) | Tablas, columnas, migraciones y diferencias SQLite/Postgres |
| [`FRONTEND_CONTEXT.md`](FRONTEND_CONTEXT.md) | Pantallas, rutas, layout (`AppShell`), kit `ui/` y tokens |
| [`DESIGN.md`](DESIGN.md) | El diseño visual 1.1: colores, tipografía, componentes y pantallas |
| [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md) | **Bitácora**: una sección por cambio, con qué se hizo, verificación, errores propios y lo no verificado |

## Vigentes: defensa

| Documento | Para qué |
|---|---|
| [`GUION_DEFENSA.md`](GUION_DEFENSA.md) | Checklist, recorrido de 15 minutos, preguntas esperables y plan B |
| [`DEMO_DATOS.md`](DEMO_DATOS.md) | Qué datos cargar en producción y en qué orden |

## Vigentes: lo que sigue

| Documento | Para qué |
|---|---|
| [`PLAN_PATROCINIO.md`](PLAN_PATROCINIO.md) | El patrocinio como acuerdo negociado (puntos de cada parte, charla, aceptación por versión); hecho (§263–§266) |
| [`PLAN_ENTREVISTAS.md`](PLAN_ENTREVISTAS.md) | Entrevistas que la ONG agenda ante una postulación pendiente (tabla `reuniones`); hecho (§261–§262) |

## Vigentes: TP de Calidad ([`calidad/`](calidad/))

| Documento | Para qué |
|---|---|
| [`calidad/informe/`](calidad/informe/) | **El entregable**: informe en HTML y PDF (congelado en el corte del CI #41, con 29 defectos; lo posterior está en el registro y en `METRICAS.md`) |
| [`calidad/PLAN_PRUEBAS.md`](calidad/PLAN_PRUEBAS.md) | Plan versionado: objetivos, riesgos, criterios, ISO 25010, plantillas |
| [`calidad/DISENO_CASOS.md`](calidad/DISENO_CASOS.md) | Técnicas de diseño de casos (equivalencia, límites, decisión, estados, caja blanca) |
| [`calidad/REGISTRO_DEFECTOS.md`](calidad/REGISTRO_DEFECTOS.md) | Los 32 defectos, con su Issue, su test y su commit |
| [`calidad/SESION_EXPLORATORIA.md`](calidad/SESION_EXPLORATORIA.md) | La sesión exploratoria #1 y qué se hizo con sus hallazgos |
| [`calidad/METRICAS.md`](calidad/METRICAS.md) | Métricas de producto, proceso y proyecto, interpretadas |
| [`calidad/TRIAGE_SONAR.md`](calidad/TRIAGE_SONAR.md) | Qué se arregló y qué se aceptó de SonarCloud, y por qué |
| [`calidad/HERRAMIENTA_NUEVA.md`](calidad/HERRAMIENTA_NUEVA.md) | SonarCloud: proceso de 5 pasos y matriz de decisión |
| [`calidad/INTEGRACION_MERCADOPAGO.md`](calidad/INTEGRACION_MERCADOPAGO.md) | Cómo se prueba la integración externa |
| [`calidad/COMO_CORRER_PRUEBAS.md`](calidad/COMO_CORRER_PRUEBAS.md) | Los comandos de cada suite |
| [`calidad/evidencia/`](calidad/evidencia/) | Salidas y capturas citadas por el informe |

## Históricos (cumplidos; se conservan como registro)

| Documento | Qué fue | Dónde está lo vigente |
|---|---|---|
| [`REVISION.md`](REVISION.md) | Revisión de código del 13/10 (hallazgos B, F, T, D, S, A) | Casi todos arreglados (✅ con su §); el código y los `*_CONTEXT.md` |
| [`BACKEND_ROADMAP_ANALYSIS.md`](BACKEND_ROADMAP_ANALYSIS.md) | Diseño de los módulos que faltaban (sept.–oct.) | Implementados; `BACKEND_CONTEXT.md` y `API_CONTEXT.md` |
| [`PLAN_FALTANTE.md`](PLAN_FALTANTE.md) | Plan de cierre de la tesis (16–17/10) | Cumplido (§162–§182) y el marketplace después (§215–§225) |
| [`PLAN_CALIDAD_TP.md`](PLAN_CALIDAD_TP.md) | Plan del TP de Calidad (17/10) | Cumplido; el resultado es [`calidad/`](calidad/) |
| [`PLAN_REDISENO_FRONTEND.md`](PLAN_REDISENO_FRONTEND.md) | Análisis y plan del rediseño (20/10) | Implementado (§240); `DESIGN.md` y `FRONTEND_CONTEXT.md`. Los cambios de backend B1–B10 siguen sin decidir |

## Fuera de `docs/`

| Documento | Para qué |
|---|---|
| [`../README.md`](../README.md) | Presentación, cómo correrlo en local, deploy, variables y endpoints principales |
| [`../CLAUDE.md`](../CLAUDE.md) | Instrucciones para trabajar con IA: verificación, trampas resueltas, pendientes |
| [`../backend/README.md`](../backend/README.md) | Cómo levantar solo el backend; remite a `API_CONTEXT.md` |
| [`../.github/ISSUE_TEMPLATE/defecto.md`](../.github/ISSUE_TEMPLATE/defecto.md) | Plantilla de los Issues de defectos |
