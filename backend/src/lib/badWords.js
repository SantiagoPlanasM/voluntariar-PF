// src/lib/badWords.js — palabras no permitidas en comentarios de proyectos, comentarios de calificaciones
// (PROJECT_ANALYSIS.md §104) y textos de publicaciones.
//
// Criterio (REVISION B7, decisión del usuario; PROJECT_ANALYSIS.md §93): palabras COMPLETAS, sin distinguir
// mayúsculas ni acentos. Antes se comparaba por subcadena y se rechazaban "computadora", "disputa",
// "reputación", "diputado"… Límite conocido: los plurales ("boludos") pasan.
//
// El frontend tiene una copia idéntica en frontend/src/lib/badWords.ts (no comparten módulos);
// test/unit/badWords.test.js exige que las dos listas sean iguales.
const BLACKLIST = ['pelotudo','boludo','idiota','imbecil','mierda','puto','puta','hdp','concha','forro','tarado'];

/** Palabras del texto, en minúsculas y sin acentos ("¡Imbécil!" → ["imbecil"]). */
const words = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/\p{L}+/gu) || [];

const hasBadWord = (t) => words(t).some((w) => BLACKLIST.includes(w));

module.exports = { BLACKLIST, hasBadWord };
