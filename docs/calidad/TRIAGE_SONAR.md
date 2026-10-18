# TRIAGE_SONAR.md — Qué se hizo con cada issue de SonarCloud

> TP de Calidad, eje 4. Punto de partida: el primer análisis completo de `main` (`df86dde`, 2026-10-17), con
> **157 issues**: 37 bugs, 17 vulnerabilidades y 103 code smells. Decisión del usuario: no arreglarlas todas de una,
> sino por prioridad. Detalle técnico en `PROJECT_ANALYSIS.md §200–§203`.

## Resumen

| Grupo | Regla | Cant. | Decisión | Dónde |
|---|---|---|---|---|
| Bug | `typescript:S9383` promesa sin manejar | 36 | **Arreglado** (`void`): se revisaron las 12 funciones y ninguna podía rechazar | §200 |
| Bug | `typescript:S8985` efecto dentro de `waitFor` | 1 | **Aceptado** (es un test, a propósito) | abajo |
| Vulnerabilidad | `jssecurity:S5145` inyección en logs | 13 | **Arreglado** (`forLog()`; había un caso real: `data.id` del webhook) | §202 |
| Vulnerabilidad | `javascript:S5693` límite de tamaño | 2 | **Aceptado** (los límites existen) | abajo |
| Vulnerabilidad | `tssecurity:S8475` storage poisoning | 1 | **Aceptado** | abajo |
| Vulnerabilidad | `tssecurity:S8480` WebSocket | 1 | **Aceptado**, con una mejora anotada | abajo |
| Smell | `S8786` regex con backtracking | 6 | **2 mitigados** (vulnerabilidad real de DoS en el email: tope de 254 antes del regex), **4 aceptados**; los 6 se marcan "Accept" | §201 |
| Smell | `S6853` / `S6848` / `S6845` accesibilidad | 34 | **32 arreglados** (29 etiquetas, 4 tarjetas que no se podían abrir con el teclado), **2 aceptados** (`Modal`, `PhotoCarousel`) | §203 |
| Smell | `S7773` `Number.parseInt` en vez de `parseInt` | 63 | Primero **sin tocar** (cosmético). Las 57 que quedaban se **arreglaron** el 2026-10-18; una sola (`getProjectCoords`) no era un cambio mecánico | §229 |

## Para marcar en SonarCloud ("Accept", con este comentario)

En SonarCloud: **Issues** → filtrar por la regla → abrir la issue → **"Change status"** → **Accept**. Después
**pegar el comentario**, para que el triage quede registrado con su justificación.

**`typescript:S8985`, `frontend/src/app/components/ModalsMigrated.test.tsx:119`**
> Aceptado: es un test. El clic dentro de `waitFor` es a propósito: Leaflet recrea los marcadores después del primer render y el pin se busca de nuevo en cada intento (comentario en el test). Sacarlo haría el test inestable. TP de Calidad, docs/calidad/TRIAGE_SONAR.md.

**`javascript:S5693`, `backend/src/routes/auth.js` (foto de perfil) y `backend/src/routes/posts.js` (Momentos)**
> Aceptado: el límite existe y es chico a propósito. Multer corta en 8 MB por archivo (foto de perfil: 1 archivo; Momentos: hasta 5 fotos; el frontend comprime antes de subir), con un límite de frecuencia por usuario y validación de la cabecera real de la imagen antes de subir (regla 24 de AI_RULES). docs/calidad/TRIAGE_SONAR.md.

**`tssecurity:S8475`, `frontend/src/lib/api.ts` ("browser storage poisoning")**
> Aceptado: en localStorage solo se guardan el token y el usuario que devuelve nuestra propia API al iniciar sesión, no texto que escriba el usuario en un campo. Al leerlo, getUser() hace JSON.parse dentro de try/catch y la sesión se revalida con GET /api/auth/me al cargar la app. Sin una XSS previa no hay forma de envenenarlo. docs/calidad/TRIAGE_SONAR.md.

**`tssecurity:S8480`, `frontend/src/lib/ChatContext.tsx` (WebSocket)**
> Aceptado: la URL del socket se arma con la URL base de la API (configuración del build, no texto del usuario) y el token propio (encodeURIComponent). El servidor valida el JWT al conectar (§87). Mejora anotada como trabajo futuro: mandar el token en el primer mensaje en vez del query string, para que no quede en los logs del proxy. docs/calidad/TRIAGE_SONAR.md.

**`S8786`, los 4 que no se cambiaron** (`backend/src/lib/email.js`, `backend/src/lib/time.js`, `frontend/src/lib/format.ts` ×2)
> Aceptado: medido con entradas armadas para el peor caso (PROJECT_ANALYSIS.md §201). Ninguno recibe texto de un usuario: email.js valida una variable de entorno; hasZone (time.js y format.ts) corre sobre fechas que genera la base; el \s+$ de format.ts corre sobre un texto ya recortado a un largo fijo. El que sí recibía texto del usuario (EMAIL_RE en auth.js y AuthModal.tsx) se arregló con un tope de 254 caracteres. docs/calidad/TRIAGE_SONAR.md.

**`S8786`, los 2 del email** (`backend/src/routes/auth.js` `EMAIL_RE` y `frontend/src/app/components/AuthModal.tsx`)
> Mitigado: el regex sigue teniendo backtracking cuadrático, pero ahora validateEmail corta en 254 caracteres (RFC 5321) ANTES de aplicarlo, así que el peor caso es de microsegundos. Antes, un email de 80 mil caracteres bloqueaba la API 3,4 s por pedido (reproducido). Con test de tiempo: test/unit/validators.test.js y test/integration/email-redos.test.js. PROJECT_ANALYSIS.md §201.

**`typescript:S6848`, `frontend/src/app/components/Modal.tsx`** (clic en el fondo del modal)
> Aceptado: el fondo oscuro cierra el modal con un clic, que es la convención; no es la única forma: Escape también cierra, el foco queda atrapado adentro y el botón "Cerrar" es accesible con teclado (REVISION F12, §79–§81). El fondo no tiene que ser enfocable. docs/calidad/TRIAGE_SONAR.md.

**`typescript:S6845`, `frontend/src/app/components/PhotoCarousel.tsx`** (`tabIndex` en el carrusel)
> Aceptado: el carrusel es role="group" con aria-roledescription="carrusel" y nombre, y necesita tabIndex=0 para recibir el foco y pasar las fotos con las flechas del teclado (onKeyDown). Solo lo tiene cuando hay más de una foto. docs/calidad/TRIAGE_SONAR.md.

## Resultado del análisis de `2a53138` (después de §200–§202)

**Bugs 37 → 1** (queda el `S8985` del test, que se acepta). **Vulnerabilidades 17 → 5**: de los 13 `S5145`, SonarCloud cerró 12, es decir que **reconoció `forLog()` como sanitizador**. El que quedaba (línea del webhook: `ts` y `user_id`, que ya eran solo dígitos) se pasó también por `forLog()` en §203. Los 6 `S8786` siguen marcados, porque el regex no cambió (en el email se agregó el tope), y se aceptan con los textos de arriba.

## Si después del próximo análisis SonarCloud sigue marcando los S5145

El arreglo está en el código: todo valor externo que va a un log pasa por `forLog()` (`backend/src/lib/logSafe.js`),
con test unitario y uno de punta a punta (`donaciones-webhook.test.js`). Si el motor de Sonar no reconoce
`forLog()` como sanitizador, se marcan como **"Accept"** con:

> Corregido en el código: el valor pasa por forLog() (backend/src/lib/logSafe.js), que reemplaza los caracteres de control por espacios y limita el largo; probado en test/unit/logSafe.test.js y en donaciones-webhook.test.js ("un data.id con salto de línea no parte la línea del log"). SonarCloud no reconoce la función como sanitizador. PROJECT_ANALYSIS.md §202.

## Estado final del triage (2026-10-17, API pública de SonarCloud)

- **14 issues aceptadas, cada una con su comentario de justificación**: 6 las marcó el usuario y 8 las marcó Claude en Chrome con la sesión del usuario (autorizado). Al aceptar se destildó "Share this comment with Sonar to help us improve analyzers" (venía tildada por defecto).
- **17 cerradas como FIXED** por los cambios de código (§200–§203).
- El S5145 de `donaciones.js:188` se aceptó: Sonar sigue `dataId` a través de `forLog()` en esa línea y no lo da por sanitizado (en las otras 12 sí); el test de punta a punta prueba que está protegido.
- **Gate "Sonar way": OK.** Antes fallaba por "Security Rating B en código nuevo": la línea 188 se había modificado y su issue contaba como nueva. El gate del TP (`sonar-gate.js`) pasaba igual: son dos gates distintos.
- **Issues abiertas: 63**, todas `S7773` (`Number.parseInt` en vez de `parseInt`): deuda cosmética que se deja a propósito y va a la tabla de métricas.

## Análisis del 2026-10-18 (`e3c57af`, el Marketplace de Mercado Pago, §215–§224)

SonarCloud marcó **3 vulnerabilidades nuevas**, las tres `S5145` (inyección en logs) y de severidad menor. Con ellas, la seguridad pasó de **A a B**. El gate del TP no bloqueó porque solo frena las críticas.

| Dónde | Qué entraba crudo al log | Riesgo real |
|---|---|---|
| `routes/mercadopago.js:109` | el `mpUserId` que devuelve Mercado Pago | bajo: `payments.oauthToken` ya exige solo dígitos |
| `scripts/vincular-mp-manual.js:48` y `:56` | el nickname, los tags y los mensajes de error que vienen de Mercado Pago | bajo: salen en la terminal de quien corre el script |

**Decisión: se corrigen, no se aceptan.** Es la regla del proyecto desde §202: todo valor externo pasa por `forLog()`. Los mensajes del script pasaron a funciones puras (`describeInspection`, `describeLinked`), con un test que manda saltos de línea. La ruta tiene un test de punta a punta del log (§225). Se ve en el próximo análisis: si Sonar no reconoce `forLog()`, se acepta con el comentario de arriba.

**Medidas de ese análisis** (API pública):
- bugs 0;
- vulnerabilidades 3, que §225 corrige;
- code smells 57; deuda 114 min; duplicación 1,9 %;
- 17.573 líneas; cobertura 89,6 %;
- código nuevo: cobertura 94,4 %, duplicación 0,0 %, 0 bugs, 0 críticas.

## S7773 arreglado (2026-10-18, §229)

Las **57 issues abiertas** del análisis de `6e4a51c` eran todas `S7773` (38 `typescript`, 19 `javascript`, MINOR): `parseInt`, `parseFloat`, `isNaN`, `isFinite` y `NaN` globales en 6 archivos del backend y 9 del frontend. El usuario pidió sacarlas.

- `parseInt`, `parseFloat`, `isFinite` y `NaN` → `Number.*`: son las mismas funciones y el mismo valor (`Number.parseInt === parseInt`).
- `isNaN` → `Number.isNaN` **no** es equivalente: el global convierte antes (`isNaN('abc')` da `true`) y `Number.isNaN('abc')` da `false`. Se revisó cada caso:
  - en 8 archivos el argumento es el resultado de `parseFloat`/`parseInt`, que siempre es un número: el cambio es equivalente;
  - en `ProjectMap.tsx` (`getProjectCoords`) el argumento era `p.latitude`, que puede llegar como string: ahora se convierte con `Number()` antes de mirar `NaN`. Tests de caracterización escritos y pasados con el código viejo; el reemplazo mecánico los rompe.

**Resultado** (análisis de `8e7d9e4`, CI #27, API pública): **0 issues abiertas**, las 57 en FIXED; code smells 0, deuda **0 min**, bugs 0, vulnerabilidades 0, calificaciones A/A/A, gate "Sonar way" OK. Código nuevo: cobertura 92,8 %, duplicación 0,0 %.
