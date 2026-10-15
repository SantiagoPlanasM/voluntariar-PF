// src/lib/badWords.ts — palabras no permitidas: copia de backend/src/lib/badWords.js (mismo criterio y misma
// lista; backend/test/unit/badWords.test.js controla que la lista sea igual). REVISION B7, §93: palabras
// COMPLETAS, sin distinguir mayúsculas ni acentos (antes, por subcadena, se rechazaba "computadora").
// La normalización (NFD, sin marcas, minúsculas) es `normalizeText`, compartida con la búsqueda (REVISION S8).
import { normalizeText } from './format';

export const BLACKLIST = ['pelotudo','boludo','idiota','imbecil','mierda','puto','puta','hdp','concha','forro','tarado'];

const words = (t: string) => normalizeText(t).match(/\p{L}+/gu) || [];

export const hasBadWord = (t: string) => words(t).some((w) => BLACKLIST.includes(w));
