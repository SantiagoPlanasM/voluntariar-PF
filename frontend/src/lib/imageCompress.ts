// src/lib/imageCompress.ts
//
// Compresión de fotos EN EL NAVEGADOR antes de subirlas (Momentos, PROJECT_ANALYSIS.md §43). Una foto de
// celular pesa 3–10 MB; se reduce a ~1600 px y se recodifica como JPEG: baja a unos cientos de KB, sube
// más rápido, gasta menos cuota de Cloudinary y entra holgada en el tope de 8 MB del servidor.
//
// Los límites (tipos y 8 MB) tienen que coincidir con los de backend/src/routes/posts.js y con los de la foto de
// perfil (PUT /api/auth/me/photo en backend/src/routes/auth.js, que también usa ProfilePhotoPicker; §162–§163).
//
// `createImageBitmap` respeta la orientación EXIF de la foto (una foto sacada "de costado" no sale girada).

export const MAX_SIDE = 1600;                       // lado mayor de la foto ya comprimida
export const JPEG_QUALITY = 0.82;
export const MAX_UPLOAD_BYTES = 8_000_000;    // mismo tope que el servidor (HTTP 413 si lo supera; §232)
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SKIP_IF_SMALLER_THAN = 1.5 * 1024 * 1024;     // una foto chica y liviana no se recomprime

/** Tamaño final: mantiene la proporción, el lado mayor no pasa de `max` y NUNCA agranda. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Lo que se necesita del navegador, inyectable para poder probar la lógica sin canvas (jsdom no lo tiene).
export interface CompressDeps {
  createBitmap: (file: Blob) => Promise<ImageBitmap>;
  makeCanvas: () => HTMLCanvasElement;
  toBlob: (canvas: HTMLCanvasElement, type: string, quality: number) => Promise<Blob | null>;
}

const browserDeps: CompressDeps = {
  createBitmap: (file) => createImageBitmap(file),
  makeCanvas: () => document.createElement('canvas'),
  toBlob: (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
};

/**
 * Devuelve la foto lista para subir. Si no hace falta tocarla (chica y liviana) devuelve el MISMO archivo.
 * Lanza un Error con un mensaje pensado para mostrárselo al usuario tal cual.
 */
export async function compressImage(file: File, deps: CompressDeps = browserDeps): Promise<File> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Solo se aceptan fotos JPEG, PNG o WebP');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await deps.createBitmap(file);
  } catch {
    throw new Error('No pudimos leer esa foto. Probá con otra.');
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const resized = target.width !== bitmap.width || target.height !== bitmap.height;

    // Chica en píxeles y liviana: recomprimirla solo le restaría calidad.
    if (!resized && file.size <= SKIP_IF_SMALLER_THAN) return file;

    const canvas = deps.makeCanvas();
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No pudimos procesar esa foto');

    // JPEG no tiene transparencia: un PNG transparente quedaría NEGRO. Se pinta un fondo blanco primero.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await deps.toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    if (!blob) throw new Error('No pudimos procesar esa foto');

    // Si no se redujo y recomprimir dejó algo más grande, el original era mejor.
    if (!resized && blob.size >= file.size) return file;

    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('La foto pesa demasiado. Probá con una de menor tamaño.');
    }
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } finally {
    bitmap.close?.();     // libera la memoria del bitmap (en fotos grandes son decenas de MB)
  }
}
