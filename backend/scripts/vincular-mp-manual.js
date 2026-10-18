// scripts/vincular-mp-manual.js
//
// Plan B del Marketplace (PROJECT_ANALYSIS.md §215–§216): vincular a una ONG con su vendedor de PRUEBA de Mercado Pago
// SIN OAuth, cargando a mano el access token de ese vendedor. Existe porque el intercambio OAuth necesita el
// client_secret de la aplicación, que solo aparece al activar las credenciales productivas.
//
// Uso (el token va por variable de entorno, no por argumento, para que no quede en el historial de la terminal):
//   MP_MANUAL_SELLER_TOKEN=<access token del vendedor de prueba> node scripts/vincular-mp-manual.js <ngo_id>
// Necesita MP_TOKEN_KEY y la base del .env (DATABASE_URL en producción). El token se guarda cifrado, con origen
// 'manual', sin refresh token ni vencimiento: si Mercado Pago lo deja de aceptar, se vuelve a correr el script.
//
// Solo acepta USUARIOS DE PRUEBA: el usuario del token tiene que traer el tag `test_user` (NO verificado contra
// Mercado Pago; si un vendedor de prueba real no lo trae, el script se niega y hay que revisarlo).

require('dotenv').config();
const db = require('../src/db');
const payments = require('../src/lib/payments');
const sellerAccounts = require('../src/lib/sellerAccounts');

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

if (require.main === module) {
  const ngoId = process.argv[2];
  linkManually({ ngoId, accessToken: process.env.MP_MANUAL_SELLER_TOKEN })
    .then((r) => { console.log(`✅ ${r.ngoName} quedó vinculada a la cuenta de prueba ${r.mpUserId}${r.nickname ? ` (${r.nickname})` : ''}`); process.exit(0); })
    .catch((err) => { console.error(`❌ ${err.message}`); process.exit(1); });
}

module.exports = { linkManually };
