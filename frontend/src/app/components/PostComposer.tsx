// src/app/components/PostComposer.tsx
//
// Modal para publicar un momento: elegir el voluntariado, hasta 5 fotos (con vista previa), y un texto de hasta
// 500 caracteres. Las fotos se comprimen EN EL NAVEGADOR (lib/imageCompress.ts) recién al publicar, así la vista
// previa es instantánea; si alguna no se puede procesar no se sube nada.
//
// Los límites (5 fotos, 500 caracteres) deben coincidir con los de backend/src/routes/posts.js.
// El modal no se cierra solo al publicar: avisa con `onCreated(post)` y quien lo abrió decide (hasta entonces
// el botón queda bloqueado, para que un segundo clic no publique dos veces).
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { X, ImagePlus, Loader2 } from 'lucide-react';
import { api, type EligibleProject, type Post } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ACCEPTED_TYPES, compressImage } from '../../lib/imageCompress';
import { userMessage } from '../../lib/format';

export const MAX_PHOTOS = 5;
export const MAX_CAPTION = 500;
const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

type Phase = 'idle' | 'compressing' | 'uploading' | 'done';
interface Picked { id: string; file: File; url: string }

interface Props {
  onClose: () => void;
  onCreated: (post: Post) => void;
}

export function PostComposer({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const titleId = useId();

  const [projects, setProjects] = useState<EligibleProject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [projectId, setProjectId] = useState('');
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const nextId = useRef(0);
  const photosRef = useRef<Picked[]>([]);
  photosRef.current = photos;

  // Libera las URLs de vista previa al cerrar (si no, quedan en memoria hasta cerrar la pestaña).
  useEffect(() => () => { photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)); }, []);

  useEffect(() => {
    let cancelled = false;
    setProjects(null);
    setLoadError(null);
    api.posts.eligibleProjects()
      .then((res) => {
        if (cancelled) return;
        setProjects(res.projects);
        if (res.projects.length === 1) setProjectId(res.projects[0].id);
      })
      .catch((err) => { if (!cancelled) setLoadError(userMessage(err, NETWORK_ERROR)); });
    return () => { cancelled = true; };
  }, [attempt]);

  const retryLoad = useCallback(() => setAttempt((n) => n + 1), []);

  const busy = phase !== 'idle';
  const dirty = photos.length > 0 || caption.trim().length > 0;
  const canSubmit = !busy && projectId !== '' && photos.length > 0;

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm('¿Descartar esta publicación? Se pierden las fotos y el texto.')) return;
    onClose();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') requestClose();
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = '';          // permite volver a elegir el mismo archivo
    if (chosen.length === 0) return;

    const valid = chosen.filter((f) => ACCEPTED_TYPES.includes(f.type));
    const room = MAX_PHOTOS - photos.length;
    const accepted = valid.slice(0, Math.max(0, room));

    if (valid.length < chosen.length) setError('Solo se aceptan fotos JPEG, PNG o WebP.');
    else if (valid.length > room) setError(`Podés subir hasta ${MAX_PHOTOS} fotos por publicación.`);
    else setError(null);

    if (accepted.length === 0) return;
    setPhotos((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: `p${nextId.current++}`, file, url: URL.createObjectURL(file) })),
    ]);
  }

  function removePhoto(id: string) {
    const gone = photos.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setError(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setPhase('compressing');

    let files: File[];
    try {
      files = await Promise.all(photos.map((p) => compressImage(p.file)));
    } catch (err) {
      setError(userMessage(err, 'No pudimos preparar las fotos. Probá con otras.'));
      setPhase('idle');
      return;
    }

    setPhase('uploading');
    const form = new FormData();
    form.append('project_id', projectId);
    const text = caption.trim();
    if (text) form.append('caption', text);
    files.forEach((f) => form.append('photos', f));

    try {
      const { post } = await api.posts.create(form);
      setPhase('done');
      onCreated(post);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
      setPhase('idle');
    }
  }

  const publishLabel = phase === 'compressing' ? 'Preparando fotos…' : phase === 'uploading' ? 'Publicando…' : 'Publicar';
  const noProjectsMessage = user?.role === 'ngo'
    ? 'Todavía no tenés voluntariados. Creá un voluntariado y después compartí sus momentos.'
    : 'Para compartir momentos necesitás tener una inscripción aprobada en algún voluntariado.';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id={titleId} className="text-base font-black text-gray-900">Compartir un momento</h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {projects === null && !loadError && (
            <p role="status" className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Cargando tus voluntariados…
            </p>
          )}

          {loadError && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-red-600">{loadError}</p>
              <button type="button" onClick={retryLoad} className="text-sm font-semibold text-emerald-700 hover:underline">
                Reintentar
              </button>
            </div>
          )}

          {projects !== null && projects.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{noProjectsMessage}</p>
              <button type="button" onClick={requestClose} className="text-sm font-semibold text-gray-700 hover:underline">
                Cerrar
              </button>
            </div>
          )}

          {projects !== null && projects.length > 0 && (
            <>
              <div>
                <label htmlFor={`${titleId}-project`} className="block text-xs font-semibold text-gray-600 mb-1">Voluntariado</label>
                <select
                  id={`${titleId}-project`}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Elegí un voluntariado</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">Fotos</span>
                  <span className="text-xs text-gray-400">{`${photos.length}/${MAX_PHOTOS} fotos`}</span>
                </div>

                {photos.length > 0 && (
                  <ul className="grid grid-cols-3 gap-2 mb-3">
                    {photos.map((p, i) => (
                      <li key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img src={p.url} alt={`Foto ${i + 1} seleccionada`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          disabled={busy}
                          aria-label={`Quitar foto ${i + 1}`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <label
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed text-sm font-semibold transition-colors ${
                    photos.length >= MAX_PHOTOS || busy
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                  }`}
                >
                  <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  Agregar fotos
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    multiple
                    onChange={onPick}
                    disabled={photos.length >= MAX_PHOTOS || busy}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={`${titleId}-caption`} className="text-xs font-semibold text-gray-600">Descripción (opcional)</label>
                  <span className="text-xs text-gray-400">{`${caption.length}/${MAX_CAPTION}`}</span>
                </div>
                <textarea
                  id={`${titleId}-caption`}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                  maxLength={MAX_CAPTION}
                  rows={3}
                  disabled={busy}
                  placeholder="Contá cómo fue la jornada…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                Subí solo fotos tuyas o que tengas permiso para compartir.
              </p>

              {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                >
                  {publishLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
