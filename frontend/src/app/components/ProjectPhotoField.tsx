// src/app/components/ProjectPhotoField.tsx — "Foto del voluntariado" en el alta y la edición (§282).
//
// Solo elige la foto y muestra la vista previa (o la actual, al editar); la sube CreateVoluntariado después de guardar
// el voluntariado, porque al crearlo todavía no hay id. Acepta los mismos tipos que el servidor (lib/imageCompress); la
// validación real (la cabecera del archivo) la hace el backend.
// §297: con una foto, también el encuadre (arriba, centro o abajo): qué parte se ve cuando la tarjeta la recorta. La
// vista previa lo muestra igual que la tarjeta.
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { ACCEPTED_TYPES } from '../../lib/imageCompress';
import type { ImagePosition } from '../../lib/api';
import { IMAGE_POSITIONS, imagePositionClass } from '../volunteering/imagePosition';

export function ProjectPhotoField({ currentUrl, file, onChange, position = 'center', onPositionChange }: {
  currentUrl?: string | null; file: File | null; onChange: (file: File | null) => void;
  position?: ImagePosition; onPositionChange?: (position: ImagePosition) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';   // que elegir el mismo archivo otra vez vuelva a disparar el cambio
    if (!chosen) return;
    if (!ACCEPTED_TYPES.includes(chosen.type)) { setError('Elegí una foto JPEG, PNG o WebP'); return; }
    setError('');
    onChange(chosen);
  };

  const fit = imagePositionClass(position);
  const hasPhoto = Boolean(preview || currentUrl);
  return (
    <div>
      <p className="block text-sm font-semibold text-gray-700 mb-1.5">
        Foto del voluntariado <span className="text-gray-400 font-normal ml-1">(opcional)</span>
      </p>
      <div className="flex items-center gap-3">
        <div className="w-20 aspect-[4/5] rounded-xl overflow-hidden bg-surface-soft flex items-center justify-center flex-shrink-0">
          {preview ? <img src={preview} alt="Vista previa de la foto del voluntariado" className={`w-full h-full object-cover ${fit}`} />
            : currentUrl ? <img src={currentUrl} alt="Foto actual del voluntariado" className={`w-full h-full object-cover ${fit}`} />
            : <ImagePlus className="w-6 h-6 text-ink-muted" aria-hidden="true" />}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" onClick={() => input.current?.click()}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-surface-soft text-ink hover:bg-surface-pressed">
            {file || currentUrl ? 'Cambiar foto' : 'Elegir foto'}
          </button>
          {file && (
            <button type="button" onClick={() => onChange(null)} aria-label="Quitar la foto elegida"
              className="flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
              <X className="w-3.5 h-3.5" aria-hidden="true" />Quitar
            </button>
          )}
        </div>
        <input ref={input} type="file" accept={ACCEPTED_TYPES.join(',')} aria-label="Elegir una foto para el voluntariado"
          className="hidden" onChange={pick} />
      </div>
      {hasPhoto && onPositionChange && (
        <div className="mt-2">
          <p id="encuadre-label" className="text-xs font-semibold text-gray-700 mb-1">Encuadre en las tarjetas</p>
          <div role="radiogroup" aria-labelledby="encuadre-label" className="h-9 p-1 rounded-[10px] bg-surface-soft inline-flex">
            {IMAGE_POSITIONS.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={position === p.key} onClick={() => onPositionChange(p.key)}
                className={`px-3 rounded-lg text-[13px] ${position === p.key ? 'bg-surface font-bold text-ink' : 'font-semibold text-ink-soft'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">Se muestra en la tarjeta y en el detalle. Se sube al guardar.</p>
      {error && <p role="alert" className="text-xs text-red-600 font-medium mt-1.5">{error}</p>}
    </div>
  );
}
