// @vitest-environment node
// D23 (Issue #24, sesión exploratoria §245): en modo oscuro la paleta de Tailwind se invierte (theme.css), pero
// `text-white` sigue blanco. Un botón `bg-violet-600 text-white` pasaba a blanco sobre #f2f4f7 (1,10:1): ilegible.
// jsdom no pinta, así que ningún test de componente lo puede ver. Este test lee las dos paletas de theme.css y todos
// los componentes, y exige que cada `className` que junta `text-white` con un fondo `bg-<color>-<tono>` tenga al
// menos 4,5:1 (WCAG AA, texto normal) en claro y en oscuro.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const css = readFileSync(join(SRC, 'styles', 'theme.css'), 'utf8');

// Variables --color-<nombre>: <#hex> de un bloque de CSS.
function colors(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/--color-([a-z]+-\d+):\s*(#[0-9a-fA-F]{6})/g)) out.set(m[1], m[2]);
  return out;
}
// Bloques "selector { ... }" sin anidar: la paleta clara está en @theme y la oscura en [data-theme='dark'].
const blocks = (selector: string) => css.split(selector + ' {').slice(1).map(b => b.slice(0, b.indexOf('}'))).join(' ');
const light = colors(blocks('@theme'));
const dark = new Map([...light, ...colors(blocks("[data-theme='dark']"))]);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Cada string con "text-white" de los .tsx de producción, con los fondos `bg-<color>-<tono>` que nombra.
let checked = 0;
function offenders(): string[] {
  const found: string[] = [];
  const files = readdirSync(join(SRC, 'app'), { recursive: true }) as string[];
  for (const rel of files) {
    if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
    const text = readFileSync(join(SRC, 'app', rel), 'utf8');
    for (const s of text.matchAll(/(["'`])([^"'`\n]*\btext-white\b[^"'`\n]*)\1/g)) {
      for (const bg of s[2].matchAll(/(?<![\w:-])bg-([a-z]+-\d+)\b/g)) {
        for (const [mode, palette] of [['claro', light], ['oscuro', dark]] as const) {
          const hex = palette.get(bg[1]);
          if (!hex) continue;
          checked++;
          const ratio = contrast('#ffffff', hex);
          if (ratio < 4.5) found.push(`${rel.replace(/\\/g, '/')}: bg-${bg[1]} + text-white en ${mode} = ${ratio.toFixed(2)}:1`);
        }
      }
    }
  }
  return found;
}

describe('contraste de text-white sobre los fondos de la paleta (claro y oscuro)', () => {
  test('la medición coincide con la de la sesión exploratoria: blanco sobre violet-600 oscuro = 1,10:1', () => {
    expect(dark.get('violet-600')).toBe('#f2f4f7');
    expect(contrast('#ffffff', dark.get('violet-600')!)).toBeCloseTo(1.1, 1);
  });

  test('los botones llenos del kit y sus reemplazos (tokens) llegan a 4,5:1 en claro y en oscuro', () => {
    // Tokens con nombre: en :root (claro) y en el primer [data-theme='dark'] (oscuro).
    const tokens = (block: string) => new Map([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
    const lightT = tokens(blocks(':root'));
    const darkT = new Map([...lightT, ...tokens(blocks("[data-theme='dark']"))]);
    const pairs: [string, string][] = [['people', '#ffffff'], ['brand', '#ffffff'], ['ink', 'on-ink'], ['critical', 'on-ink']];
    for (const [mode, t] of [['claro', lightT], ['oscuro', darkT]] as const) {
      for (const [bg, fg] of pairs) {
        const ratio = contrast(t.get(bg)!, fg.startsWith('#') ? fg : t.get(fg)!);
        expect(ratio, `${bg} / ${fg} en ${mode}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('ningún componente pone text-white sobre un fondo que no llega a 4,5:1', () => {
    const found = offenders();
    expect(checked).toBeGreaterThan(20); // si no encuentra combinaciones, el test no probaría nada
    expect(found).toEqual([]);
  });
});
