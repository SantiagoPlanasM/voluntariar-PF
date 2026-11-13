// @vitest-environment node
// T4 de la revisión contra DESIGN.md (§330, hallazgos B8 y C7): "Los botones que son solo un ícono miden al menos
// 44×44px" (DESIGN.md → Accesibilidad). Había 33 de 28 a 40 px: los "Volver", los "Cerrar" de las hojas viejas, los
// controles del mapa, editar y borrar KPI, el mensaje al inscripto, las estrellas para puntuar.
// Un botón de ícono se reconoce por el tamaño cuadrado explícito (`w-9 h-9`); los botones con texto y los chips usan
// alto y relleno (`h-10 px-4`) y siguen los altos del diseño (48, 40 y 32). jsdom no calcula tamaños: este test mira
// el código. No ve los botones de ícono sin tamaño explícito (relleno solo): esos se midieron en Chrome (§332).
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));
const MIN = 11; // w-11 = 44 px

// Fin de la etiqueta de apertura: el primer `>` fuera de comillas y de llaves (hay `=>` y `>` dentro de los atributos).
function endOfOpenTag(src: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

type Finding = { line: number; size: string };

// Botones y enlaces con tamaño cuadrado explícito: los chicos y los que se pueden achicar.
// Dentro de una fila flex, un botón de 44 px sin `shrink-0` cede ancho cuando el texto de al lado es largo: los
// "Volver" de `NGOTeam` y del asistente medían 31×44 y 37×44 a 375 px con `w-11 h-11` en el código.
function squareButtons(src: string): { small: Finding[]; shrinkable: Finding[] } {
  const small: Finding[] = [];
  const shrinkable: Finding[] = [];
  for (const m of src.matchAll(/<(?:button|a|Link|NavLink)\b/g)) {
    const end = endOfOpenTag(src, m.index);
    if (end < 0) continue;
    const tag = src.slice(m.index, end + 1);
    const square = /(?<![\w:-])w-(\d+(?:\.\d+)?) h-\1(?![\w.])/.exec(tag);
    if (!square) continue;
    const finding = { line: src.slice(0, m.index).split('\n').length, size: square[0] };
    if (Number(square[1]) < MIN) small.push(finding);
    if (!/(?<![\w:-])(?:flex-)?shrink-0(?![\w-])/.test(tag)) shrinkable.push(finding);
  }
  return { small, shrinkable };
}

export const smallIconButtons = (src: string): Finding[] => squareButtons(src).small;
export const shrinkableIconButtons = (src: string): Finding[] => squareButtons(src).shrinkable;

describe('botones de ícono', () => {
  test('la detección ve un botón cuadrado chico y deja pasar los de 44 px, los de texto y lo que no es tocable', () => {
    expect(smallIconButtons('<button onClick={() => a > b} className="w-9 h-9 rounded-full">')).toEqual([{ line: 1, size: 'w-9 h-9' }]);
    expect(smallIconButtons('\n<Link to="/x" className={`w-7 h-7 ${x}`}>')).toEqual([{ line: 2, size: 'w-7 h-7' }]);
    expect(smallIconButtons('<button className="w-11 h-11">')).toEqual([]);
    expect(smallIconButtons('<button className="w-12 h-12">')).toEqual([]);
    expect(smallIconButtons('<button className="h-10 px-4">Guardar</button>')).toEqual([]);
    expect(smallIconButtons('<button className="md:w-9 md:h-9 w-11 h-11">')).toEqual([]);
    expect(smallIconButtons('<span className="w-8 h-8"><X className="w-4 h-4" /></span>')).toEqual([]);
    expect(smallIconButtons('<button className="p-2"><X className="w-4 h-4" /></button>')).toEqual([]);
  });

  test('ningún botón o enlace cuadrado mide menos de 44 px', () => {
    const found: string[] = [];
    let files = 0;
    for (const rel of readdirSync(APP, { recursive: true }) as string[]) {
      if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
      files++;
      for (const b of smallIconButtons(readFileSync(join(APP, rel), 'utf8'))) found.push(`${rel.replace(/\\/g, '/')}:${b.line} ${b.size}`);
    }
    expect(files).toBeGreaterThan(80); // si no encuentra archivos, el test no probaría nada
    expect(found).toEqual([]);
  });

  test('la detección ve un botón cuadrado que se puede achicar', () => {
    expect(shrinkableIconButtons('<Link to="/x" className="w-11 h-11 flex items-center">')).toEqual([{ line: 1, size: 'w-11 h-11' }]);
    expect(shrinkableIconButtons('<Link to="/x" className="w-11 h-11 flex-shrink-0 flex">')).toEqual([]);
    expect(shrinkableIconButtons('<button className="w-11 h-11 shrink-0">')).toEqual([]);
    expect(shrinkableIconButtons('<button className="w-11 h-11 md:shrink-0">')).toEqual([{ line: 1, size: 'w-11 h-11' }]);
  });

  test('todo botón o enlace cuadrado lleva shrink-0', () => {
    const found: string[] = [];
    let seen = 0;
    for (const rel of readdirSync(APP, { recursive: true }) as string[]) {
      if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
      const src = readFileSync(join(APP, rel), 'utf8');
      seen += [...src.matchAll(/(?<![\w:-])w-11 h-11(?![\w.])/g)].length;
      for (const b of shrinkableIconButtons(src)) found.push(`${rel.replace(/\\/g, '/')}:${b.line} ${b.size}`);
    }
    expect(seen).toBeGreaterThan(40);
    expect(found).toEqual([]);
  });

  // En el Panel de la ONG, "Rechazar" y "Entrevista" pierden el texto en el celular (`hidden sm:inline`): ahí son
  // botones de ícono y medían 32×36. No tienen tamaño cuadrado en el código, así que los mira este caso aparte.
  test('Rechazar y Entrevista del Panel miden 44 px cuando quedan solo con el ícono', () => {
    const src = readFileSync(join(APP, 'components', 'NGODashboard.tsx'), 'utf8');
    const tags = [...src.matchAll(/<(?:Button|ButtonLink)\b/g)]
      .map(m => src.slice(m.index, endOfOpenTag(src, m.index) + 1))
      .filter(tag => /aria-label=\{`(?:Rechazar a|Entrevista con) /.test(tag));
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag).toMatch(/(?<![\w:-])!h-11(?![\w-])/);
      expect(tag).toMatch(/(?<![\w:-])!w-11(?![\w-])/);
    }
  });
});
