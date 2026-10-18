// scripts/vincular-mp-manual.js
//
// Plan B del Marketplace (PROJECT_ANALYSIS.md §215–§216): vincular a una ONG con su vendedor de PRUEBA de Mercado Pago
// SIN OAuth, cargando a mano el access token de ese vendedor. Existe porque el intercambio OAuth necesita el
// client_secret de la aplicación, que solo aparece al activar las credenciales productivas.
//
// Uso (el token va por variable de entorno, no por argumento, para que no quede en el historial de la terminal):
//   MP_MANUAL_SELLER_TOKEN=<access token del vendedor de prueba> node scripts/vincular-mp-manual.js <ngo_id>
//   MP_MANUAL_SELLER_TOKEN=<…> node scripts/vincular-mp-manual.js --solo-ver   → de quién es el token, sin guardar (§221)
// Necesita MP_TOKEN_KEY y la base del .env (DATABASE_URL en producción). El token se guarda cifrado, con origen
// 'manual', sin refresh token ni vencimiento: si Mercado Pago lo deja de aceptar, se vuelve a correr el script.
//
// Solo acepta USUARIOS DE PRUEBA: el usuario del token tiene que traer el tag `test_user` (NO verificado contra
// Mercado Pago; si un vendedor de prueba real no lo trae, el script se niega y hay que revisarlo).

require('dotenv').config();
const db = require('../src/db');
const payments = require('../src/lib/payments');
const sellerAccounts = require('../src/lib/sellerAccounts');
const { forLog } = require('../src/lib/logSafe');   // S5145 (§225): lo que manda Mercado Pago no entra crudo

// --solo-ver (§221): de quién es el token, sin guardar nada. El token de prueba del panel de la aplicación puede ser
// de una cuenta oculta de Mercado Pago (§181) y no del vendedor de la ONG: hay que verlo antes de vincular.
async function inspectToken({ accessToken, getUser = (t) => payments.getSellerUser(t) }) {
  const token = typeof accessToken === 'string' ? accessToken.trim() : '';
  if (!token) throw new Error('Falta el token del vendedor (MP_MANUAL_SELLER_TOKEN)');
  const user = await getUser(token);
  const tags = Array.isArray(user?.tags) ? user.tags : [];
  return { mpUserId: String(user.id), nickname: user.nickname ?? null, tags, isTestUser: tags.includes('test_user') };
}

async function linkManually({ ngoId, accessToken, getUser = (t) => payments.getSellerUser(t) }) {
  const token = typeof accessToken === 'string' ? accessToken.trim() : '';
  if (!token) throw new Error('Falta el token del vendedor (MP_MANUAL_SELLER_TOKEN)');
  const ngo = await db.get('SELECT id, nombre FROM ngos WHERE id=$1', [ngoId]);
  if (!ngo) throw new Error(`No existe la ONG ${ngoId}`);
  const user = await getUser(token);
  if (!Array.isArray(user?.tags) || !user.tags.includes('test_user')) {
    throw new Error('El token no es de un usuario de prueba de Mercado Pago: solo se aceptan cuentas de prueba');
  }
  const saved = await sellerAccounts.saveAccount(ngo.id, { accessToken: token, mpUserId: String(user.id) }, 'manual');
  if (saved.conflict) throw new Error('Esa cuenta de Mercado Pago ya está vinculada a otra ONG');
  return { ngoName: ngo.nombre, mpUserId: String(user.id), nickname: user.nickname ?? null };
}

// Los mensajes de la terminal, con todo lo externo por forLog (§225).
function describeInspection(r) {
  const tags = r.tags.map((t) => forLog(t, 40)).join(', ') || '(ninguno)';
  return [
    `Cuenta de Mercado Pago ${forLog(r.mpUserId, 40)}${r.nickname ? ` (${forLog(r.nickname, 80)})` : ''}; tags: ${tags}`,
    r.isTestUser ? 'Es un usuario de prueba: se puede vincular.' : 'NO trae el tag test_user: el script no la va a vincular.',
  ];
}
const describeLinked = (r) =>
  `✅ ${forLog(r.ngoName, 120)} quedó vinculada a la cuenta de prueba ${forLog(r.mpUserId, 40)}${r.nickname ? ` (${forLog(r.nickname, 80)})` : ''}`;

if (require.main === module && process.argv.includes('--solo-ver')) {
  inspectToken({ accessToken: process.env.MP_MANUAL_SELLER_TOKEN })
    .then((r) => {
      for (const line of describeInspection(r)) console.log(line);
      process.exit(0);
    })
    .catch((err) => { console.error(`❌ ${forLog(err.message)}`); process.exit(1); });
} else if (require.main === module) {
  const ngoId = process.argv[2];
  linkManually({ ngoId, accessToken: process.env.MP_MANUAL_SELLER_TOKEN })
    .then((r) => { console.log(describeLinked(r)); process.exit(0); })
    .catch((err) => { console.error(`❌ ${forLog(err.message)}`); process.exit(1); });
}

module.exports = { linkManually, inspectToken, describeInspection, describeLinked };
