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

// D25 y D29 (Issues #26 y #30, §247): el mismo problema con textos de color, no solo blancos.
//  - pares: un `text-<color>-<tono>` y un `bg-<color>-<tono>` en el mismo string (pastillas de estado, avisos);
//  - textos sueltos: un `<p>`, `<span>`, `<h*>`, `<li>`, `<label>` o `<td>` con `text-<color>-<tono>` y sin fondo propio,
//    medido contra `--surface` (la tarjeta; es una aproximación: puede estar sobre otro fondo).
// Las pantallas que no se rehicieron (§240) tienen más casos que los dos defectos. Arreglarlos todos es otro trabajo,
// así que esto es un TRINQUETE: KNOWN_* es la lista de hoy; el test falla si aparece uno nuevo y también si uno de la
// lista ya no está (hay que sacarlo, para que la lista solo baje).
// §248: la lista llegó a 0 (los 22 casos se pasaron a tokens). Queda vacía: desde ahora es una regla estricta.
const KNOWN_PAIRS: string[] = [];
const KNOWN_TEXT: string[] = [];

function lowContrastPairs(): { pairs: string[]; text: string[] } {
  const tok = (block: string) => new Map([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
  const lightT = tok(blocks(':root'));
  const darkT = new Map([...lightT, ...tok(blocks("[data-theme='dark']"))]);
  const modes = [['claro', light, lightT], ['oscuro', dark, darkT]] as const;
  const pairs = new Set<string>();
  const text = new Set<string>();
  const files = readdirSync(join(SRC, 'app'), { recursive: true }) as string[];
  for (const rel of files) {
    if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
    const name = rel.replace(/\\/g, '/');
    const src = readFileSync(join(SRC, 'app', rel), 'utf8');
    const fgOf = (s: string) => [...s.matchAll(/(?<![\w:-])text-([a-z]+-\d+)\b/g)].map(m => m[1]);
    const bgOf = (s: string) => [...s.matchAll(/(?<![\w:-])bg-([a-z]+-\d+)\b/g)].map(m => m[1]);
    for (const s of src.matchAll(/(["'`])([^"'`\n]*\btext-[a-z]+-\d+\b[^"'`\n]*)\1/g)) {
      for (const f of fgOf(s[2])) for (const b of bgOf(s[2])) for (const [mode, p] of modes) {
        if (p.get(f) && p.get(b) && contrast(p.get(f)!, p.get(b)!) < 4.5) pairs.add(`${name}: text-${f} sobre bg-${b} en ${mode}`);
      }
    }
    for (const m of src.matchAll(/<(?:p|span|h[1-6]|li|label|td)\b[^>]*?className=(["'])([^"']*)\1/g)) {
      if (bgOf(m[2]).length) continue;
      for (const f of fgOf(m[2])) for (const [mode, p, t] of modes) {
        if (p.get(f) && contrast(p.get(f)!, t.get('surface')!) < 4.5) text.add(`${name}: text-${f} sobre surface en ${mode}`);
      }
    }
    // §248: tokens usados como color de texto (`text-people`, `text-brand`…), en cualquier string. Varios tokens son
    // de RELLENO (botones) y tienen su versión para texto (`people-text`, `brand-text`): en oscuro, `text-people` sobre
    // la tarjeta da 3,38:1. Fondo: el token `bg-<token>` del mismo string si hay; si no (o con opacidad, `bg-brand/20`),
    // la tarjeta. Solo elementos HTML con texto: los íconos (`<Star>`, `<Heart>`, `<Loader2>`, con mayúscula) piden 3:1
    // y no 4,5:1, y no entran.
    for (const s of src.matchAll(/<(?:p|span|h[1-6]|li|label|td|div|button|a)\b[^>]*?className=(["'`])([^"'`]*)\1/g)) {
      const fgT = [...s[2].matchAll(/(?<![\w:-])text-([a-z]+(?:-[a-z]+)*)(?![\w/-])/g)].map(m => m[1]).filter(k => lightT.has(k));
      if (!fgT.length || bgOf(s[2]).length) continue;
      const bgT = [...s[2].matchAll(/(?<![\w:-])bg-([a-z]+(?:-[a-z]+)*)(?![\w/-])/g)].map(m => m[1]).filter(k => lightT.has(k));
      for (const f of fgT) for (const b of (bgT.length ? bgT : ['surface'])) for (const [mode, , t] of modes) {
        if (contrast(t.get(f)!, t.get(b)!) < 4.5) text.add(`${name}: text-${f} sobre ${b} en ${mode}`);
      }
    }
  }
  return { pairs: [...pairs].sort(), text: [...text].sort() };
}

describe('contraste de textos de color sobre la paleta (trinquete)', () => {
  const found = lowContrastPairs();
  test('ninguna combinación texto/fondo nueva por debajo de 4,5:1, y la lista de conocidas solo baja', () => {
    expect(found.pairs.filter(x => !KNOWN_PAIRS.includes(x)), 'nuevas').toEqual([]);
    expect(KNOWN_PAIRS.filter(x => !found.pairs.includes(x)), 'ya arregladas: sacarlas de KNOWN_PAIRS').toEqual([]);
  });
  test('ningún texto suelto nuevo por debajo de 4,5:1 sobre la tarjeta, y la lista de conocidos solo baja', () => {
    expect(found.text.filter(x => !KNOWN_TEXT.includes(x)), 'nuevos').toEqual([]);
    expect(KNOWN_TEXT.filter(x => !found.text.includes(x)), 'ya arreglados: sacarlos de KNOWN_TEXT').toEqual([]);
  });
  test('los defectos D25 y D29 no están en la lista de conocidos', () => {
    expect(KNOWN_PAIRS.filter(x => x.startsWith('components/NGOProjectDetail.tsx: text-green-600 sobre bg-green-50'))).toEqual([]);
    expect(KNOWN_TEXT.filter(x => x.startsWith('components/NGOKPIs.tsx: text-gray-300'))).toEqual([]);
  });
});

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
    const pairs: [string, string][] = [['people', '#ffffff'], ['brand', '#ffffff'], ['ink', 'on-ink'], ['critical', 'on-ink'],
      // pastillas de estado y texto de ayuda (D25 y D29, §247): fondo, texto
      ['people-soft', 'people-text'], ['surface-soft', 'ink-soft'], ['surface-soft', 'critical'], ['surface', 'ink-muted'],
      // reemplazos de los 22 casos del trinquete (§248)
      ['surface', 'critical'], ['surface', 'ink'], ['surface', 'people-text'], ['surface-soft', 'ink'], ['surface-soft', 'ink-muted'], ['surface', 'brand-text'],
      // tarjetas elegidas e iniciales sobre los fondos suaves (los vio el barrido en el navegador, §248)
      ['brand-soft', 'brand-text'], ['brand-soft', 'ink-soft'], ['people-soft', 'ink-soft']];
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

// D30 (Issue #31, §253): en oscuro, `theme.css` pasa `bg-white` a la superficie oscura clase por clase, y cada opacidad
// (`bg-white/95`, `/90`…) es una clase aparte. La tarjeta del mapa usaba `bg-white/98`, que no estaba: quedaba blanca
// con el texto ya invertido (#f2f4f7 sobre blanco, 1,10:1). Los tests de arriba miran pares de la paleta, no esto.
describe('superficies blancas con opacidad en modo oscuro', () => {
  // Sobre una foto el blanco sigue blanco: los puntos del carrusel no se pasan a oscuro.
  const SOBRE_FOTO = new Set(['components/PhotoCarousel.tsx: bg-white/50']);
  const BS = String.fromCharCode(92); // la barra invertida del selector `.bg-white\/98`
  const darkLines = css.split('\n').filter(l => l.startsWith("[data-theme='dark']"));
  const hasDark = (n: string) => darkLines.some(l => l.includes(`.bg-white${BS}/${n}`));

  test('cada bg-white/NN de los componentes tiene su versión oscura en theme.css', () => {
    const missing: string[] = [];
    let seen = 0;
    for (const rel of readdirSync(join(SRC, 'app'), { recursive: true }) as string[]) {
      if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
      const text = readFileSync(join(SRC, 'app', rel), 'utf8');
      for (const m of text.matchAll(/(?<![\w:-])bg-white\/(\d+)/g)) {
        const key = `${rel.replace(/\\/g, '/')}: bg-white/${m[1]}`;
        seen++;
        if (!SOBRE_FOTO.has(key) && !hasDark(m[1])) missing.push(key);
      }
    }
    expect(seen).toBeGreaterThan(5); // si no encuentra ninguna, el test no probaría nada
    expect([...new Set(missing)]).toEqual([]);
  });

  test('la detección ve las que ya están (95 y 90) y no inventa otras', () => {
    expect(hasDark('95')).toBe(true);
    expect(hasDark('90')).toBe(true);
    expect(hasDark('5')).toBe(false);
  });
});
