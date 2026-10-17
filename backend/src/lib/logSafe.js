// src/lib/logSafe.js — texto seguro para los logs (SonarCloud S5145 "Log injection"; PROJECT_ANALYSIS.md §202).
//
// Lo que se loguea desde afuera (query string, cuerpo, mensajes de error de Cloudinary, Mercado Pago o Resend) puede
// traer saltos de línea ya decodificados: con eso se inventan líneas en los logs de Render ("aviso del pago 999:
// aprobado"). forLog() reemplaza cualquier carácter de control (y los separadores de línea Unicode) por un espacio
// y corta el texto a un largo máximo. Se usa en cada console.* que incluya un valor externo.

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/g;

function forLog(value, max = 300) {
  const text = String(value).replace(CONTROL, ' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

module.exports = { forLog };
