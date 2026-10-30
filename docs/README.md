# docs/ — Qué hay acá y qué leer

Los **vigentes** describen el estado actual y se actualizan con cada cambio. Lo **archivado** ([`archivo/`](archivo/))
cumplió su función: se conserva sin cambios porque la bitácora y el informe lo citan.

## Por dónde empezar

| Si querés… | Leé |
|---|---|
| Entender el proyecto en 5 minutos | [`../README.md`](../README.md) |
| Trabajar en el código (persona o IA) | [`../CLAUDE.md`](../CLAUDE.md) → [`AI_RULES.md`](AI_RULES.md) → [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) |
| Ver el TP de Calidad | [`calidad/informe/INFORME_TP_CALIDAD.pdf`](calidad/informe/INFORME_TP_CALIDAD.pdf) y [`calidad/`](calidad/) |
| Preparar la defensa | [`GUION_DEFENSA.md`](GUION_DEFENSA.md), [`DEMO_DATOS.md`](DEMO_DATOS.md) y [`PLAN_CIERRE.md`](PLAN_CIERRE.md) |
| Saber por qué algo es como es | [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md): índice de la bitácora (§1–§299 en `archivo/bitacora/`) y secciones nuevas |

## Vigentes: referencia del sistema

| Documento | Para qué |
|---|---|
| [`AI_RULES.md`](AI_RULES.md) | Reglas numeradas de trabajo. Obligatorias |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Qué es, roles, stack, módulos y estado |
| [`BACKEND_CONTEXT.md`](BACKEND_CONTEXT.md) | Arquitectura del backend, bibliotecas, flujos y convenciones |
| [`API_CONTEXT.md`](API_CONTEXT.md) | Cada endpoint: auth, cuerpo, respuestas y errores |
| [`DATABASE_CONTEXT.md`](DATABASE_CONTEXT.md) | Tablas, columnas, migraciones y diferencias SQLite/Postgres |
| [`FRONTEND_CONTEXT.md`](FRONTEND_CONTEXT.md) | Rutas, pantallas, layout, kit `ui/` y tokens |
| [`DESIGN.md`](DESIGN.md) | Sistema de diseño 1.1: colores, tipografía, componentes |
| [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md) | Bitácora: una sección por cambio |

## Vigentes: cierre, defensa y lo que sigue

| Documento | Para qué |
|---|---|
| [`PLAN_CIERRE.md`](PLAN_CIERRE.md) | Lo que queda antes y después de la defensa |
| [`GUION_DEFENSA.md`](GUION_DEFENSA.md) | Checklist, recorrido, preguntas esperables y plan B |
| [`DEMO_DATOS.md`](DEMO_DATOS.md) | Qué datos cargar en producción y en qué orden |
| [`PLAN_EQUIPOS.md`](PLAN_EQUIPOS.md) | Equipo de la ONG (hecho, §293–§296) y empleados de empresa con cupos reservados (después del 5/11) |

## Vigentes: TP de Calidad ([`calidad/`](calidad/))

| Documento | Para qué |
|---|---|
| [`calidad/informe/`](calidad/informe/) | **El entregable** (HTML y PDF), congelado en el corte del CI #41. Nombra planes que hoy están en `archivo/` |
| [`calidad/PLAN_PRUEBAS.md`](calidad/PLAN_PRUEBAS.md) | Plan versionado: objetivos, riesgos, criterios, ISO 25010 |
| [`calidad/DISENO_CASOS.md`](calidad/DISENO_CASOS.md) | Técnicas de diseño de casos |
| [`calidad/REGISTRO_DEFECTOS.md`](calidad/REGISTRO_DEFECTOS.md) | Los 32 defectos, con su Issue, su test y su commit |
| [`calidad/SESION_EXPLORATORIA.md`](calidad/SESION_EXPLORATORIA.md) | La sesión exploratoria y sus hallazgos |
| [`calidad/METRICAS.md`](calidad/METRICAS.md) | Métricas; §7–§8 son los cortes posteriores al informe |
| [`calidad/TRIAGE_SONAR.md`](calidad/TRIAGE_SONAR.md) | Qué se arregló y qué se aceptó de SonarCloud |
| [`calidad/HERRAMIENTA_NUEVA.md`](calidad/HERRAMIENTA_NUEVA.md) | SonarCloud: proceso y matriz de decisión |
| [`calidad/INTEGRACION_MERCADOPAGO.md`](calidad/INTEGRACION_MERCADOPAGO.md) | Cómo se prueba la integración externa |
| [`calidad/COMO_CORRER_PRUEBAS.md`](calidad/COMO_CORRER_PRUEBAS.md) | Los comandos de cada suite |
| [`calidad/evidencia/`](calidad/evidencia/) | Salidas y capturas citadas por el informe |

## Archivo ([`archivo/`](archivo/))

| Documento | Qué fue |
|---|---|
| [`archivo/bitacora/`](archivo/bitacora/) | La bitácora §1–§299, partida por etapa (el índice está en `PROJECT_ANALYSIS.md`) |
| [`archivo/contexto-2026-10-30/`](archivo/contexto-2026-10-30/) | Los `*_CONTEXT.md`, `DESIGN.md`, `AI_RULES.md` y `CLAUDE.md` completos, antes de compactarlos (§300) |
| [`archivo/REVISION.md`](archivo/REVISION.md) | Revisión de código del 13/10 (hallazgos B, F, T, D, S, A; el código los cita como `REVISION.md B3`) |
| [`archivo/BACKEND_ROADMAP_ANALYSIS.md`](archivo/BACKEND_ROADMAP_ANALYSIS.md) | Diseño de los módulos que faltaban (sept.–oct.) |
| [`archivo/PLAN_FALTANTE.md`](archivo/PLAN_FALTANTE.md) | Plan de cierre de la tesis (16–17/10; el código cita sus "Etapas") |
| [`archivo/PLAN_CALIDAD_TP.md`](archivo/PLAN_CALIDAD_TP.md) | Plan del TP de Calidad (17/10) |
| [`archivo/PLAN_REDISENO_FRONTEND.md`](archivo/PLAN_REDISENO_FRONTEND.md) | Plan del rediseño (20/10). Los cambios de backend B1–B10 siguen sin decidir |
| [`archivo/PLAN_PATROCINIO.md`](archivo/PLAN_PATROCINIO.md) | Patrocinio como acuerdo negociado (hecho, §263–§266) |
| [`archivo/PLAN_ENTREVISTAS.md`](archivo/PLAN_ENTREVISTAS.md) | Entrevistas de la ONG (hecho, §261–§262) |

## Fuera de `docs/`

| Documento | Para qué |
|---|---|
| [`../README.md`](../README.md) | Presentación, cómo correrlo, deploy, variables |
| [`../CLAUDE.md`](../CLAUDE.md) | Instrucciones para trabajar con IA |
| [`../backend/README.md`](../backend/README.md) | Cómo levantar solo el backend |
| [`../.github/ISSUE_TEMPLATE/defecto.md`](../.github/ISSUE_TEMPLATE/defecto.md) | Plantilla de los Issues de defectos |
