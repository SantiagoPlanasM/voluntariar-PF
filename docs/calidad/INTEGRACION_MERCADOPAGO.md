# INTEGRACION_MERCADOPAGO.md — La integración externa: donaciones con Mercado Pago

> TP de Calidad, entregable "documentación de la integración externa" y meta del nivel 3 "flujo E2E automatizado en
> cada despliegue". Código: `backend/src/lib/payments.js` y `backend/src/routes/donaciones.js`. Historia técnica:
> `PROJECT_ANALYSIS.md §169–§176` (construcción y verificación en producción) y `§193–§196` (E2E en el pipeline).

## 1. Qué es y por qué es crítica

Un voluntario o una empresa dona a un proyecto. VoluntariAR crea una **preferencia de Checkout Pro** en Mercado Pago, el
donante paga en la página de Mercado Pago y vuelve. VoluntariAR **consulta el pago a Mercado Pago** y, si está aprobado,
acredita la donación y suma lo recaudado del proyecto. Es la única integración que mueve plata (en **modo prueba**:
credenciales de prueba, sin dinero real).

## 2. Contrato (lo que se usa de la API de Mercado Pago)

Fuente: el código del SDK oficial de Node `mercadopago@3.6.1`, verificado el 2026-10-16 (la documentación web carga esas
partes con JavaScript). Se habla por REST con `fetch`, **sin el SDK** (regla 18).

| Operación | Llamada | Qué se manda / qué se usa |
|---|---|---|
| Crear la preferencia | `POST https://api.mercadopago.com/checkout/preferences` | `items` (el proyecto, cantidad 1, monto en ARS), `external_reference` = id de la donación, `back_urls` → `/donaciones/vuelta`, `auto_return: approved`. Cabecera `X-Idempotency-Key` = id de la donación (reintentar no crea dos). Respuesta: `id` y `init_point` (el link del checkout) |
| Consultar un pago | `GET https://api.mercadopago.com/v1/payments/:id` | `status`, `external_reference`, `transaction_amount`, `currency_id`. **Es la única fuente de verdad** sobre si se pagó: nunca el aviso ni la URL de vuelta |
| Aviso (webhook) | `POST /api/donaciones/webhook` (lo llama Mercado Pago) | Firma `x-signature: ts=<ts>,v1=<hash>`, con `hash = HMAC-SHA256(secreto, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")`, comparada en tiempo constante |

**Endpoints propios:**
- `POST /api/donaciones` (voluntario o empresa; monto entero entre $100 y $500.000) → `201 { donation_id, checkout_url }`;
- `GET /api/donaciones/:id[?payment_id=…]` → estado. Con `payment_id`, **concilia**: consulta el pago y aplica `applyPayment`;
- `POST /api/donaciones/webhook` → aplica el pago si la firma vale.

**`applyPayment` (acreditar una sola vez):** dentro de una transacción, `UPDATE … SET estado='completada' WHERE id=$2 AND estado='pendiente'` (*compare-and-swap*) y, solo si cambió una fila, `recaudado = recaudado + monto`. Un aviso repetido, o cinco a la vez, acreditan **una sola vez**: probado contra Postgres con conexiones en paralelo. Si el monto o la moneda no coinciden con la donación, no acredita (`amount_mismatch`). Un pago rechazado no marca la donación como fallida, porque Mercado Pago deja reintentar con la misma preferencia.

### 2.1 Marketplace: cada ONG cobra en su cuenta (§215–§225)

- **Cómo funciona:** cada ONG vincula su cuenta de vendedor de Mercado Pago, y la preferencia de una donación se crea **con el token de la ONG dueña del proyecto**, así la plata se acredita en su cuenta. Es sin comisión: no se manda `marketplace_fee`. **Una ONG sin cuenta vinculada no recibe donaciones** (409, el botón "Donar" no aparece y el panel muestra un cartel).
- **Cómo se guardan los tokens:**
  - cifrados con AES-256-GCM (`MP_TOKEN_KEY`), con el id de la ONG como dato asociado;
  - nunca en logs ni en respuestas: lo controlan `public-columns.test.js` y un test de logs.
- **Vinculación por OAuth** (`POST /oauth/token` con `client_id`, `client_secret` y `test_token: true`):
  - el `state` se guarda hasheado y sirve una sola vez;
  - se rechaza cualquier token con `live_mode` distinto de `false`;
  - el token se renueva cuando faltan menos de 7 días, con una sola renovación por ONG y *compare-and-swap* sobre la versión.
- **Carga manual** (`scripts/vincular-mp-manual.js`): guarda el token de un vendedor **de prueba**, porque exige el tag `test_user`. Con `--solo-ver` muestra de quién es el token sin guardar nada.
- **Conciliación y aviso:** consultan el pago con la cuenta que cobró la donación (`cobrador_mp_user_id`). Un pago leído con otra cuenta no acredita (`mismatch`).

## 3. Cómo se prueba (los tres niveles de la tabla de metas)

| Nivel | Qué | Dónde | Cuándo |
|---|---|---|---|
| **1. Contrato y dobles** | `fetch` reemplazado por un doble que verifica **lo que se manda** (URL, cabeceras, cuerpo, idempotencia) y simula respuestas y errores de Mercado Pago; firma del webhook contra vectores calculados como el SDK | `test/unit/payments.test.js` (31 tests), `payments-oauth.test.js` y `tokenCrypto.test.js`, `test/integration/donaciones.test.js`, `donaciones-webhook.test.js`, `donaciones-marketplace.test.js` y `mercadopago-cuenta.test.js`: montos, permisos, 503 sin configurar, 502 si falla MP, conciliación, avisos repetidos y en paralelo, firma inválida, inyección en logs | En cada push (CI, SQLite y Postgres, UTC y Córdoba) |
| **2. Contra el entorno real (a mano)** | Donaciones reales en producción con las credenciales de prueba y el **comprador de prueba**: checkout, pago con tarjeta de prueba, vuelta, acreditación y notificación a la ONG | §173 y §174 (verificado por el usuario 3 veces); con el marketplace, §224: $100 al proyecto "Test", acreditados en la cuenta del vendedor de prueba de la ONG | Antes de la defensa |
| **3. E2E automatizado en cada despliegue** | Login de una cuenta voluntaria dedicada → el proyecto de prueba (`E2E_PROJECT_ID`) existe, está activo y su ONG tiene Mercado Pago vinculado (§220) → `POST /api/donaciones` de $100 contra **producción**, con el token de la ONG, con lo que nuestra API crea la preferencia **en Mercado Pago real** → link https de Mercado Pago con `pref_id` → `GET /api/donaciones/:id` = `pending` | `.github/scripts/post-deploy.js e2e`, en `deploy.yml` | **Después de cada deploy** (primer verde: Deploy #4; automático desde el Deploy #5, §196 y §198) |

## 4. Límites conocidos (contados con honestidad)

- **El E2E no paga.** Para pagar hay que iniciar sesión en Mercado Pago con el comprador de prueba, y la página del checkout **no se puede automatizar desde un script**: CloudFront responde 403 sin navegador, y con un navegador simulado da 200 incluso con un `pref_id` inventado (§194). El pago completo está verificado **a mano** (nivel 2).
- **En modo prueba, los avisos de pagos reales no validan la firma** (la simulación del panel sí, §176). Por eso la acreditación real se hace **por la vuelta**: `GET /donaciones/:id?payment_id=…` consulta el pago a Mercado Pago. La preferencia ya no manda `notification_url` (§175).
- **Las credenciales de prueba del panel actual empiezan con `APP_USR-`**, no con `TEST-` (defecto D16, §173).
- **La vinculación por OAuth no se probó en vivo.** El botón está hecho y probado con dobles, pero necesita el `client_secret`, que solo aparece al activar las credenciales productivas de la aplicación. El usuario decidió no activarlas. La ONG de prueba se vinculó cargando a mano el token de su vendedor de prueba, 3772556008 (§222). Tampoco se probó en vivo la renovación del token: las cuentas manuales no vencen.
- **Cada E2E deja una donación `pendiente`** en la base de producción (no suma a lo recaudado).
- Una donación cuyo comprador cierra la pestaña antes de volver queda pendiente (trabajo futuro: conciliar por `external_reference`).

## 5. Contingencia si Mercado Pago no está disponible

(Detalle en `PLAN_PRUEBAS.md §3`.)
- **Sin `MP_ACCESS_TOKEN`:** `POST /api/donaciones` responde **503** "Las donaciones no están disponibles por el momento".
- **Si Mercado Pago falla o tarda:** corte a los **20 s** (`AbortSignal.timeout`), la donación se marca fallida y se responde **502** "No pudimos iniciar el pago".
- **El resto de la aplicación sigue funcionando.** Un pago ya hecho se concilia después con `GET /api/donaciones/:id`.
- **Detección:** el E2E del pipeline falla en el paso "POST /api/donaciones … crea la preferencia", con el código en el mensaje. En los logs de Render, las líneas `[donaciones]`.
- **En la demo:** si el checkout falla, se muestra una donación ya hecha (lo recaudado y la notificación de la ONG; `GUION_DEFENSA.md §6`).

## 6. Defectos de esta integración (en GitHub Issues)

D12 inyección en logs desde el webhook (#13), D15 chequeo del checkout que no servía (#16), D16 formato `APP_USR-`
(#17), D18 lo recaudado sin meta (#19). Ver `REGISTRO_DEFECTOS.md`.
