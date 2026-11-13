// @vitest-environment node
// Tanda T6 de la revisión contra DESIGN.md (§330, hallazgo B10): reglas chicas que se pueden mirar en el código.
//  - El corazón es el "me gusta" y nada más: era también el ícono de Mercado Pago en el menú de la ONG y el del
//    rol ONG en el registro.
//  - "Sin textos en mayúsculas completas": el certificado tenía un rótulo con `uppercase`.
//  - Sin emojis en la interfaz (los íconos son de lucide): el paso "Revisar" de crear un voluntariado tenía dos.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));
const sources = (readdirSync(APP, { recursive: true }) as string[])
  .filter(rel => /\.tsx?$/.test(rel) && !rel.includes('.test.'))
  .map(rel => ({ rel: rel.replace(/\\/g, '/'), src: readFileSync(join(APP, rel), 'utf8') }));

const matching = (re: RegExp) => sources.filter(f => re.test(f.src)).map(f => f.rel);

describe('reglas chicas del diseño', () => {
  test('lee los archivos de la app', () => {
    expect(sources.length).toBeGreaterThan(80);
  });

  test('el corazón de lucide solo lo usa el "me gusta" de la publicación', () => {
    // `Heart` como nombre importado de lucide-react (no `HeartHandshake` ni otra palabra que lo contenga).
    expect(matching(/import\s*\{[^}]*(?<![\w])Heart(?![\w])[^}]*\}\s*from\s*'lucide-react'/)).toEqual(['components/PostCard.tsx']);
  });

  test('ningún texto en mayúsculas completas (clase uppercase)', () => {
    expect(matching(/(?<![\w:-])uppercase(?![\w-])/)).toEqual([]);
  });

  test('ningún emoji en la interfaz', () => {
    expect(matching(/\p{Emoji_Presentation}/u)).toEqual([]);
  });

  test('la detección de emojis ve los que había y deja pasar los signos de texto', () => {
    expect(/\p{Emoji_Presentation}/u.test('💻 Remoto')).toBe(true);
    expect(/\p{Emoji_Presentation}/u.test('🌐 Híbrido')).toBe(true);
    expect(/\p{Emoji_Presentation}/u.test('★ 4,5 · $ 8.500 — ✓ ¿Listo? 1.º')).toBe(false);
  });
});
