// src/lib/badWords.test.ts — mismo criterio que backend/src/lib/badWords.js (REVISION B7): palabras completas.
// La igualdad de las dos listas la controla backend/test/unit/badWords.test.js.
import { describe, test, expect } from 'vitest';
import { hasBadWord } from './badWords';

describe('hasBadWord (frontend)', () => {
  test('palabras legítimas que contienen una de la lista no se rechazan', () => {
    for (const t of ['Traigan la computadora', 'Hubo una disputa', 'la reputación', 'un diputado', 'imbecilidad']) {
      expect(hasBadWord(t), t).toBe(false);
    }
  });

  test('la palabra sola sí, con mayúsculas, acentos o signos', () => {
    for (const t of ['sos un boludo', 'BOLUDO!', 'qué imbécil', '...tarado...']) {
      expect(hasBadWord(t), t).toBe(true);
    }
  });

  test('texto vacío no rompe', () => {
    expect(hasBadWord('')).toBe(false);
  });
});
