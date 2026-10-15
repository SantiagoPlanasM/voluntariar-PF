// test/unit/badWords.test.js — filtro de palabras no permitidas (REVISION B7, decisión del usuario: palabras
// completas). Antes comparaba por SUBCADENA: rechazaba "computadora" (puta), "disputa", "reputación",
// "diputado"… Ahora compara palabra por palabra, sin distinguir mayúsculas ni acentos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { hasBadWord, BLACKLIST } = require('../../src/lib/badWords');

test('palabras legítimas que contienen una de la lista NO se rechazan', () => {
  for (const t of ['Traigan la computadora', 'Hubo una disputa', 'Cuidemos la reputación del barrio',
    'Vino un diputado', 'Escondidas', 'Lo reputamos', 'imbecilidad']) {
    assert.equal(hasBadWord(t), false, t);
  }
});

test('la palabra sola sí, con mayúsculas, acentos o signos alrededor', () => {
  for (const t of ['sos un boludo', 'BOLUDO!', '¡Idiota!', 'qué imbécil', 'hdp', '...tarado...', 'mierda, che']) {
    assert.equal(hasBadWord(t), true, t);
  }
});

test('las letras con tilde o de otros alfabetos son parte de la palabra (no la cortan en dos)', () => {
  // La ñ se normaliza a n antes de partir en palabras ("putaña" queda "putana", entera). Una letra que no se
  // descompone (ø) muestra por qué se usa p{L} y no [a-z]: con [a-z], "boludoø" se partiría en "boludo" + resto.
  assert.equal(hasBadWord('putaña'), false);
  assert.equal(hasBadWord('boludoø'), false);
  assert.equal(hasBadWord('La araña y el pañuelo'), false);
});

test('textos vacíos o raros no rompen', () => {
  assert.equal(hasBadWord(''), false);
  assert.equal(hasBadWord('   '), false);
  assert.equal(hasBadWord('123 456'), false);
});

test('límites conocidos del criterio de palabra exacta', () => {
  assert.equal(hasBadWord('boludos'), false, 'los plurales pasan');
  // Homónimos: la palabra completa no distingue el insulto del sustantivo ("forro" polar, "concha" de mar).
  assert.equal(hasBadWord('Ponete el forro polar'), true);
});

// Backend y frontend no comparten módulos: cada uno tiene su copia. Este test exige que sean iguales (la lista y
// el criterio), para que el frontend no rechace algo que el backend acepta ni al revés (AI_RULES regla 3).
test('la lista del frontend (src/lib/badWords.ts) es la misma que la del backend', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../frontend/src/lib/badWords.ts'), 'utf8');
  const m = src.match(/BLACKLIST\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'no encontré BLACKLIST en el frontend');
  const front = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(front, BLACKLIST);
});
