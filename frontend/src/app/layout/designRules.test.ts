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

  // Tanda T5 (hallazgos B3 y B4): "azul = dinero y marca, verde = personas". Lo que se puede mirar en el código.
  describe('azul solo dinero, verde solo personas', () => {
    // `NGOEmpleados` se saca en la Etapa 4 del plan: no se revisa.
    const skip = (rel: string) => rel !== 'components/NGOEmpleados.tsx';

    test('nada usa los verdes de la paleta vieja (emerald, green, teal, lime): el verde es el token `people`', () => {
      expect(matching(/(?<![\w-])[a-z-]*-(emerald|green|teal|lime)-\d/).filter(skip)).toEqual([]);
    });

    test('el verde pleno (`bg-people`) solo en inscribirse, la barra de personas, el tipo Sostenido y "te aceptaron"', () => {
      expect(matching(/(?<![\w-])bg-people(?![\w-])/).sort()).toEqual([
        'components/CreateVoluntariado.tsx',   // el selector de tipo (Sostenido)
        'components/NGOProjectDetail.tsx',     // la barra de inscriptos
        'components/NotificationsScreen.tsx',  // el globito de "te aceptaron"
        'components/PostCard.tsx',             // "Sumarme"
        'ui/Button.tsx',                       // variante `join`
        'ui/Meter.tsx',                        // la barra de personas
        'ui/TypeBadge.tsx',                    // Sostenido
      ]);
    });

    test('el azul pleno (`bg-brand`) solo en donar, la barra de dinero, el tipo Fugaz y el logo', () => {
      expect(matching(/(?<![\w-])bg-brand(?![\w-])/).sort()).toEqual([
        'components/CreateVoluntariado.tsx',   // el selector de tipo (Fugaz)
        'components/NGOProjectDetail.tsx',     // la barra de lo recaudado
        'ui/Button.tsx',                       // variante `donate`
        'ui/Logo.tsx',
        'ui/Meter.tsx',                        // la barra de dinero
        'ui/TypeBadge.tsx',                    // Fugaz
      ]);
    });

    test('los enlaces van en `ink`, no en azul: ninguna clase junta `text-brand-text` con `underline`', () => {
      expect(matching(/text-brand-text[^"'`\n]*underline|underline[^"'`\n]*text-brand-text/)).toEqual([]);
    });

    test('los indicadores de carga no llevan azul ni verde', () => {
      expect(matching(/animate-spin[^"'`\n]*(people|brand)|(people|brand)[^"'`\n]*animate-spin/)).toEqual([]);
    });
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
