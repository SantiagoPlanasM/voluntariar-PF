// @vitest-environment node
// D33 y D34 (Issues #34 y #35, sesión exploratoria 2, §330): el contenido de AppShell es un flex en columna. Una
// página cuya raíz lleva `mx-auto` no se estira: toma el ancho de su contenido. Con un texto que no corta (`truncate`)
// quedaba más ancha que la pantalla: a 375 px, el Panel de impacto de la empresa medía 451 y las propuestas de
// patrocinio de la ONG, 423 (scroll horizontal). Con `w-full` la raíz toma el ancho disponible y `max-w-*` la limita.
// jsdom no calcula anchos: este test mira el código de cada pantalla.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));

// La raíz de cada `return`: el primer elemento después de `return (` o de `return `.
const ROOT = /return\s*\(?\s*<(?:div|main|section)\b[^>]*?className="([^"]*)"/g;

function rootsWithoutWidth(): { found: string[]; seen: number } {
  const found: string[] = [];
  let seen = 0;
  for (const rel of readdirSync(join(APP, 'components')) as string[]) {
    if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
    const src = readFileSync(join(APP, 'components', rel), 'utf8');
    for (const m of src.matchAll(ROOT)) {
      const classes = m[1].split(/\s+/);
      if (!classes.includes('mx-auto')) continue;
      seen++;
      if (!classes.includes('w-full')) found.push(`${rel}: ${m[1]}`);
    }
  }
  return { found, seen };
}

describe('ancho de las pantallas dentro de AppShell', () => {
  test('toda raíz con mx-auto lleva w-full', () => {
    const { found, seen } = rootsWithoutWidth();
    expect(seen).toBeGreaterThan(10); // si no encuentra raíces, el test no probaría nada
    expect(found).toEqual([]);
  });
});
