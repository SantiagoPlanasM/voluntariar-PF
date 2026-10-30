# Bitácora §215–§238: Marketplace de Mercado Pago y SonarCloud en 0

> Archivo (histórico). Parte de `docs/PROJECT_ANALYSIS.md`, separada el 30/10/2026 sin cambios en el texto. Índice: [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md).

## 215. Marketplace de Mercado Pago (1/5): diseño, cifrado de tokens y OAuth en `lib/payments.js`

**Pedido del usuario (2026-10-18):** que cada ONG conecte su cuenta de vendedor de Mercado Pago y que las donaciones a sus proyectos le lleguen a ella. Todo en **modo prueba**, con usuarios de prueba. Retoma el diseño de §181, que había quedado como trabajo futuro.

**Decisiones del usuario:**
- **Sin comisión de la plataforma:** no se manda `marketplace_fee`.
- **Una ONG sin cuenta vinculada no recibe donaciones.** El botón "Donar" no aparece y la ONG ve un cartel para configurarla.
- **`client_secret`:** sin decidir. Solo aparece al activar las credenciales productivas de la aplicación; la IA de Mercado Pago lo confirmó el 2026-10-18. Por eso el OAuth se implementa completo, probado con dobles. Además va a haber un script para cargar a mano el token del vendedor de prueba (tarea 2), así la demo no depende de esa activación.

**Diseño (cinco tareas, un commit cada una):**
1. **Esta:** cifrado de tokens y funciones OAuth.
2. Esquema y endpoints para vincular, volver de Mercado Pago y desvincular.
3. Donaciones con el token de la ONG: renovación, conciliación y webhook.
4. Frontend.
5. Prueba en vivo con el usuario.

Las tablas y los endpoints se documentan en la tarea en que se crean.

**Respuestas de la IA de Mercado Pago (2026-10-18), resumidas:**
- El intercambio usa el `client_id` y el `client_secret` de la aplicación, con `test_token=true`.
- La renovación va con `grant_type=refresh_token` y sin `test_token`. Devuelve un `refresh_token` nuevo: hay que guardar siempre el último.
- Los pagos de un vendedor llegan al webhook de la aplicación, con el `user_id` del vendedor en el cuerpo.
- El comprador de prueba puede pagarle a otro vendedor de prueba del mismo país.
- Para no cobrar comisión alcanza con no mandar `marketplace_fee`.
- No hay un endpoint para que la aplicación revoque la autorización: desvincular es borrar los tokens propios.

**Qué se hizo:**
- **`src/lib/tokenCrypto.js`:**
  - AES-256-GCM con la clave `MP_TOKEN_KEY` (32 bytes en base64), un IV al azar por cifrado y un tag de 16 bytes.
  - Formato `v1:<iv>:<tag>:<cifrado>`.
  - El `ngo_id` va como dato asociado: un token copiado a la fila de otra ONG no se descifra.
  - Los errores nunca incluyen el token.
- **`src/lib/payments.js`:**
  - `call`, `createPreference` y `getPayment` aceptan el `accessToken` de la ONG. Sin él, siguen con `MP_ACCESS_TOKEN`.
  - Un 401 da `code: 'unauthorized'`. Con el token de la ONG, el log ya no culpa a `MP_ACCESS_TOKEN`.
  - Funciones nuevas: `isOAuthConfigured`, `authorizationUrl`, `exchangeCode` y `refreshAccessToken`.
  - **Barrera de modo prueba:** cualquier token con `live_mode` distinto de `false` se rechaza (`live_token`), aunque falte el campo.
  - Del cuerpo de un error de `/oauth/token` solo se toma el campo `error`, si es un identificador corto. Puede traer repetidos el code o el secreto.
- **Tests:** `test/unit/tokenCrypto.test.js` (11) y `test/unit/payments-oauth.test.js` (21). Rojo de comportamiento antes del código: con stubs vacíos fallaban los 31 que había en ese momento, y no por "el módulo no existe".

### Verificación
- **Backend:** `npm test` 840/840; `TZ=America/Argentina/Cordoba npm test` 840/840; `npm run test:pg` 842/842 (antes 808 y 810: +32).
- **Mutación sobre el código nuevo:** 38 mutantes.
  - 33 muertos.
  - 5 equivalentes: el chequeo de `raw` vacío, el `trim` de la clave y los largos del IV, del tag y del cifrado. GCM y `authTagLength` ya los rechazan, y `Buffer.from` ignora los espacios. **Se sacaron del código**, así que no quedan.
  - Los otros dos que sobrevivieron al principio (la versión `v1` y renovar sin configuración) murieron con dos tests nuevos.

### Errores propios
- **Un test comparaba contra la clase de error de otra carga del módulo** (`fresh()`): fallaba aunque el código estaba bien. Ahora compara por `name` y `code`.
- **`git checkout` para sacar el stub dejó `payments.js` en CRLF** (estaba en LF). Se notó porque los mutantes de varias líneas no se aplicaban. Se volvió a LF. El `grep` de Git Bash no mostraba los `\r`; se contaron con Node.

### ⚠️ NO verificado
- Nada habló con Mercado Pago: todo es con dobles de `fetch`.
- **La forma real de la respuesta y de los errores de `/oauth/token`** sale del SDK `mercadopago@3.6.1` y de la IA de Mercado Pago. En particular: que la renovación no lleve `test_token`, que un `refresh_token` usado deje de servir y que el error sea `invalid_grant`.
- Que el token de prueba venga con `live_mode: false` (la barrera depende de eso).
- Que exista el `client_secret` sin activar las credenciales productivas: según la IA, no existe.

## 216. Marketplace de Mercado Pago (2/5): cuenta de la ONG — esquema, vincular/volver/desvincular y carga manual

**Qué se hizo:**
- **Esquema** (aditivo, `scripts/migrate.js`):
  - `ngo_cuentas_mp`: una fila por ONG, `mp_user_id` UNIQUE, tokens cifrados, `estado`, `origen` (`oauth` o `manual`) y `version`.
  - `mp_oauth_states`: solo el hash del `state`, 10 minutos.
  - Ver `DATABASE_CONTEXT.md`.
- **`src/lib/sellerAccounts.js`:** el único lugar que lee o escribe `ngo_cuentas_mp`, con `publicAccount`, `saveAccount` y `deleteAccount`.
- **`src/routes/mercadopago.js`**, montado en `/api/ngos/me/mercadopago`: `GET /`, `POST /connect`, `POST /callback` y `DELETE /` (`API_CONTEXT.md`).
  - **La vuelta de Mercado Pago llega al frontend** (`/ngo/mercadopago/vuelta`), que llama a `/callback` con la sesión de la ONG. Así se comprueba que el `state` sea de esa ONG, sin un endpoint público.
  - El `state` se consume (`DELETE` mirando `changes`) **antes** del intercambio y fuera de toda transacción. Dos vueltas simultáneas hacen un solo intercambio.
  - Los logs solo llevan el código del error, nunca el code, el `state` ni los tokens.
- **`scripts/vincular-mp-manual.js` (plan B de §215):** guarda a mano el access token de un vendedor de **prueba**.
  - El token se lee de `MP_MANUAL_SELLER_TOKEN` y no de un argumento, para que no quede en el historial.
  - Exige el tag `test_user` en `GET /users/me`.
  - Para eso se agregó `payments.getSellerUser`.
- **`backend/.env.example`:** no tenía ninguna variable de Mercado Pago. Ahora tiene un bloque con las seis, comentadas.
- **Tests:**
  - `test/integration/mercadopago-cuenta.test.js` (21);
  - `ownership.test.js`: una ONG no puede usar el `state` de otra, ni ver o desvincular su cuenta, y la dueña sí (regla 15);
  - `public-columns.test.js`: suma `ngo_cuentas_mp`, con el centinela en los tokens (regla 8);
  - 2 de `getSellerUser`.

### Verificación
- **Rojo de comportamiento:** con un router stub que respondía 501 y un `linkManually` vacío fallaban 19 de 20. Pasaba el de la migración, porque el esquema ya estaba escrito.
- **Backend:**
  - `npm test`: 864/864;
  - `TZ=America/Argentina/Cordoba npm test`: 864/864;
  - `npm run test:pg`: 866/866;
  - antes eran 840 y 842: +24.
- **Mutación:** 41 mutantes.
  - 37 muertos de entrada.
  - De los 4 sobrevivientes, 3 murieron con tests nuevos: `/callback` sin configuración, y que el script no consulte a Mercado Pago con un token vacío.
  - El cuarto era equivalente: el filtro por `ngo_id` estaba en el `SELECT` y en el `DELETE` del `state`, y cada uno tapaba al otro. Se dejó solo en el `SELECT`, y con eso también murió el mutante que lo saca de ahí.

### Errores propios
- **`getSellerUser` se escribió antes de correr su test en rojo.** Los 5 mutantes sobre esa función murieron, así que el test sí la cubre, pero no hubo rojo previo.
- **El test de acceso le mandaba cuerpo a un GET** (`fetch` lo rechaza): era un error del test, no del código.

### ⚠️ NO verificado
- Nada habló con Mercado Pago.
- **Que el tag `test_user` exista en los usuarios de prueba.** Si no existe, el script se niega a guardar la cuenta, que es lo seguro.
- Que la URL de redireccionamiento de la aplicación acepte `/ngo/mercadopago/vuelta`. En §181 se cargó la raíz del sitio. **El usuario tiene que cambiarla en el panel** cuando se use el OAuth.
- La pantalla de vuelta no existe todavía (tarea 4).

## 217. Marketplace de Mercado Pago (3/5): las donaciones se cobran con la cuenta de la ONG

**Qué se hizo:**
- **`donaciones.cobrador_mp_user_id`** (aditiva): con qué cuenta se creó la preferencia. NULL quiere decir la cuenta de la aplicación, en las donaciones de antes.
- **`POST /api/donaciones`:**
  - pide el token de la ONG (`sellerAccounts.getValidToken`);
  - **409** "Esta ONG todavía no recibe donaciones" si no tiene cuenta (decisión del usuario);
  - **503** si la cuenta requiere reconexión o falta `MP_TOKEN_KEY`;
  - la preferencia se crea con el token de la ONG, sin `marketplace_fee`;
  - un 401 de Mercado Pago marca la cuenta como "requiere reconexión" y la donación queda `fallida`;
  - ya **no** pide `MP_ACCESS_TOKEN`.
- **Renovación del token** (`getValidToken`): cuando faltan menos de 7 días.
  - **Una por ONG en el proceso**, y **compare-and-swap sobre `version`** entre procesos. Hace falta porque el refresh token cambia en cada renovación.
  - Si la renovación falla con `invalid_grant` porque otro proceso ya la hizo, se usa el token nuevo y no se marca la cuenta.
  - Ante un rechazo real, la cuenta pasa a "requiere reconexión" y se avisa a la ONG con una notificación `mp_reconnect_needed`, una sola vez.
- **`applyPayment(id, { accessToken, mpUserId })`:** el pago solo vale para una donación cobrada con **esa** cuenta. Si no, devuelve `mismatch` sin escribir nada.
- **Webhook:** el `user_id` del cuerpo, que no está firmado, solo elige con qué token consultar el pago. Si la cuenta de la ONG cayó, responde 500 y Mercado Pago reintenta.
- **Conciliación:** usa la cuenta que cobró. Si la ONG la desvinculó, no consulta.
- **`GET /api/projects/:id`** devuelve `accepts_donations`.
- **Tests:**
  - `test/integration/donaciones-marketplace.test.js` (29);
  - `donaciones.test.js`: `ngo-1` queda vinculada en el `before()`. El test "sin `MP_ACCESS_TOKEN` → 503" pasa a "sin `MP_TOKEN_KEY` → 503", con el mensaje nuevo, porque cambió la regla. Hay uno nuevo para el token de la ONG en la preferencia;
  - `routes/donaciones.js` exporta su limitador (`donationLimiter`), así los tests pueden pasar de 10 donaciones.

### Verificación
- **Rojo:** 22 de 27 fallaban antes del código. Los 5 que pasaban describen comportamiento que no cambia, como la donación vieja con el token de la aplicación.
- **Backend:**
  - `npm test`: 894/894;
  - `TZ=America/Argentina/Cordoba npm test`: 894/894;
  - `npm run test:pg`: 896/896;
  - antes eran 864 y 866: +30.
- **Mutación:** 40 mutantes.
  - 32 muertos de entrada.
  - 2 murieron con tests nuevos: `live_token` y un refresh token que no se descifra; y que sin `MP_TOKEN_KEY` la cuenta no quede marcada.
  - **4 equivalentes por redundancia, sacados del código:**
    - el `estado='activa'` al marcar (todo cambio sube `version`);
    - la rama "no se pudo descifrar por falta de clave", inalcanzable porque la clave se chequea antes;
    - el `estado` en el atajo de `getValidToken` (`tokenFrom` ya lo rechaza);
    - el "sin refresh token", que solo se da en las cuentas manuales, y esas no tienen vencimiento.
  - **2 equivalentes que quedan:**
    - mover en 1 segundo el borde "todavía vale": no se puede probar sin un reloj falso;
    - el `ngoId ? … : null` de la conciliación: sin él, `getValidToken(null)` lanza `not_linked` y el resultado es el mismo; solo cambia el log.

### Errores propios
- **El test de la donación fallida buscaba "la última por `created_at`"**, la trampa de la regla 23: en SQLite empataba con otras del mismo segundo. Ahora el `beforeEach` vacía `donaciones` y el test lee la única fila.
- **El archivo nuevo pasaba el tope de 10 donaciones por hora**: dos tests daban 429. Por eso se exporta el limitador.
- **Al insertar el export del limitador corté el comentario de la línea de `amountError`.** Se vio en el `tail` y se corrigió antes de commitear.

### ⚠️ NO verificado
- **Que una preferencia creada con el token OAuth de un vendedor de prueba acredite en su cuenta.** Lo dice la IA de Mercado Pago; se prueba en la tarea 5.
- Que el aviso del webhook traiga el `user_id` del vendedor (IA de Mercado Pago). Si no lo trae, el aviso consulta con la cuenta de la aplicación, da `mismatch` y la acreditación queda para la conciliación.
- **El E2E post-deploy (`.github/scripts/post-deploy.js`) dona al primer proyecto de la lista.** Si se despliega antes de que esa ONG vincule su cuenta, va a recibir 409 y el deploy va a dar rojo. **No hay que hacer push** hasta vincular la ONG SANTI y apuntar el E2E a "Test" (`E2E_PROJECT_ID`), que es la tarea siguiente que pidió el usuario.
- La interfaz: el botón "Donar" todavía no lee `accepts_donations` (tarea 4).

## 218. Marketplace de Mercado Pago (4/5): frontend — vincular la cuenta, el cartel del panel y el botón Donar condicionado

**Qué se hizo:**
- **`lib/api.ts`:** `api.ngos.mercadopago.{get, connect, callback, disconnect}`, los tipos `MpAccount` y `MpAccountState`, y `ProjectDetail.accepts_donations`. Los cuatro métodos entran en el test de contrato: el cuerpo `{ code, state }` es exactamente lo que lee `routes/mercadopago.js` (regla 10).
- **`MercadoPagoAccountSection`** en el perfil de la ONG (`#mercadopago`):
  - estado de la cuenta, "Vincular", "Volver a vincular" y "Desvincular" (con confirmación en la página);
  - aclara si la cuenta se cargó a mano;
  - avisa si "dejó de funcionar".
- **`MercadoPagoBanner`** en el panel: "Configurá tu cuenta de Mercado Pago para recibir donaciones…", o "Volvé a vincular…". Es el cartel que pidió el usuario.
- **`/ngo/mercadopago/vuelta` (`MercadoPagoReturn`):** manda `code` y `state` una sola vez, también en StrictMode.
- **`ProjectDetails`:** "Donar" solo con `accepts_donations`. Si no, "Esta ONG todavía no recibe donaciones".
- **Tests:**
  - `MercadoPagoAccount.test.tsx` (15);
  - `MercadoPagoReturn.test.tsx` (5);
  - `ProjectDetailsDonate.test.tsx`: +2, y el proyecto base ahora acepta donaciones;
  - contrato: +4.

### Verificación
- **Rojo de comportamiento:** con componentes stub y métodos de `api` que rechazaban, 22 tests fallaban.
- **Frontend:**
  - `npm test`: 890/890 (antes 864);
  - `npm run typecheck`: 0 errores;
  - cobertura (`npm run test:coverage`): sentencias 86,69 %, ramas 81,44 %, funciones 82,54 %, líneas 90,34 %, las cuatro sobre el umbral del 80 %.
- **Mutación:** 31 mutantes. 27 murieron de entrada y los otros 4 con tests nuevos: 0 sobrevivientes.
  - el scroll no espera a que carguen los datos;
  - el scroll se repite al recargar;
  - "Volver a vincular" sin OAuth disponible;
  - el mensaje de "no autorizó": el test aceptaba los dos mensajes.

### Errores propios
- **La primera versión no hacía scroll al ancla.** `react-router` no lo hace solo, y la sección aparece después de cargar. Se notó al revisar el link del cartel, antes de commitear.
- **El test de la vuelta sin `code` aceptaba cualquiera de los dos mensajes.** Lo mostró un mutante.

### ⚠️ NO verificado
- **Nada visual ni en un navegador:** el cartel, la sección, el scroll, la pantalla de vuelta, ni cómo se ve en el celular.
- Que Mercado Pago, cuando la ONG no autoriza, vuelva con `?error=…`. Si vuelve sin `code`, igual se muestra "El link de vuelta no es válido".
- Al recargar la página de vuelta después de vincular, el `state` ya está usado y la pantalla dice que no se pudo. La cuenta queda vinculada igual; el perfil lo muestra bien.

## 219. `render.yaml`: las variables del Marketplace (con OK del usuario)

**Qué se hizo:**
- Se agregaron `MP_TOKEN_KEY`, `MP_CLIENT_ID` y `MP_CLIENT_SECRET`, las tres con `sync: false`.
- Se agregó `MP_OAUTH_REDIRECT_URI` con su valor (`https://voluntariar-g0u6.onrender.com/ngo/mercadopago/vuelta`), porque no es secreta.
- **Se corrigió el comentario** que decía "sin `MP_ACCESS_TOKEN` donar responde 503": desde §217 la que hace falta para donar es `MP_TOKEN_KEY`.

### Verificación
- Ningún test lee `render.yaml`: los workflows solo lo nombran en comentarios.
- El YAML conserva la indentación y los finales de línea (LF).

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- **Que Render tome las variables nuevas.** El auto-deploy está apagado, y no está confirmado que el servicio se cree desde el Blueprint. Lo seguro es **cargarlas a mano en el panel** de `voluntariar-api`. `MP_TOKEN_KEY` se genera con `node -p "require('crypto').randomBytes(32).toString('base64')"`.

## 220. El E2E post-deploy dona al proyecto de prueba (`E2E_PROJECT_ID`), y su ONG tiene que tener Mercado Pago vinculado

**El problema:**
- El E2E donaba al primer proyecto de la lista, que es uno real ("Jornada de limpieza en el Lago"). Ver la memoria del 2026-10-18 y §215.
- Desde §217, si ese proyecto es de una ONG sin cuenta vinculada, la donación da 409 y el deploy daría rojo.

**Qué se hizo:**
- **`.github/scripts/post-deploy.js`:** `E2E_PROJECT_ID` es **obligatoria**: sin ella el E2E falla con un mensaje claro.
  - Antes de donar, `checkE2EProject` comprueba con `GET /api/projects/:id` que el proyecto exista, esté activo y tenga `accepts_donations: true`. Si no, el mensaje dice qué revisar.
  - La donación va a ese proyecto.
- **`deploy.yml`:** `E2E_PROJECT_ID` sale de `vars` (variable del repositorio, no secreto) y se suma al chequeo inicial "faltan secretos o variables → no se despliega".
- **`docs/calidad/COMO_CORRER_PRUEBAS.md`:** el comando del E2E lleva `E2E_PROJECT_ID`.

### Verificación
- **Rojo:** con un stub, 4 de los 5 tests nuevos fallaban.
- **Tests de los scripts:** `node --test ".github/scripts/*.test.js"` da 38/38 (antes 33).
- **Mutación:** 7 mutantes en `checkE2EProject`, los 7 muertos.

### Errores propios
- Ninguno en esta tarea.

### ⚠️ NO verificado
- **El workflow no corrió:** no hubo push.
- **Antes del push hay que:**
  1. crear la variable `E2E_PROJECT_ID` = `32223ac7-2cc6-412b-96ca-9e2b647eac9d` en GitHub (Settings → Secrets and variables → Actions → Variables);
  2. cargar `MP_TOKEN_KEY` en Render;
  3. vincular la cuenta de Mercado Pago de la ONG SANTI.

  Sin el primer paso el deploy no arranca. Sin los otros dos, el E2E falla en "su ONG recibe donaciones".

## 221. `vincular-mp-manual.js --solo-ver`: ver de quién es un token antes de vincularlo

**Por qué:**
- El usuario eligió la carga manual para la ONG SANTI. La IA de Mercado Pago (2026-10-18) dijo que el access token de prueba "se toma del panel de tu aplicación" y no se deriva del `user_id` del vendedor.
- En §181, ese token era de la cuenta vendedora **oculta** 3771872304, creada por Mercado Pago, y no del vendedor de prueba de la ONG (3772556008).
- Vincular a SANTI con ese token hace funcionar todo el mecanismo nuevo (token por ONG, `cobrador_mp_user_id`, conciliación), pero la plata cae en la misma cuenta de siempre. No demuestra que llegue a la ONG.
- Antes de vincular, hay que poder ver de quién es cada token.

**Qué se hizo:**
- `inspectToken` y el flag `--solo-ver`: consultan `GET /users/me` y muestran el `user_id`, el nickname, los tags y si es de prueba. **No escriben nada.**
- Se probó a mano sin token: falla con "Falta el token del vendedor".

### Verificación
- **Rojo:** el test nuevo fallaba con un stub.
- **Backend:** `npm test` 895/895; `TZ=America/Argentina/Cordoba npm test` 895/895; `npm run test:pg` 897/897.
- **Mutación:** 5 mutantes.
  - 2 murieron de entrada.
  - Los 3 que sobrevivieron (usuario sin tags, sin nickname, y el `trim` del token) murieron al completar el test.
- **`MP_TOKEN_KEY` local:** se generó en `backend/.env` sin mostrarla. `.env` está ignorado por git, y `isTokenKeyConfigured()` da `true`. La misma clave tiene que ir en Render.

### Errores propios
- El primer test de `inspectToken` no cubría un usuario sin tags ni sin nickname. Lo mostró la mutación.

### ⚠️ NO verificado
- Qué devuelve `GET /users/me` con cada token real: lo va a mostrar `--solo-ver`.
- Si el vendedor 3772556008 puede tener su propio token sin OAuth.

## 222. Marketplace en producción (5/5, primera parte): la ONG SANTI vinculada con su vendedor de prueba

**Qué se hizo, con el usuario y en modo prueba:**
- **El token:** el usuario creó una integración **dentro de la cuenta del vendedor de prueba** 3772556008 y dejó su access token en `backend/.env.local`, que está ignorado por git. Nunca pasó por el chat. La IA de Mercado Pago confirmó el 2026-10-18 que las credenciales son del dueño de la aplicación.
- **`--solo-ver`:** "Cuenta de Mercado Pago 3772556008 (TESTUSER…); tags: user_product_seller, test_user, normal". Es el vendedor de la ONG y no la cuenta oculta de la aplicación, 3771872304 (§181).
- **`MP_TOKEN_KEY`:** se generó en `backend/.env` sin mostrarla, y el usuario la cargó en Render.
- **Con el OK del usuario, contra la base de Render:**
  - `scripts/migrate.js` creó `ngo_cuentas_mp` y `mp_oauth_states`, agregó `donaciones.cobrador_mp_user_id` y el índice;
  - `vincular-mp-manual.js` vinculó a la ONG SANTI (`378f6338-…`).
- El usuario decidió no activar las credenciales productivas: la vinculación por OAuth sigue sin probarse en vivo.

### Verificación
- **Consulta de solo lectura en producción:** la fila de SANTI tiene `mp_user_id` 3772556008, `estado` `activa`, `origen` `manual`, `version` 1, sin vencimiento ni refresh token.
- **Cifrado:** el token guardado se descifra con la `MP_TOKEN_KEY` local y coincide con el original. Hay 1 cuenta vinculada en total.
- **Quedan verificadas** dos suposiciones de §216: el tag `test_user` existe, y `GET /users/me` devuelve el `id` y los `tags`.

### Errores propios
- Ninguno en este paso. La primera versión de `.env.local` traía el token vacío y la URL **interna** de la base. Se detectó revisando el archivo sin mostrar los valores, antes de correr nada.

### ⚠️ NO verificado (sigue la segunda parte)
- **La API desplegada todavía es la de antes de §215:** no hubo push.
- **Falta comprobar** que la donación al proyecto "Test" cree la preferencia con el token del vendedor y que, pagada con el comprador de prueba, el saldo de prueba aparezca en la cuenta 3772556008.
- Falta crear la variable de GitHub `E2E_PROJECT_ID` antes del push.

## 223. Deploy: `E2E_PROJECT_ID` se acepta como variable o como secret

**El problema:** el deploy de `36a5982` se cortó en "Faltan los secretos o variables: E2E_PROJECT_ID". El usuario la había creado como **secret**, y `deploy.yml` la leía solo de `vars`, las variables del repositorio. En GitHub son dos pestañas distintas, y así no la veía aunque la volviera a cargar.

**Qué se hizo:** `E2E_PROJECT_ID: ${{ vars.E2E_PROJECT_ID || secrets.E2E_PROJECT_ID }}`. No es un dato secreto, pero cargarla de cualquiera de las dos formas tiene que andar.

### Verificación
- Pendiente: el run que dispara este push.

### Errores propios
- **En §220 indiqué "Variables"** sin avisar que, si se cargaba en "Secrets", el workflow no la iba a ver. Era fácil confundirse, y el código podía aceptar las dos.

### ⚠️ NO verificado
- El run de deploy con este cambio.

## 224. Marketplace en producción (5/5, cierre): deploy en verde y donación de punta a punta a la ONG SANTI

**Qué pasó:**
- **Deploy de `e3c57af`, desde el pipeline:** `wait`, `smoke` y `e2e` en verde. El E2E pasó por "el proyecto de E2E existe, está activo y su ONG recibe donaciones", y `POST /api/donaciones` creó la preferencia (201 con `pref_id`) con el token del vendedor de la ONG. Ahí se verifica en vivo §220 y §223.
- **Prueba manual del usuario:** donó $100 al proyecto "Test" y pagó con el comprador de prueba. Informó que "anda perfecto". La acreditación por la vuelta o por el webhook funcionó con la cuenta de la ONG.
- **El usuario borró `backend/.env.local`**, que tenía el token del vendedor y la URL de la base.

### Verificación
- **Lecturas públicas de producción:**
  - `GET /api/projects/32223ac7-…` (Test) da `accepts_donations: true` y `current_funding` 100;
  - "Jornada de limpieza en el Lago", que era al que donaba antes el E2E, resultó ser también de la ONG SANTI.
- **El resumen del run de Deploy**, que pegó el usuario.

### Errores propios
- Ninguno nuevo; el de §223 (variable o secret) ya está anotado.

### ⚠️ NO verificado
- **Que el saldo de prueba esté en la cuenta 3772556008 y no en la de la aplicación** lo dice el usuario ("anda perfecto"). Yo no vi el panel de Mercado Pago del vendedor.
- **La vinculación por OAuth (el botón)** no se probó en vivo: sin `client_secret`, por decisión del usuario. Tampoco la renovación del token, que no aplica a las cuentas manuales, ni el webhook con el `user_id` del vendedor.
- **Nada visual de §218**, salvo lo que vio el usuario al donar.

## 225. SonarCloud sobre el Marketplace: 3 S5145 (inyección en logs) corregidas con `forLog`

**Cómo apareció:** al juntar los números para el informe del TP, la API pública de SonarCloud mostró **3 vulnerabilidades nuevas** en el análisis de `e3c57af`. El informe decía 0.
- Son tres `S5145`, de severidad menor. La seguridad bajó de A a B.
- El gate del TP no bloqueó, porque solo frena las críticas.
- Estaban en `routes/mercadopago.js` (el `mpUserId` en el log de la vinculación) y en `scripts/vincular-mp-manual.js` (nickname, tags y mensajes de error de Mercado Pago).

**Qué se hizo:**
- Todo valor externo pasa por `forLog()`, como en §202.
- Los mensajes del script pasaron a funciones puras (`describeInspection`, `describeLinked`), exportadas para el test.
- Detalle y medidas en `docs/calidad/TRIAGE_SONAR.md`.

### Verificación
- **Rojo:** 2 tests nuevos que mandan saltos de línea (en el nickname y en el `mpUserId`) fallaban con stubs.
- **Backend:** `npm test` 897/897; `TZ=America/Argentina/Cordoba npm test` 897/897; `npm run test:pg` 899/899.
- **Mutación:** 7 mutantes (sacar cada `forLog`, el "(ninguno)" y el mensaje de prueba o no prueba), los 7 muertos.
- `--solo-ver` sin token sigue fallando con su mensaje.

### Errores propios
- **Escribí logs con datos externos crudos**, contra la regla de §202 que yo mismo había aplicado antes. Ningún test de §216 ni de §221 lo miraba; lo encontró SonarCloud.

### ⚠️ NO verificado
- Que el próximo análisis las dé por cerradas: hasta ahora Sonar no siempre reconoció `forLog()` como sanitizador (§202). Si no las cierra, se aceptan con el comentario de `TRIAGE_SONAR.md`.

## 226. Informe del TP actualizado con el marketplace (corte 18/10/2026) y PDF regenerado

**Qué se hizo:**
- **`docs/calidad/informe/INFORME_TP_CALIDAD.html`:**
  - **resumen:** el marketplace;
  - **"En números":** 897/899, 890, cobertura, Sonar 157 → 57 y 50 commits;
  - **tabla de metas:** pipeline (CI #23), gate (0 / 0 / 1,9 % / 94,6 %), cobertura nueva y existente, smoke (con el Deploy #14) y E2E (proyecto de prueba, token de la ONG, 4 pagos a mano);
  - **ejes 3.4, 3.7 y 3.9:** complejidad, tasas del pipeline, densidad corregida (75,9), 62 archivos de integración y §183–§225;
  - **sección 4:** dos análisis nuevos de SonarCloud, la fila del CI #23 y las corridas (CI 23/21, Deploy 16/12, con el #14);
  - **análisis crítico:** punto nuevo sobre el marketplace;
  - **conclusiones y trabajo futuro:** el OAuth en vivo como límite;
  - **anexo:** enlaces al CI #23 y al Deploy #16.
- **`docs/calidad/INTEGRACION_MERCADOPAGO.md`:** sección 2.1 del marketplace, los tres niveles de prueba actualizados y el límite del OAuth.
- **PDF regenerado** con Chrome headless: 9 páginas. Se sacó el salto forzado antes de "5. Análisis crítico", que dejaba una página casi vacía.

### Verificación
- **Cada número sale de una fuente consultada en el momento:**
  - corridas: API pública de GitHub (CI #23 y Deploy #16 en verde; 23 y 16 corridas en total);
  - SonarCloud: API pública, análisis de `6e4a51c` (vulnerabilidades 0, cobertura nueva 94,59 %, duplicación 1,9 %, 17.583 líneas, complejidad 4.240 y 2.851, deuda 114 min, 57 issues);
  - cobertura del backend: corrida local con los parámetros del CI (93,19 / 85,02 / 90,12);
  - frontend: §218;
  - commits: `git log 20d881a^..HEAD` = 50;
  - archivos de integración: `ls` = 62.
- **PDF revisado página por página.**

### Errores propios
- **Inconsistencia vieja:** en 3.4 decía 60,6 tests/KLOC en el frontend y en el análisis crítico, 75,9. Corregida.

### ⚠️ NO verificado
- **La cobertura que informa el CI #23:** su resumen no se lee sin sesión. El informe usa la corrida local y lo aclara. El CI pasó los umbrales.
- **Que el saldo de prueba llegue a la cuenta de la ONG** lo dice el usuario: no vi el panel del vendedor.

## 227. Evidencia: la donación del marketplace llegó a la cuenta del vendedor de la ONG

**Qué pasó:** el usuario compartió una captura de la cuenta de Mercado Pago del vendedor de prueba de la ONG SANTI. Muestra:
- "Venta — Donación: Test — Aprobado — **+$100**", operación 183826224899;
- **$95,90** "a liquidar": los $100 menos la comisión de Mercado Pago (~$4,10). La plataforma no cobra comisión: no se manda `marketplace_fee`.

Con esto queda verificado el último punto que §222 y §224 dejaban sin verificar: **la plata llega a la cuenta de la ONG** y no a la de la aplicación.

**Qué se hizo:**
- La captura se guardó en `docs/calidad/evidencia/marketplace-venta-vendedor-prueba.png`.
- Se citó en `INTEGRACION_MERCADOPAGO.md` y en el anexo 7.2 del informe.
- PDF regenerado.

**Sobre `gh` en Docker (pregunta del usuario):** se podría correr con la imagen oficial, pero igual necesita iniciar sesión con la cuenta del usuario. Para el informe alcanzó la API pública de GitHub. Lo único que no se ve sin sesión es el resumen de cobertura de cada corrida.

### Verificación
- La captura la leí yo: monto, concepto ("Donación: Test", el título que arma `POST /api/donaciones`), estado y número de operación.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- Que la captura sea de la cuenta 3772556008: no muestra el número de cuenta. Se toma la palabra del usuario, que entró con ese vendedor. Es coherente con `--solo-ver` (§222). No miré la cuenta de la aplicación.

## 228. Informe: la cobertura del CI #23 sale del log del run (con `gh`), no de la corrida local

**Qué pasó:** el usuario avisó que `gh` estaba instalado. Está en `C:\Program Files\GitHub CLI\gh.exe`, fuera del PATH de la terminal del asistente, que arrancó antes de la instalación. Tiene sesión iniciada con la cuenta del usuario. Con `gh run view 39144726116 --log` se leyó la cobertura que informó el CI #23 en sus jobs:

| Job | Líneas | Ramas | Funciones | Sentencias |
|---|---|---|---|---|
| Backend · SQLite · UTC | 93,21 % | 85,31 % | 90,19 % | — |
| Backend · SQLite · Córdoba | 93,17 % | 85,33 % | 90,19 % | — |
| Frontend · UTC | 90,34 % | 81,48 % | 82,45 % | 86,69 % |
| Frontend · Córdoba | 90,34 % | 81,44 % | 82,45 % | 86,69 % |

**Qué se hizo:**
- El informe usa los valores del job en UTC, en "En números", la tabla de metas y 4.2.
- Se sacó la aclaración de que la cobertura venía de la corrida local.
- PDF regenerado.
- Las diferencias con la corrida local (§226) son de centésimas: Node 24 local contra Node 22 en el CI.

### Verificación
- Se extrajeron las líneas "all files" del log del run, una por job.

### Errores propios
- Ninguno. Resuelve el "no verificado" de §226.

### ⚠️ NO verificado
- Nada nuevo.

## 229. SonarCloud S7773: las 57 issues abiertas, arregladas (`Number.parseInt`, `Number.isNaN`…)

**Qué se hizo:** el usuario pidió arreglar las issues de SonarCloud. La API pública daba **57 abiertas** sobre `6e4a51c`, todas `S7773` (MINOR): funciones globales en vez de las de `Number`. Estaban en 6 archivos del backend (`db/index.js`, `lib/inputs.js`, `routes/projects.js`, `enrollments.js`, `follows.js`, `ngos.js`) y 9 componentes del frontend.
- `parseInt`, `parseFloat`, `isFinite` y `NaN` → `Number.*` con un script de Node que respeta CRLF y no toca comentarios. Son las mismas funciones: sin cambio de comportamiento.
- `isNaN` → `Number.isNaN` se miró caso por caso, porque el global convierte el argumento antes. En 8 componentes el argumento sale de `parseFloat`/`parseInt` y siempre es un número, así que da lo mismo.
- **El único caso no mecánico: `getProjectCoords` (`ProjectMap.tsx`).** Recibía `p.latitude` directo, que puede llegar como string. Con el reemplazo mecánico, `'abc'` dejaba de caer al respaldo por ubicación y el mapa recibía `NaN`. Ahora convierte con `Number()` y después mira `Number.isNaN`, que es lo mismo que hacía el global.
- **Tests primero:** 6 tests de caracterización de `getProjectCoords` en `ProjectMap.test.tsx` (número, string numérico, string no numérico en latitud y en longitud, `NaN`, `null`). Pasaron con el código viejo antes del cambio.
- `TRIAGE_SONAR.md` actualizado; `CLAUDE.md` con el conteo nuevo del frontend.

### Verificación
- Backend: `npm test` **897/897** en SQLite y con `TZ=America/Argentina/Cordoba`; `npm run test:pg` **899/899** (Postgres 16 en Docker). 0 fail, 0 cancelled.
- Frontend: `npm test` **896/896** (890 + 6); `npm run typecheck` sin errores.
- **Mutación** sobre la lógica nueva de `getProjectCoords`, con corrida de control verde: **7 mutantes, 0 sobrevivientes** (sin convertir latitud, sin convertir longitud, `&&` → `||`, sin chequeo de cada coordenada, devolver siempre y el reemplazo mecánico).
- Finales de línea: los archivos CRLF siguen CRLF y los LF siguen LF (contados con Node).
- `grep` sin usos globales que queden en `backend/src` y `frontend/src` fuera de comentarios y tests.

### Errores propios
- Ninguno en este cambio.

### ⚠️ NO verificado
- **Que SonarCloud cierre las 57:** se ve en el próximo análisis del CI, después del push. El informe del TP sigue diciendo "157 → 57" (el análisis de `6e4a51c`); se actualiza cuando esté el análisis nuevo.
- Los tests (`*.test.*`) no los analiza Sonar y no se tocaron: pueden tener usos globales.
- Lo visual del mapa con coordenadas raras: no lo puedo ver.

## 230. SonarCloud en 0 issues: push de §229, CI #27 / Deploy #20 en verde e informe del TP actualizado

**Qué se hizo:**
- Push de `8e7d9e4` (§229) con el permiso del usuario ("dale").
- **CI #27 en verde**, sus 10 jobs. **Deploy #20 en verde:** hooks de Render, `/health` con el commit nuevo, smoke y E2E. `8e7d9e4` quedó en producción.
- **SonarCloud** (API pública, análisis de `8e7d9e4`): **0 issues abiertas** (las 57 `S7773` en FIXED).
  - code smells 0, deuda 0 min, bugs 0, vulnerabilidades 0, A/A/A;
  - gate "Sonar way" OK;
  - 17.584 líneas, cognitiva 2.854, duplicación 1,9 %;
  - código nuevo: cobertura 92,8 %, duplicación 0,0 %.
- **Informe del TP** (HTML y PDF), con el corte movido a `8e7d9e4` / CI #27 / Deploy #20:
  - carátula: último cambio de código;
  - "En números": 896 tests de frontend, cobertura 93,17 % y 90,38 %, Sonar **157 → 0**, código nuevo 92,8 %, 54 commits (`git rev-list --count 20d881a^..HEAD` antes de este commit, mismo criterio que §226);
  - tabla de metas: pipeline, gate, cobertura nueva y existente;
  - métricas: análisis de `8e7d9e4`, deuda 0 min;
  - sección 4: fila nueva en SonarCloud y en pruebas;
  - pipeline: CI 23 de 25 terminados (92 %), Deploy 14 de 18 (77,8 %);
  - anexo: enlaces al CI #27 y al Deploy #20.
- La cobertura del CI #27 sale del log del run (`gh run view --log`, línea "all files" de cada job), como en §228:

| Job | Líneas | Ramas | Funciones | Sentencias |
|---|---|---|---|---|
| Backend · SQLite · UTC | 93,17 % | 85,31 % | 90,19 % | — |
| Backend · SQLite · Córdoba | 93,21 % | 85,37 % | 90,19 % | — |
| Frontend · UTC y Córdoba | 90,38 % | 81,58 % | 82,45 % | 86,75 % |

- **Corridas que no cuentan en la tasa:**
  - CI #24 y #25, **cancelados** por el push siguiente (`concurrency` del CI);
  - Deploy #17 y #18, **salteados**: los dispararon esos CI cancelados (5 s después de cada push nuevo), y el job solo corre con un CI en verde.
  - Mismo criterio que en §226, donde todavía no había ninguno.
- `TRIAGE_SONAR.md` y `METRICAS.md` con el resultado.

### Verificación
- Cada número del informe se tomó de la fuente en el momento:
  - `gh run view` del CI #27 y el Deploy #20 (jobs y pasos);
  - `gh run list` por workflow para los conteos;
  - la API de SonarCloud: `issues/search`, `measures/component`, `qualitygates/project_status` y `project_analyses`.
- Los 18 reemplazos del HTML se hicieron con un script que exige exactamente una aparición de cada texto.
- PDF regenerado con Chrome headless: **9 páginas**, como antes.

### Errores propios
- En el primer borrador del informe atribuí los Deploy salteados a "un push reemplazado". Al mirar los tiempos y el `if` del workflow vi que los dispararon los CI cancelados. Lo corregí antes del commit.

### ⚠️ NO verificado
- **El aspecto del PDF:** no pude renderizar las páginas (falta `pdftoppm`). Solo sé que siguen siendo 9. Conviene mirar las tablas de la sección 4, que tienen una fila más cada una.
- La densidad de pruebas (75,9 tests/KLOC en el frontend, CI #19) no se recalculó con los 896 tests.

## 231. SonarCloud S8786: los 6 regex con backtracking, reescritos lineales y con la misma respuesta

**Contexto:** el usuario preguntó por las 14 issues **aceptadas** de SonarCloud (§204), que no cuentan como abiertas. Se revisaron una por una y propuse arreglar en el código 10 de ellas; el usuario dijo "dale". Van en cuatro commits: §231 (regex), §232 (topes de subida), §233 (un test) y §234 (fondo del modal). Quedan aceptadas 4, que se explican en `TRIAGE_SONAR.md`.

**Qué se hizo:** los 6 `S8786` (en §201 se había puesto un tope delante de 2 de ellos y se habían aceptado los otros 4) ahora son lineales:
- **email** (`EMAIL_RE` de `routes/auth.js` y de `AuthModal.tsx`; `looksLikeEmail` de `lib/email.js`): el punto del dominio entraba en las dos clases que lo rodeaban (`[^\s@]+\.[^\s@]+`). Ahora se busca **el primer punto después del primer carácter del dominio** (`@[^\s@][^\s@.]*\.`). Hay un punto válido justo cuando ese primero lo es, así que acepta lo mismo. El tope de 254 queda, porque es el máximo de RFC 5321.
- **`hasZone`** (`lib/time.js` y `lib/format.ts`; ahora es una función exportada): `/T.*(zona)$/i` pasa a "hay una T en la última línea" + `/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i`. La zona no contiene ninguna T, y el `.` viejo no cruzaba saltos de línea (`\n`, `\r`, ` `, ` `), por eso se mira solo la última línea.
- **`truncateText`** (`format.ts`): `/\s+$/` → `trimEnd()`. Según la especificación, los dos usan el mismo conjunto de espacios y saltos de línea.

**Tests primero** (`backend/test/unit/regexLineales.test.js`, 7, y `frontend/src/lib/regexLineales.test.ts`, 7):
- Primero se exportaron las funciones **viejas**, sin cambiarlas, y se escribieron los tests contra ellas: las comparaciones pasaron y los tiempos fallaron (3,1–3,3 s en el backend; 2,4–3,3 s en el frontend). Fue un rojo real, no un "el módulo no existe".
- **Equivalencia contra un oráculo:** el regex viejo vive en el test y se compara con la versión nueva en **todas** las cadenas cortas de un alfabeto armado con los caracteres que importan: más de 1,9 millones para `hasZone` (11 letras, hasta 6 caracteres), 488 mil para `looksLikeEmail`, 349 mil para `EMAIL_RE`, y los 16 espacios de `\s` para `trimEnd`.
- **Tiempo:** entradas de 50 mil caracteres armadas para el peor caso, que tienen que tardar menos de 100 ms (antes, 2,3–4,3 s). El de `EMAIL_RE` va **sin** pasar por el tope de 254.

### Verificación
- Unitarios de los archivos tocados (`time`, `email`, `validators`, `format`, `AuthModal`) en verde.
- **Mutación**, con corrida de control verde en cada archivo: **49 mutantes, 0 sobrevivientes**. Entre ellos están:
  - sacar la T, la `i`, el split o cada separador de línea;
  - `.pop()` → `.shift()`, `:?` → `:`, `\d{2}` → `\d{1,2}`, sin `$`, sin `Z`;
  - `trimEnd` → `trim` o nada;
  - en los emails: sin el primer carácter del dominio, `*` → `+`, punto opcional, sin anclas, `{2,}` → `+`, y **volver a la clase vieja**, que solo se detecta por tiempo.
- Las suites completas se corrieron con los cuatro commits juntos (§234).

### Errores propios
- **El Edit y el Write convirtieron los escapes ` `/` ` en los caracteres literales.** Dentro de un regex literal eso es un salto de línea, y `time.js` no compilaba (lo marcó la primera corrida). Con un script se volvieron a escribir como escapes, y se revisó que no quedaran espacios invisibles en los archivos tocados.
- Un primer script de reemplazo perdió las barras de los regex por el heredoc. Se cortó antes de escribir nada y se pasó a Edit.
- Puse `hasZone` entre el JSDoc de `toMillis` y la función. Lo corregí antes del commit.
- En el test de `trimEnd`, el primer armado hacía que `truncateText` retrocediera hasta la última palabra. Lo corregí antes de correrlo.

### ⚠️ NO verificado
- Que SonarCloud dé por cerradas estas 6 issues aceptadas: se ve en el análisis después del push.

## 232. SonarCloud S5693: el tope de subida pasa de 8 MiB a 8.000.000 bytes (servidor y frontend)

**Qué se hizo:** los 2 `S5693` aceptados en §204 ("el límite existe y es chico") tenían una causa concreta. Según la API de SonarCloud (`rules/show`), el parámetro `fileUploadSizeLimit` de la regla vale **8.000.000** bytes por defecto, y el tope era `8 * 1024 * 1024` = 8.388.608.
- `PHOTO_MAX_BYTES` (`routes/auth.js`, foto de perfil) y `MAX_FILE_BYTES` (`routes/posts.js`, Momentos) → `8_000_000`. Los mensajes siguen diciendo "8 MB", que ahora es exacto.
- **También el frontend:** `MAX_UPLOAD_BYTES` (`lib/imageCompress.ts`) dice "mismo tope que el servidor". Si se bajaba solo el backend, una foto comprimida de entre 7,63 y 8 MiB pasaba el control del navegador y el servidor la rechazaba con 413.
- `API_CONTEXT.md` y `FRONTEND_CONTEXT.md` con el número exacto.

**Tests primero** (rojo con el tope viejo: 201 y 200 donde se esperaba 413; y `8388608` contra `8000000`):
- `posts.test.js`: 8.000.001 bytes → 413; 8.000.000 justos → 201. Este último lo publica Juan, porque María ya está cerca del límite de 10 publicaciones por hora del archivo.
- `profile-photo.test.js`: 8.000.001 → 413 y 8.000.000 → 200.
- `imageCompress.test.ts`: la constante vale 8.000.000.

### Verificación
- **Mutación** (`7_999_999`, `8_000_001` y el valor viejo, en los tres archivos), con control verde: **9 mutantes, 0 sobrevivientes**. En la primera corrida sobrevivió `7_999_999` en `posts.js`: ningún test subía una foto de 8.000.000 justos a Momentos. Agregué ese test y murió.
- Las suites completas se corrieron con los cuatro commits juntos (§234).

### Errores propios
- Mi propuesta al usuario decía "creo que Sonar marca todo lo que pase de 8.000.000". Lo confirmé con la API antes de cambiar nada.

### ⚠️ NO verificado
- Una subida real desde el celular con una foto cerca del tope (prod usa Cloudinary; los tests usan un doble).
- Que SonarCloud cierre las 2 issues: se ve después del push.

## 233. SonarCloud S8985: el clic del test del mapa sale del `waitFor`

**Qué se hizo:** en `ModalsMigrated.test.tsx`, el test "el detalle de un proyecto elegido se cierra con 'Cerrar detalle'" hacía `fireEvent.click` **dentro** del `waitFor`, así que el clic se repetía en cada intento. En §204 se había aceptado porque Leaflet recrea los marcadores después del primer render. Ahora:
1. el `waitFor` solo espera a que haya un pin y lo devuelve;
2. el clic va afuera;
3. después se espera el botón con `findByRole`.

**Hueco que tenía el test (viejo y nuevo):** en el mapa ampliado solo verificaba que el botón "Cerrar detalle" **existiera**. Dejar sin efecto ese botón no rompía nada: lo comprobé con un mutante contra las dos versiones del test, y sobrevivía en ambas. Ahora además lo toca y verifica que se cierre.

### Verificación
- El test pasó 5 de 5 seguidas aislado y 3 de 3 con el archivo entero. Ninguna corrida falló.
- Mutantes a mano en `ProjectMap.tsx` (los dos botones "Cerrar detalle" sin efecto): **2 muertos**, contando el del ampliado, que antes sobrevivía.

### Errores propios
- Ninguno.

### ⚠️ NO verificado
- Que no sea inestable en el CI: 8 corridas locales no lo garantizan.

## 234. SonarCloud S6848: el fondo del `Modal` es `role="presentation"`; verificación de §231–§234

**Qué se hizo:** el fondo oscuro de `Modal.tsx` cierra con un clic. En §204 se había aceptado porque con teclado cierran Escape y el botón de adentro, y el foco queda atrapado en el diálogo. Ahora el fondo lleva `role="presentation"`, que dice justamente eso: es un atajo del mouse sin papel para los lectores de pantalla. El diálogo y su contenido siguen expuestos igual.
- Test primero en `Modal.test.tsx` (rojo sin el atributo): el fondo tiene `role="presentation"`, y el diálogo y el botón de adentro se siguen encontrando por rol.

**Quedan aceptadas 4** (`TRIAGE_SONAR.md`):
- el `S5145` de `donaciones.js`, que ya pasa por `forLog()`;
- `S8475` (localStorage) y `S8480` (token en la URL del WebSocket), de análisis de flujo;
- `S6845` del carrusel, porque sacar el `tabIndex` cambia cómo se usa con teclado.

### Verificación (los cuatro cambios juntos, §231–§234)
- Backend: `npm test` **907/907** en SQLite y con `TZ=America/Argentina/Cordoba`; `npm run test:pg` **909/909** (Postgres 16 en Docker). 0 fail, 0 cancelled. Son 10 tests más: 7 de regex y 3 de topes.
- Frontend: `npm test` **904/904** (8 más: 7 de regex y 1 del modal); `npm run typecheck` sin errores.
- Scripts del CI: 38/38.
- Finales de línea: cada archivo tocado conserva los suyos (CRLF o LF), contados con Node.

### Errores propios
- Ninguno en este cambio.

### ⚠️ NO verificado
- **Lo visual y táctil del modal:** el atributo no cambia estilos, pero no lo puedo ver.
- **Que SonarCloud reconozca `role="presentation"` como arreglo de `S6848`:** la regla de jsx-a11y en la que se basa ignora los elementos con ese rol, pero lo confirma el análisis después del push.

## 235. SonarCloud: las 10 aceptadas de §231–§234 quedan cerradas; push, CI #29 y Deploy #22 en verde

**Qué se hizo:** push de `58532ba..d7efe16`.
- **CI #29 en verde** y **Deploy #22 en verde** (hooks de Render, smoke y E2E): el código de §231–§234 está en producción.
- **SonarCloud** (API pública, análisis de `d7efe16`):
  - aceptadas **14 → 4**; las 10 de §231–§234 pasaron a FIXED;
  - **0 abiertas**; bugs, vulnerabilidades, code smells y hotspots en 0; deuda 0 min; A/A/A; gate "Sonar way" OK;
  - código nuevo: cobertura 93,0 %; 17.594 líneas; cognitiva 2.856.
- `TRIAGE_SONAR.md` con la tabla de las 10 y las 4 que siguen aceptadas.

### Verificación
- `gh run watch` de las dos corridas y `gh run list` para los resultados.
- API de SonarCloud: `issues/search` (`issueStatuses=ACCEPTED` y abiertas), `measures/component`, `qualitygates/project_status` y `project_analyses`.

### Errores propios
- **Commiteé y pusheé `TRIAGE_SONAR.md` roto** (`8c6033d`). Escribí la sección con `node -e "..."` y los backticks del Markdown quedaron entre comillas dobles: bash los ejecutó como comandos y se perdieron todos los fragmentos de código (los nombres de las reglas, `d7efe16`, `forLog()`). No revisé el diff antes de commitear. Se corrigió con Edit en el commit siguiente. `PROJECT_ANALYSIS.md` estaba bien porque iba por heredoc con comillas simples. Para no repetirlo: nada de Markdown con backticks dentro de `node -e` con comillas dobles, y siempre mirar `git diff --cached` antes del commit.

### ⚠️ NO verificado
- **El informe del TP no se actualizó:** su corte sigue en `8e7d9e4` / CI #27 (§230). Los números de SonarCloud que muestra no cambian (0 issues abiertas), pero sí los tests (907/909/904) y las 14 aceptadas, que ahora son 4.

## 236. Informe del TP: corte en `d7efe16` (CI #29 / Deploy #22), aceptadas 14 → 4

**Qué se hizo:** el usuario pidió actualizar el informe después de §231–§235. Movimos el corte a `d7efe16`, con 18 reemplazos de texto exacto (un script exige una sola aparición de cada uno):
- carátula: último cambio de código;
- "En números": 907/909/904, cobertura 93,22 % y 90,42 %, **aceptadas 14 → 4**, código nuevo 93,0 %, 61 commits (`git rev-list --count 20d881a^..HEAD` antes de este commit, como en §226 y §230);
- tabla de metas: pipeline, gate, cobertura nueva y existente (backend 93,22/85,40/90,21; frontend 90,42/86,79/81,57/82,66);
- métricas: análisis de `d7efe16` (17.594 líneas, ciclomática 4.245, cognitiva 2.856) y la tasa del pipeline;
- sección 4: una fila nueva en SonarCloud y otra en pruebas;
- pipeline: **CI 25 de 27 terminados (92,6 %)**, con #24, #25 y #30 cancelados; **Deploy 16 de 20 (80 %)**, con #17, #18 y #23 salteados porque los dispararon CI cancelados;
- anexo: CI #29 y Deploy #22.
- PDF regenerado: 9 páginas.

**Fuente de cada número:**
- cobertura y tests: log del CI #29 (`gh run view --log`, líneas "all files" y conteos de cada job), con los valores del job en UTC;
- corridas: `gh run list` por workflow;
- SonarCloud: API pública (§235).

### Verificación
- Los reemplazos se aplicaron sin error. Las únicas menciones que quedan de `8e7d9e4` y del CI #27 son filas del historial.

### Errores propios
- **En §230 no actualicé las tasas del párrafo de métricas** ("CI 91,3 %, Deploy 75 %", del corte del CI #23), aunque sí las de la tabla del pipeline. El informe quedó con dos tasas distintas. Lo encontré ahora al buscar los números viejos y quedó corregido (92,6 % y 80 %).

### ⚠️ NO verificado
- **El aspecto del PDF:** no puedo renderizar las páginas (falta `pdftoppm`). Solo sé que siguen siendo 9. Las tablas de la sección 4 tienen otra fila más cada una.
- **El CI #31** (`c574c5c`, solo documentación) estaba corriendo al cerrar el corte, por eso no entra en la tasa.
- La densidad de pruebas (CI #19) sigue sin recalcularse.

## 237. Informe del TP: sección nueva "4. Validaciones de entrada: el código y sus pruebas"

**Qué se hizo:** el usuario pidió poner en el informe las validaciones con su código. Se agregó la sección 4 a `docs/calidad/informe/INFORME_TP_CALIDAD.html`, con siete validaciones. Para cada una: archivo y línea, la regla, el fragmento de código actual (`d7efe16`, sin cambios; solo se sacaron comentarios) y los tests que la prueban:
1. monto de la donación (`donaciones.js:43`, con el espejo del frontend en `lib/donations.ts`);
2. contraseña, 8 caracteres y 72 bytes (`auth.js:55`; `AuthModal.tsx:32`);
3. email con tope de 254 antes del regex, por el ReDoS de §201 (`auth.js:37–49`);
4. palabras no permitidas por palabra completa, B7 (`badWords.js:13`);
5. cabecera real de imágenes y PDF (`storage.js:76` y `:166`) y su uso en las rutas de subida;
6. acceso al CV, permiso antes que existencia (`voluntarios.js:204`);
7. `checkText` y `toStrictInt` (`inputs.js:13` y `:37`).

Las secciones siguientes pasan de 4–7 a 5–8 (índice, títulos y la referencia "la sección 4" de 3.4). Se agregó el estilo `pre` para los fragmentos. PDF regenerado con Chrome headless: **12 páginas** (antes 9).

### Verificación
- Los 18 archivos de test citados, corridos juntos (SQLite, 19/10/2026): **278 tests, 278 en verde**. Ese número es el que figura en el informe.
- Cada fragmento se copió del código actual y las líneas citadas se confirmaron con `grep -n`.
- Cada afirmación sobre un test se comparó con el nombre del test en su archivo.

### Errores propios
- En el primer borrador cité `register-input-validation.test.js` como prueba del email, pero prueba el **apellido**. También describí mal el test de la foto ("un texto con `Content-Type: image/png`"): el test real es "dice ser JPEG pero la cabecera no es de imagen". Los dos se corrigieron antes del commit, al revisar los nombres de los tests.
- La primera corrida tenía 14 archivos (208 tests) y no incluía `regexLineales`, `profiles-`, `projects-` ni `kpis-input-validation`, que el texto sí citaba. Se volvió a correr con los 18.

### ⚠️ NO verificado
- **El aspecto del PDF:** no puedo renderizar las páginas (falta `pdftoppm`). Solo sé que tiene 12. Conviene revisar que los bloques de código no queden cortados entre páginas y que no haya páginas casi vacías (cada validación tiene `break-inside: avoid`).
- Los tests citados no se corrieron en Postgres ni con `TZ=America/Argentina/Cordoba` en esta sesión: no se tocó código, y corren en los 4 jobs del CI.

## 238. Informe del TP: los temas de la materia uno por uno; transición de estados de la inscripción (test nuevo), caminos básicos, caso de uso, acoplamiento

**Qué se hizo:** el usuario pasó el programa de la materia: "si me preguntan test de caja negra, no aparece textual". Se buscaron los términos del programa en el informe y en `docs/calidad/`. Faltaban, entre otros: caja negra y blanca, transición de estados, casos de uso, error/defecto/fallo, verificación vs validación, implantación, humo, exploratorias, calidad interna/externa/en uso, ciclo de vida del defecto, estimación, postcondiciones, acoplamiento, Postman, JIRA/Selenium/JMeter y TCO.
- **Informe:** sección nueva **"4. Los temas de la materia, uno por uno"**, con los seis bloques del programa con sus nombres literales, cada tema con su evidencia y las brechas dichas. Las secciones siguientes pasan a 5–9. Análisis crítico: el test de tiempo inestable y el punto ciego del piso del cupo. Trabajo futuro: calidad en uso, exploratorias, E2E de interfaz. PDF: **17 páginas**.
- **Test nuevo** `backend/test/integration/enrollments-state-transitions.test.js` (23 tests). Recorre la tabla de transición de estados de la inscripción: 4 estados × 6 eventos, transiciones inválidas (`pending` y `cancelled` → 400 sin cambios), la guarda [hay cupo], volver a inscribirse después de cancelar, 404 desde SIN inscripción y cancelar la de otra persona.
- **`DISENO_CASOS.md`:**
  - §5: transición de estados, con diagrama, tabla y mutantes;
  - §6: caminos básicos de `amountError`, V(G) = 5;
  - §7: el caso de uso "Donar a un proyecto", con el flujo principal y 10 alternativos, cada uno con su test.
- **`PLAN_PRUEBAS.md` v1.0:** la plantilla de caso suma datos de prueba y postcondiciones, con un caso completo de ejemplo (`CP-INS-11`), y el ciclo de vida del defecto contra lo que pasó de verdad.
- **`METRICAS.md` §1.4:** acoplamiento (Ce, Ca, I) medido con un script del scratchpad (no quedó en el repo):
  - backend: 33 módulos y 101 dependencias; el de mayor Ca es `db/index.js`, con 15;
  - frontend: 69 módulos y 245 dependencias; el de mayor Ca es `lib/api.ts`, con 49.
- `CLAUDE.md`: conteos 930/932 y aviso del test de tiempo.

### Verificación
- **Test nuevo:**
  - pasó entero de entrada (23/23), porque el código ya existía: es una prueba de caracterización y su rojo lo dan los mutantes;
  - **mutación** sobre `routes/enrollments.js`, con la corrida de control en verde antes: **12 mutantes, 9 muertos**;
  - sobreviven 3: "sin el atajo idempotente" (lo mata `enrollments-concurrency.test.js`, 3 fallas: duplica la notificación, que la tabla no mira); "aprobar suma cupo aunque ya estuviera aprobada" (**equivalente**: el atajo idempotente ya cortó); "inscribirse dos veces sin el chequeo previo" (**equivalente**: `UNIQUE(user_id, project_id)` da el mismo 409 con el mismo mensaje).
- **Suites del backend:**
  - SQLite: **930/930** (907 + 23) en 2 de 3 corridas; la tercera, 929 con 1 falla en `email-redos.test.js` (abajo);
  - `TZ=America/Argentina/Cordoba`: **930/930**;
  - Postgres 16 (Docker): **932/932**, código de salida 0.
- **`email-redos.test.js` inestable, sin relación con este cambio:** se sacó el archivo nuevo y se corrió la suite 5 veces → **907 con 2 fallas en 5 corridas**, las dos en ese test ("el pedido con el email gigante tardó 700 ms" y "538 ms"; umbral 500).
- Antes de escribir cada afirmación se revisaron los nombres de los tests citados en el caso de uso, los valores de los caminos básicos en `donation-amount.test.js`, las dependencias entre rutas (`grep`) y las fechas de los commits (`git log`).
- Términos del programa en el HTML: todos aparecen al menos una vez (`grep -i`).

### Errores propios
- **El primer diseño del test de transiciones tenía un punto ciego.** Los proyectos empezaban con el cupo en 0 y `RELEASE_SLOT_SQL` tiene piso en 0. Por eso "cancelar una pendiente resta un cupo" iba a sobrevivir. Lo vi al armar la lista de mutantes, antes de correrlos, y el test pasó a arrancar con otra persona aprobada.
- **En el borrador de la sección 4 puse números sin respaldo**, que se corrigieron antes del commit:
  - "la mayoría de los ~1.800 tests en la base de la pirámide": en realidad son 906 de backend contra 904 de frontend, así que la base no es más ancha que el medio, y el informe ahora lo dice;
  - "82 archivos de componentes": incluyen tests de `lib/`;
  - "4 runs hasta el primer verde" en la prueba de concepto: es CI #4 → #5;
  - "SonarCloud encontró en un día 39 bugs": es "el primer análisis marcó 39".
- En `METRICAS.md` escribí primero que ninguna ruta dependía de otra salvo `fmt`. El `grep` mostró 4 dependencias: también `fmtNgo` y `validateEmail`.
- **El primer script de acoplamiento salió con 0 dependencias.** Bash se comió las barras invertidas del regex del heredoc (el mismo problema de §235). Se reescribió con Write.

### ⚠️ NO verificado
- **El aspecto del PDF** (17 páginas): no puedo renderizarlo. Conviene revisar las tablas largas de la sección 4 y los bloques de código.
- **El CI con el test nuevo:** no se pusheó. Los 23 tests se corrieron solo en local (Windows). El informe lo aclara en la fila de transición de estados.
- **La estimación "real":** la hora de un commit no es esfuerzo medido. Que T0–T13 se cerraran el 17/10 sale del `git log`, no de un registro de horas.
- **El acoplamiento** cuenta solo imports relativos estáticos y los `import()` con texto literal. No es una herramienta estándar y no se comparó con ninguna.
- `email-redos.test.js` no se tocó (regla 16): queda para decidir si se sube el umbral o se corre aislado.
