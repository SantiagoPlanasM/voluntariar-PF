// @vitest-environment node
// D38 (Issue #39, sesión exploratoria 2, §330): el pie fijo de "Nuevo voluntariado" tenía sus propios números.
// Arrancaba a 240 px del borde (`md:left-60`) cuando la barra lateral mide 72 px entre 768 y 1023 px y 244 desde
// 1024: quedaba corrido respecto del formulario. Y en el celular quedaba a 64 px del borde (`bottom-16`) cuando la
// barra inferior mide 56: se veía el formulario por una rendija de 8 px.
// jsdom no calcula posiciones: este test compara las clases del pie con las medidas que usa `AppShell`.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));
const shell = readFileSync(join(APP, 'layout', 'AppShell.tsx'), 'utf8');
const form = readFileSync(join(APP, 'components', 'CreateVoluntariado.tsx'), 'utf8');

// La barra lateral: `w-[72px] lg:w-[244px]` en el <aside>.
const aside = /<aside className="([^"]*)"/.exec(shell)?.[1] ?? '';
const sideMd = /(?<![\w:-])w-(\[\d+px\])/.exec(aside)?.[1];
const sideLg = /(?<![\w-])lg:w-(\[\d+px\])/.exec(aside)?.[1];
// El lugar que el contenido le deja a la barra inferior: `pb-[calc(56px+env(safe-area-inset-bottom,0px))]`.
const bottomBar = /(?<![\w:-])pb-(\[calc\([^\]]*\)\])/.exec(shell)?.[1];

// El pie: el único elemento `fixed` del formulario.
const footers = [...form.matchAll(/className="([^"]*(?<![\w:-])fixed(?![\w-])[^"]*)"/g)].map(m => m[1].split(/\s+/));

describe('pie fijo de "Nuevo voluntariado"', () => {
  test('la lectura de AppShell encuentra las tres medidas', () => {
    expect(sideMd).toBe('[72px]');
    expect(sideLg).toBe('[244px]');
    expect(bottomBar).toBe('[calc(56px+env(safe-area-inset-bottom,0px))]');
  });

  test('hay un solo pie fijo', () => {
    expect(footers).toHaveLength(1);
  });

  test('arranca donde termina la barra lateral, en sus dos anchos', () => {
    const [footer] = footers;
    expect(footer).toContain('left-0');
    expect(footer).toContain(`md:left-${sideMd}`);
    expect(footer).toContain(`lg:left-${sideLg}`);
    expect(footer.filter(c => /(?:^|:)left-/.test(c))).toHaveLength(3);
  });

  test('en el celular queda pegado a la barra inferior, y abajo del todo desde 768 px', () => {
    const [footer] = footers;
    expect(footer).toContain(`bottom-${bottomBar}`);
    expect(footer).toContain('md:bottom-0');
    expect(footer.filter(c => /(?:^|:)bottom-/.test(c))).toHaveLength(2);
  });
});
