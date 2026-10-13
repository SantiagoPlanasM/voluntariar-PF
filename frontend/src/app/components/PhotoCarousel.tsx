// src/app/components/PhotoCarousel.tsx
//
// Carrusel de fotos de una publicación de Momentos (estilo Instagram): botones, flechas del teclado y
// deslizar con el dedo. Con una sola foto no muestra controles.
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PostPhoto } from '../../lib/api';

const MIN_ASPECT = 0.8;     // 4:5, lo más vertical que se muestra (como Instagram)
const MAX_ASPECT = 1.91;    // lo más panorámico
const SWIPE_MIN_PX = 40;    // menos que esto es un toque, no un deslizamiento

/** Proporción (ancho / alto) del carrusel: la de la primera foto, acotada para que una foto muy larga o muy
 *  ancha no ocupe media pantalla. Sin medidas, cuadrada. Todas las fotos se ven con `object-cover`. */
export function carouselAspect(photos: PostPhoto[]): number {
  const first = photos[0];
  if (!first || !first.width || !first.height) return 1;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, first.width / first.height));
}

interface Props {
  photos: PostPhoto[];
  /** Texto alternativo base (por ejemplo, el título del proyecto). */
  alt: string;
}

export function PhotoCarousel({ photos, alt }: Props) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (photos.length === 0) return null;

  // Si la lista se achicó y el índice quedó fuera de rango, se muestra la última foto que queda.
  const current = Math.min(index, photos.length - 1);
  const many = photos.length > 1;
  const hasPrev = current > 0;
  const hasNext = current < photos.length - 1;

  const goPrev = () => { if (hasPrev) setIndex(current - 1); };
  const goNext = () => { if (hasNext) setIndex(current + 1); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goPrev();
    else if (e.key === 'ArrowRight') goNext();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = e.changedTouches[0];
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    // Un gesto más vertical que horizontal es scroll de la página, no un cambio de foto.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) goNext(); else goPrev();
  };

  const photo = photos[current];

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={many ? `Fotos de ${alt}` : alt}
      tabIndex={many ? 0 : undefined}
      onKeyDown={many ? onKeyDown : undefined}
      onTouchStart={many ? onTouchStart : undefined}
      onTouchEnd={many ? onTouchEnd : undefined}
      className="relative w-full bg-gray-100 overflow-hidden select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      style={{ aspectRatio: String(carouselAspect(photos)) }}
    >
      <img
        key={photo.id}
        src={photo.url}
        alt={many ? `${alt} (foto ${current + 1} de ${photos.length})` : alt}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover"
      />

      {many && (
        <>
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-semibold">
            {`${current + 1} / ${photos.length}`}
          </span>

          {hasPrev && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-800" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-800" />
            </button>
          )}

          <div aria-hidden="true" className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((p, i) => (
              <span
                key={p.id}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
