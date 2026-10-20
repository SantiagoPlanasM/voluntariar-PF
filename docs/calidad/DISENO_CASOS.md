# DISENO_CASOS.md — Diseño de casos de prueba, AAA y contraste rojo/verde

> TP Integrador de Calidad de Software, **eje 2** (unitarias AAA, criterio de aceptación previo, defecto real con
> rojo/verde) y **eje 5** (clases de equivalencia, valores límite, tabla de decisión, cobertura de sentencia y de
> decisión). Registro técnico: `PROJECT_ANALYSIS.md §199`. Plan general: `PLAN_PRUEBAS.md`.
> Todos los números salen de corridas reales del 2026-10-17 (Node 24.21, Windows), indicadas en cada caso.

## 0. Cómo se escriben los tests (AAA y criterio previo)

- **Arrange–Act–Assert:** cada test arma los datos, ejecuta **una** acción y verifica el resultado, con los tres
  bloques marcados con comentarios en los tests nuevos (`test/unit/donation-amount.test.js`,
  `test/unit/validators.test.js` → "valores límite", `.github/scripts/*.test.js`, `load/lib/summary.test.js`).
- **Criterio de aceptación antes del código:** va en el encabezado del archivo de test y se escribe antes de la
  implementación. Ejemplos: `sonar-gate.test.js` ("bloquea si hay al menos un bug crítico… en los bordes exactos
  pasa"), `post-deploy.test.js`, `health-commit.test.js`.
- **Rojo → verde:** primero el test falla y después el código lo hace pasar. Cuando el rojo fue "débil" (la función
  todavía no existía o no estaba exportada) se dice, y el rojo que importa lo dan los **mutantes**: se rompe el
  código a propósito y algún test tiene que fallar (`PROJECT_ANALYSIS.md §188–§199`).

## 1. Monto de una donación — clases de equivalencia y valores límite

**Función:** `amountError(amount)` en `backend/src/routes/donaciones.js`.
**Regla:** pesos enteros entre $100 y $500.000, inclusive (§170).
**Test:** `backend/test/unit/donation-amount.test.js` (7 tests, AAA).

| Clase | Descripción | Representantes | Resultado esperado |
|---|---|---|---|
| EC1 | No es un número | `'1500'`, `null`, `undefined`, `true`, `[1500]`, `{}` | "El monto tiene que ser un número entero de pesos" |
| EC2 | Número no entero o no finito | `100.5`, `NaN`, `Infinity` | ídem |
| EC3 | Entero menor al mínimo | `-500`, `0`, `99` | "El monto mínimo es de $100" |
| EC4 | Entero dentro del rango (**válida**) | `2500` | `null` (válido) |
| EC5 | Entero mayor al máximo | `500001`, `1e21` | "El monto máximo es de $500.000" |

| Valores límite | 99 | **100** | 101 | 499.999 | **500.000** | 500.001 |
|---|---|---|---|---|---|---|
| Esperado | mínimo | válido | válido | válido | válido | máximo |

Además, el test de integración `donaciones.test.js` prueba los mismos tipos inválidos y los bordes 100 y 500.000
**de punta a punta**: el pedido HTTP responde 400 sin crear la donación ni llamar a Mercado Pago.

### Cobertura de sentencia y de decisión de `amountError`

```js
function amountError(amount) {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) return ENTERO;   // D1 (C1 || C2)
  if (amount < MIN_AMOUNT) return MINIMO;                                        // D2
  if (amount > MAX_AMOUNT) return MAXIMO;                                        // D3
  return null;
}
```

| Decisión / condición | Verdadero lo cubre | Falso lo cubre |
|---|---|---|
| D1 | EC1 y EC2 | EC3, EC4, EC5 |
| C1 `typeof !== 'number'` | `'1500'` (EC1) | `100.5` (EC2) y todos los números |
| C2 `!Number.isInteger` | `100.5` (EC2) | todos los enteros |
| D2 `amount < 100` | 99 (EC3) | 100 |
| D3 `amount > 500000` | 500.001 (EC5) | 500.000 |

**Resultado:** las 4 sentencias `return` y las 6 salidas de decisión se ejecutan, o sea, **100 % de sentencia y de
decisión**, y también de condición para la decisión compuesta D1.

**Lo que midió la herramienta** (`node --test --experimental-test-coverage`, lcov solo de este test):
- con los 7 tests: **6/6 líneas** de la función y todas las ramas que informa V8;
- **con un solo caso válido (EC4): también 6/6 líneas, pero solo 1 de 4 ramas.**

Es el ejemplo de por qué **cobertura de sentencia ≠ cobertura de decisión**: con un solo caso se "ejecuta todo"
y quedan sin probar tres de los cuatro caminos.

**Salvedades honestas sobre la herramienta:**
- El runner de Node mide **líneas**, no sentencias: un `if (…) return …;` en una línea figura como ejecutado aunque
  el `return` no corra.
- La cantidad de ramas que informa V8 cambia según lo que se ejecutó (8 en una corrida, 4 en la otra).

Por eso la cobertura de decisión se documenta con la tabla de arriba, y el lcov es el respaldo medido.

**Mutantes** (con la corrida de control en verde antes):
- mueren `<`→`<=` en el mínimo, `>`→`>=` en el máximo, sacar `Number.isInteger`, mínimo 99, máximo 500.001 y `return ''` en vez de `null`;
- **sobrevive** "sacar el `typeof`", y es **equivalente**: `Number.isInteger` ya devuelve `false` para cualquier cosa que no sea un número. El código del producto no se tocó.

## 2. Contraseña — valores límite (8 caracteres y 72 bytes)

**Función:** `validatePassword(v)` en `backend/src/routes/auth.js`.
**Regla:** mínimo 8 caracteres y **máximo 72 bytes UTF-8**, porque bcrypt ignora lo que pasa de 72 bytes (§141).
**Tests:** `test/unit/validators.test.js` → "valores límite", y de punta a punta
`test/integration/register-password-max.test.js`.

| Caso | Entrada | Bytes / caracteres | Esperado |
|---|---|---|---|
| Debajo del mínimo | `Passwo1` | 7 / 7 | "Mínimo 8 caracteres" |
| Mínimo | `Passwor1` | 8 / 8 | válida |
| Máximo, ASCII | `Password1` + 63 × `a` | 72 / 72 | válida |
| Encima del máximo, ASCII | ídem + `a` | 73 / 73 | "Máximo 72 caracteres…" |
| Máximo con ñ (2 bytes) | `A1` + 35 × `ñ` | 72 / **37** | válida |
| Encima, con ñ | ídem + `a` | 73 / 38 | "Máximo 72 caracteres…" |
| No es texto | `undefined`, `null`, `12345678`, `['Password1']` | — | "Mínimo 8 caracteres" (no un 500) |

**Hueco encontrado por mutación:** antes de estos tests, cambiar `v.length < 8` por `< 7` **no hacía fallar ningún
test**, porque el mínimo solo se probaba con `'Ab1'`. Es decir, una contraseña de 7 caracteres podía pasar sin que
nadie se enterara. Con los tests nuevos mueren los 5 mutantes de los bordes: `< 7`, `<= 8`, `>= 72`, "contar
caracteres en vez de bytes" y "sin `typeof`".

## 3. Acceso al CV de un voluntario — tabla de decisión

**Ruta:** `GET /api/voluntarios/:userId/cv` (`backend/src/routes/voluntarios.js`).
**Regla C1 (§165):** el CV lo ve la dueña, o una ONG con una inscripción **pendiente o aprobada** de ella en un
proyecto propio. A cualquier otro se le responde **404 con el mismo mensaje** que "no tiene CV", para no revelar
quién cargó uno.
**Tests:** `test/integration/cv.test.js` → "quién lo puede ver (C1)".

Condiciones:
- **C1** sesión;
- **C2** quién pide (dueña / ONG / otra voluntaria / empresa);
- **C3** (si es ONG) inscripción de la voluntaria en un proyecto propio, con estado pendiente o aprobada;
- **C4** la voluntaria tiene CV;
- **C5** Cloudinary configurado.

| Regla | C1 | C2 | C3 | C4 | C5 | Acción | Test |
|---|---|---|---|---|---|---|---|
| R1 | no | — | — | — | — | **401** | "otro voluntario y una empresa → 404; sin sesión → 401" |
| R2 | sí | dueña | — | sí | sí | **200** (link que vence) | "la dueña lo ve" |
| R3 | sí | ONG | sí (aprobada) / sí (pendiente) | sí | sí | **200** | "ONG con inscripción APROBADA…" / "…PENDIENTE…" |
| R4 | sí | dueña u ONG con permiso | — | sí | **no** | **503** | "Cloudinary sin configurar → 503": dueña y, **desde §199, también la ONG** (era el hueco) |
| R5 | sí | ONG | no (sin inscripción) | — | — | **404** | "ONG sin inscripciones de ella en sus proyectos" |
| R6 | sí | ONG | no (rechazada o cancelada) | sí | — | **404** | "inscripción rechazada o cancelada no alcanza" |
| R7 | sí | otra voluntaria / empresa | — | sí | — | **404** | "otro voluntario y una empresa → 404" |
| R8 | sí | dueña u ONG con permiso | — | **no** | — | **404** | "sin CV cargado: 404 con el mismo mensaje" |
| R9 | sí | ONG con permiso, sin Cloudinary | no | — | no | **404** (el permiso va antes) | ídem R4: `ngo1` sin permiso → 404 |
| R10 | sí | cualquiera, `:userId` que no es voluntario | — | — | — | **404** | "un id que no es de un voluntario…" |

**Mutantes sobre la regla:**
- "la ONG nunca tiene permiso": **mueren 3 tests**;
- "cualquier estado de inscripción alcanza": **muere 1**.

## 4. Defecto real con contraste rojo/verde: B7

**Defecto** (`REVISION.md` B7, corregido en `da8ac95`, `PROJECT_ANALYSIS.md §93`): el filtro de palabras de los
comentarios buscaba **subcadenas**. "Traigan la **computadora**" se rechazaba, porque contiene "puta", y en el otro
sentido "imbécil", con tilde, **pasaba**, porque no se normalizaban los acentos.

**Prueba de regresión:** `backend/test/integration/comments-badwords.test.js` (escrita en el mismo commit del arreglo).

**Contraste:** se corrió **el mismo test** en dos worktrees aparte:

| Commit | Qué es | Resultado | Evidencia |
|---|---|---|---|
| `ae17116` | el anterior al arreglo | **2/2 en rojo**: "computadora" → **400** (se esperaba 201); "imbécil" → **201** (se esperaba 400) | `docs/calidad/evidencia/b7-antes.txt` |
| `da8ac95` | el arreglo | **2/2 en verde** | `docs/calidad/evidencia/b7-despues.txt` |

Es un rojo **fuerte**: falla por el comportamiento, no porque falte un módulo. El test unitario del mismo arreglo
(`unit/badWords.test.js`) se descartó para el contraste justamente por eso: importa `src/lib/badWords.js`, que crea
el mismo commit, así que contra el código viejo fallaría por "módulo inexistente". La prueba de regresión corre
hoy en cada push, en los 4 jobs de backend del CI.

## 5. Inscripción — transición de estados (caja negra)

**Rutas:** `POST /api/enrollments` (inscribirse), `PATCH /api/enrollments/:id` (aprobar o rechazar, la ONG dueña),
`DELETE /api/enrollments/:id` (cancelar, la voluntaria) en `backend/src/routes/enrollments.js`.
**Test:** `backend/test/integration/enrollments-state-transitions.test.js` (23 tests, AAA, una celda por test;
§237 de `PROJECT_ANALYSIS.md`).

**Estados:** SIN inscripción, PENDIENTE, APROBADA, RECHAZADA. Cancelar **borra** la fila: se vuelve a SIN
inscripción. `cancelled` figura en el `CHECK` de la tabla, pero ninguna ruta lo usa.

```
                 inscribirse (201)
  SIN ─────────────────────────────▶ PENDIENTE
   ▲                                  │      │
   │ cancelar                aprobar  │      │ rechazar
   │ (desde cualquiera;  [hay cupo]   ▼      ▼
   │  libera el cupo si    APROBADA ◀──────▶ RECHAZADA
   │  estaba aprobada)       aprobar [hay cupo] / rechazar (libera el cupo)
```

Tabla de transiciones (código HTTP → estado siguiente; "+1"/"−1" = cupo ocupado del proyecto):

| Estado \ Evento | inscribirse | aprobar | rechazar | cancelar | pedir `pending` o `cancelled` |
|---|---|---|---|---|---|
| **SIN** | 201 → PENDIENTE | 404 | 404 | 404 | — |
| **PENDIENTE** | 409 "Ya estás inscripto" | 200 → APROBADA, +1 · **sin cupo: 409, sigue PENDIENTE** | 200 → RECHAZADA | 200 → SIN | **400**, sin cambios |
| **APROBADA** | 409 | 200, sin cambios (idempotente) | 200 → RECHAZADA, −1 | 200 → SIN, −1 | **400**, sin cambios |
| **RECHAZADA** | 409 | 200 → APROBADA, +1 · **sin cupo: 409, sigue RECHAZADA** | 200, sin cambios (idempotente) | 200 → SIN | **400**, sin cambios |

- Las celdas con 400 son las **transiciones inválidas**: se prueban igual que las válidas.
- En cada proyecto del test, otra persona ya ocupa un cupo aprobado, porque liberar el cupo tiene piso en 0
  (`RELEASE_SLOT_SQL`). Sin ella, "cancelar una pendiente resta un cupo" pasaba inadvertido (lo mostró el diseño de
  mutantes antes de correrlos).
- Además: cancelar la inscripción de otra persona → 404 sin cambios.

**Mutantes** sobre `routes/enrollments.js` (con la corrida de control en verde antes): **12, mueren 9**:
- mueren: aceptar `pending` o `cancelled` como evento; rechazar libera el cupo desde cualquier estado / nunca lo
  libera; aprobar sin la guarda de cupo; no deshacer la aprobación sin cupo; cancelar libera desde cualquier estado /
  nunca libera; cancelar la inscripción de otra persona;
- **sobrevive** "sacar el atajo idempotente": no cambia ni el estado ni el cupo, solo duplica la notificación. Lo mata
  `enrollments-concurrency.test.js` (3 tests), que sí mira las notificaciones;
- **sobreviven, equivalentes:** "aprobar suma cupo aunque ya estuviera aprobada" (el atajo idempotente ya cortó antes,
  así que la condición es redundante) e "inscribirse dos veces sin el chequeo previo" (el `UNIQUE(user_id,
  project_id)` de la tabla da el mismo 409 con el mismo mensaje: es defensa en profundidad).

## 6. Monto de una donación — caminos básicos (caja blanca)

Sobre `amountError` (§1), contando cada condición simple como un nodo de decisión:
**V(G) = 4 condiciones (C1, C2, D2, D3) + 1 = 5** caminos independientes. Cada uno tiene un representante en
`donation-amount.test.js`:

| Camino | Condiciones | Sale por | Representante |
|---|---|---|---|
| P1 | C1 verdadera | "número entero de pesos" | `'1500'` |
| P2 | C1 falsa, C2 verdadera | "número entero de pesos" | `100.5` |
| P3 | C1, C2 falsas, D2 verdadera | "mínimo es de $100" | `99` |
| P4 | C1, C2, D2 falsas, D3 verdadera | "máximo es de $500.000" | `500001` |
| P5 | todas falsas | `null` | `2500` |

Si se cuenta la decisión compuesta D1 como **una** sola, V(G) = 4, y P1 y P2 se funden. Por eso la tabla de §1 pide
además cobertura de **condición**.

## 7. Donar a un proyecto — caso de uso

**Actor:** voluntaria o empresa con sesión. **Precondición:** el proyecto está activo y su ONG tiene la cuenta de
Mercado Pago vinculada. **Postcondición de éxito:** la donación queda `completada` una sola vez y el recaudado del
proyecto sube en el monto.

**Flujo principal:**
1. elige el monto;
2. el sistema crea la donación pendiente y la preferencia con el token de la ONG, y devuelve el link;
3. paga en Mercado Pago;
4. el aviso (webhook) o la vuelta concilian: el pago coincide → `completada`, +recaudado, aviso a la ONG.

| Flujo | Qué pasa | Test (en `backend/test/integration/`) |
|---|---|---|
| Principal, pasos 1–2 | 201, donación PENDIENTE, link de pago | `donaciones` → "voluntario: crea la donación PENDIENTE…" |
| Principal, paso 4 | Pago aprobado que coincide → completada y suma | `donaciones` → "pago aprobado que coincide → completada…"; `donaciones-webhook` → "aviso firmado de un pago aprobado…" |
| A1 monto inválido | 400, no crea nada ni llama a MP | `donaciones` → "montos inválidos → 400…" y "los bordes 100 y 500.000…" |
| A2 la ONG no tiene MP vinculado | 409 | `donaciones-marketplace` → "ONG sin cuenta vinculada → 409…" |
| A3 rol sin permiso / sin sesión | 403 / 401 | `donaciones` → "ONG → 403; sin sesión → 401…" |
| A4 proyecto inexistente o inactivo | 404 | `donaciones` → "proyecto: falta → 400; no existe o no está activo → 404…" |
| A5 Mercado Pago falla al crear la preferencia | 502, donación `fallida` | `donaciones` → "Mercado Pago falla al crear la preferencia → 502…" |
| A6 más de 10 intentos por hora | 429 | `donaciones` → "más de 10 intentos por hora → 429…" |
| A7 pago rechazado | sigue pendiente, se puede reintentar | `donaciones` → "rechazado o pendiente → no cambia el estado…" |
| A8 aviso repetido o simultáneo | se acredita una vez | `donaciones` → "el mismo pago dos veces…", "cinco a la vez…"; `donaciones-webhook` → "el mismo aviso repetido…" |
| A9 monto o moneda distintos | no se acredita | `donaciones` → "monto o moneda distintos → NO se acredita…" |
| A10 aviso con firma inválida | 401 sin consultar nada | `donaciones-webhook` → "firma inválida, de otro pago…" |

El paso 3 (pagar) no se automatiza: el checkout de prueba de Mercado Pago da 403 fuera de un navegador. Se verificó a
mano (`INTEGRACION_MERCADOPAGO.md`).

## ⚠️ No verificado

- Las tablas de clases y de decisión se armaron leyendo el código y los tests. Que no falte ninguna condición
  depende de esa lectura, y la mutación la refuerza pero no la garantiza.
- La cobertura de la función se midió con el runner de Node (por líneas). No hay una herramienta de cobertura de
  sentencias en este proyecto.
