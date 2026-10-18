// src/lib/imageCompress.test.ts
//
// Compresión de fotos en el navegador antes de subirlas. Las fotos del celular pesan varios MB: se
// reducen a ~1600 px y se recodifican como JPEG. `canvas` y `createImageBitmap` no existen en jsdom, así
// que el módulo recibe sus dependencias y acá se prueban con dobles (la lógica es la real).
import { describe, test, expect, vi } from 'vitest';
import { fitWithin, compressImage, MAX_SIDE, MAX_UPLOAD_BYTES, ACCEPTED_TYPES } from './imageCompress';

const file = (bytes: number, type = 'image/jpeg', name = 'foto.jpg') => new File([new Uint8Array(bytes)], name, { type });

// Dobles de las dependencias del navegador.
function makeDeps(opts: { width?: number; height?: number; outBytes?: number; blobNull?: boolean; decodeFails?: boolean } = {}) {
  const { width = 4000, height = 3000, outBytes = 400_000, blobNull = false, decodeFails = false } = opts;
  const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
  const bitmap = { width, height, close: vi.fn() };
  return {
    ctx, canvas, bitmap,
    deps: {
      createBitmap: vi.fn(async () => { if (decodeFails) throw new Error('decode'); return bitmap as never; }),
      makeCanvas: vi.fn(() => canvas as never),
      toBlob: vi.fn(async (_c: unknown, type: string) => (blobNull ? null : new Blob([new Uint8Array(outBytes)], { type }))),
    },
  };
}

describe('fitWithin()', () => {
  test('reduce manteniendo la proporción hasta que el lado mayor sea el máximo', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });   // vertical
    expect(fitWithin(5000, 5000, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  test('NUNCA agranda una foto que ya es chica', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1000, 1600)).toEqual({ width: 1600, height: 1000 });   // justo en el borde
  });

  test('redondea y nunca devuelve 0 (una tira muy angosta)', () => {
    const r = fitWithin(10000, 1, 1600);
    expect(r.width).toBe(1600);
    expect(r.height).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(r.height)).toBe(true);
  });
});

describe('compressImage()', () => {
  test('una foto grande se reduce a 1600 px y sale como JPEG con extensión .jpg', async () => {
    const { deps, ctx, canvas, bitmap } = makeDeps({ width: 4000, height: 3000 });
    const out = await compressImage(file(6_000_000, 'image/png', 'vacaciones.png'), deps);

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('vacaciones.jpg');
    expect(out.size).toBe(400_000);
    expect(bitmap.close).toHaveBeenCalled();                       // libera la memoria del bitmap
  });

  test('el JPEG se genera con la calidad configurada', async () => {
    const { deps } = makeDeps();
    await compressImage(file(5_000_000), deps);
    expect(deps.toBlob).toHaveBeenCalledWith(expect.anything(), 'image/jpeg', expect.closeTo(0.82, 2));
  });

  test('un PNG con transparencia se pinta sobre fondo BLANCO (si no, quedaría negro en el JPEG)', async () => {
    const { deps, ctx } = makeDeps();
    await compressImage(file(5_000_000, 'image/png', 'logo.png'), deps);
    expect(ctx.fillStyle).toBe('#ffffff');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
    const fillOrder = ctx.fillRect.mock.invocationCallOrder[0];
    const drawOrder = ctx.drawImage.mock.invocationCallOrder[0];
    expect(fillOrder).toBeLessThan(drawOrder);                      // el fondo va ANTES que la imagen
  });

  test('una foto chica y liviana se devuelve TAL CUAL (no se recomprime: sería perder calidad para nada)', async () => {
    const { deps } = makeDeps({ width: 1200, height: 800 });
    const original = file(300_000);
    const out = await compressImage(original, deps);
    expect(out).toBe(original);
    expect(deps.makeCanvas).not.toHaveBeenCalled();
  });

  test('chica en píxeles pero PESADA (más de 1,5 MB): sí se recomprime, sin agrandar', async () => {
    const { deps, canvas } = makeDeps({ width: 1500, height: 1000, outBytes: 600_000 });
    const out = await compressImage(file(3_000_000), deps);
    expect(canvas.width).toBe(1500);
    expect(canvas.height).toBe(1000);
    expect(out.size).toBe(600_000);
  });

  test('si recomprimir deja un archivo MÁS grande y no hubo reducción, se conserva el original', async () => {
    const { deps } = makeDeps({ width: 1500, height: 1000, outBytes: 5_000_000 });
    const original = file(2_000_000);
    expect(await compressImage(original, deps)).toBe(original);
  });

  describe('errores (mensajes pensados para mostrarle al usuario)', () => {
    test('un tipo que no es JPEG/PNG/WebP (p. ej. HEIC de un iPhone o un PDF) se rechaza con un mensaje claro', async () => {
      const { deps } = makeDeps();
      for (const type of ['image/heic', 'image/gif', 'application/pdf', '']) {
        await expect(compressImage(file(1000, type), deps)).rejects.toThrow(/JPEG, PNG o WebP/);
      }
      expect(deps.createBitmap).not.toHaveBeenCalled();
    });

    test('un archivo que el navegador no puede decodificar (corrupto) da un mensaje claro, no un error técnico', async () => {
      const { deps } = makeDeps({ decodeFails: true });
      await expect(compressImage(file(1000), deps)).rejects.toThrow(/No pudimos leer esa foto/);
    });

    test('si canvas no puede generar el JPEG (devuelve null) también da un mensaje claro', async () => {
      const { deps } = makeDeps({ blobNull: true });
      await expect(compressImage(file(5_000_000), deps)).rejects.toThrow(/No pudimos procesar esa foto/);
    });

    test('si aun comprimida supera el tope del servidor (8 MB) se rechaza ANTES de intentar subirla', async () => {
      const { deps } = makeDeps({ outBytes: MAX_UPLOAD_BYTES + 1 });
      await expect(compressImage(file(20_000_000), deps)).rejects.toThrow(/pesa demasiado/);
    });
  });

  test('las constantes coinciden con los límites del servidor', () => {
    expect(MAX_SIDE).toBe(1600);
    expect(MAX_UPLOAD_BYTES).toBe(8_000_000);   // §232: no 8 MiB, para no pasar el tope del servidor
    expect([...ACCEPTED_TYPES].sort()).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});
