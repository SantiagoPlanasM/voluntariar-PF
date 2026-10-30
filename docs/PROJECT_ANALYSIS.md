# PROJECT_ANALYSIS.md — Bitácora de VoluntariAR

> Una sección por cambio, en orden: **qué se hizo**, **verificación**, **errores propios** y **⚠️ NO verificado**. Las
> secciones se citan como "§N" en todo el repo. Las §1–§299 están archivadas sin cambios en
> [`archivo/bitacora/`](archivo/bitacora/); acá van las nuevas, desde la **§300**. Para encontrar una vieja:
> `grep -n "^## 123[.–]" docs/archivo/bitacora/*.md`. Índice de toda la documentación: [`README.md`](README.md).

## Índice de lo archivado

| Secciones | Archivo | Etapa |
|---|---|---|
| §1–§33 | [`001-033-analisis-y-roadmap`](archivo/bitacora/001-033-analisis-y-roadmap.md) | Análisis inicial (§1–§12: fortalezas, bugs, prioridades) y funcionalidades del roadmap: KPIs, habilidades, chat, emails, recomendaciones, empresas, patrocinio, chatbot, seguimiento |
| §34–§50 | [`034-050-infraestructura-y-momentos`](archivo/bitacora/034-050-infraestructura-y-momentos.md) | Transacciones, `test:pg`, fechas en Postgres, Node 22, `npm audit`, Momentos con fotos |
| §51–§105 | [`051-105-revision-1`](archivo/bitacora/051-105-revision-1.md) | Arreglos de la revisión de código (`archivo/REVISION.md`: B, F, T, D) y decisiones del usuario |
| §106–§161 | [`106-161-revision-2`](archivo/bitacora/106-161-revision-2.md) | Segunda pasada (S1–S10, A1–A7) y verificación en producción |
| §162–§182 | [`162-182-plan-de-cierre`](archivo/bitacora/162-182-plan-de-cierre.md) | Plan de cierre (`archivo/PLAN_FALTANTE.md`): foto, CV, donaciones con Mercado Pago, borrar la cuenta, privacidad |
| §183–§214 | [`183-214-tp-calidad`](archivo/bitacora/183-214-tp-calidad.md) | TP de Calidad: CI, SonarCloud, deploy con smoke y E2E, k6, defectos, métricas, informe |
| §215–§238 | [`215-238-marketplace-y-sonar`](archivo/bitacora/215-238-marketplace-y-sonar.md) | Marketplace de Mercado Pago (cada ONG cobra en su cuenta), SonarCloud en 0, validaciones |
| §239–§260 | [`239-260-rediseno-y-mapas`](archivo/bitacora/239-260-rediseno-y-mapas.md) | Rediseño (DESIGN 1.1), sesión exploratoria y contraste, mapas, administrar un voluntariado, puesta al día |
| §261–§299 | [`261-299-cierre`](archivo/bitacora/261-299-cierre.md) | Entrevistas (§261–§262), patrocinio como acuerdo (§263–§267), calendario y certificado (§268–§271), contraseñas (§272–§278), recomendaciones (§280), foto, carga horaria, embudo y transparencia (§282–§286), Sonar y recomendador (§287–§288), Cloudinary (§289), teléfono (§291), equipo de la ONG (§293–§296), encuadre (§297), refactors del frontend (§298–§299) |

## 300. Documentación compactada y archivada

### Qué se hizo
- La bitácora (962 KB) se partió en `archivo/bitacora/` por etapa, sin cambios en el texto. Este archivo quedó con el índice y las secciones nuevas.
- Los planes cumplidos pasaron a `docs/archivo/`.
- Los `*_CONTEXT.md`, `DESIGN.md`, `AI_RULES.md` y `CLAUDE.md` se reescribieron compactos: solo el estado actual, sin la historia. La versión completa del 30/10 quedó en `archivo/contexto-2026-10-30/`.

### Verificación
- Partición: el texto de las 9 partes, unido, es igual al original (8390 líneas; solo cambian líneas en blanco entre partes).
