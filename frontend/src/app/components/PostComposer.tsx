// src/app/components/PostComposer.tsx
//
// Nueva publicación (DESIGN.md → Crear): elegir el voluntariado, hasta 5 fotos (con vista previa) y un texto de
// hasta 500 caracteres. Las fotos se comprimen EN EL NAVEGADOR (lib/imageCompress.ts) recién al publicar, así la
// vista previa es instantánea; si alguna no se puede procesar no se sube nada.
//
// Los límites (5 fotos, 500 caracteres) deben coincidir con los de backend/src/routes/posts.js.
// El diálogo no se cierra solo al publicar: avisa con `onCreated(post)` y quien lo abrió decide (hasta entonces
// el botón queda bloqueado, para que un segundo clic no publique dos veces).
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { X, ImagePlus } from 'lucide-react';
import { api, type EligibleProject, type Post } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ACCEPTED_TYPES, compressImage } from '../../lib/imageCompress';
import { userMessage } from '../../lib/format';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/UiProvider';

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
  const confirm = useConfirm();
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

  async function requestClose() {
    if (busy) return;
    if (dirty) {
      const ok = await confirm({
        title: '¿Descartar esta publicación?',
        body: 'Se pierden las fotos y el texto.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
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
    ? 'Todavía no tenés voluntariados. Creá un voluntariado y después compartí sus novedades.'
    : 'Para publicar necesitás tener una inscripción aprobada en algún voluntariado.';
  const ready = projects !== null && projects.length > 0;
  const field = 'w-full rounded-[10px] bg-surface-soft px-3.5 text-[15px] text-ink border-[1.5px] border-transparent focus:bg-surface focus:border-ink outline-none disabled:opacity-60';

  return (
    // Escape y la X pasan por requestClose (pregunta si hay fotos y no cierra mientras publica).
    <Sheet
      title="Nueva publicación"
      titleId={titleId}
      onClose={requestClose}
      closeOnOverlay={false}
      closeDisabled={busy}
      footer={ready ? (
        <div className="flex flex-col gap-2">
          {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={requestClose} disabled={busy} className="!h-12">Cancelar</Button>
            <Button variant="primary" onClick={submit} disabled={!canSubmit} busy={busy} busyLabel={publishLabel} className="!h-12 flex-1">
              Publicar
            </Button>
          </div>
        </div>
      ) : undefined}
    >
      <div className="flex flex-col gap-5">
        {projects === null && !loadError && (
          <p role="status" className="text-[15px] text-ink-soft">Cargando tus voluntariados…</p>
        )}

        {loadError && (
          <div className="flex flex-col gap-2 items-start">
            <p role="alert" className="text-[15px] text-critical">{loadError}</p>
            <Button variant="secondary" onClick={retryLoad}>Reintentar</Button>
          </div>
        )}

        {projects !== null && projects.length === 0 && (
          <div className="flex flex-col gap-3 items-start">
            <p className="text-[15px] leading-[1.45] text-ink-soft">{noProjectsMessage}</p>
            <Button variant="secondary" onClick={requestClose}>Cerrar</Button>
          </div>
        )}

        {ready && (
          <>
            <p className="text-[15px] leading-[1.45] text-ink-soft">Cada publicación cuenta una acción. Elegí de cuál es.</p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${titleId}-project`} className="text-xs font-semibold text-ink-soft">Voluntariado</label>
              <select
                id={`${titleId}-project`}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={busy}
                className={`${field} h-12`}
              >
                <option value="">Elegí un voluntariado</option>
                {projects!.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-soft">Fotos</span>
                <span className="text-[13px] text-ink-muted">{`${photos.length}/${MAX_PHOTOS} fotos`}</span>
              </div>

              {photos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <li key={p.id} className="relative aspect-[4/5] rounded-xl overflow-hidden bg-surface-soft">
                      <img src={p.url} alt={`Foto ${i + 1} seleccionada`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        disabled={busy}
                        aria-label={`Quitar foto ${i + 1}`}
                        className="absolute top-1 right-1 w-8 h-8 rounded-full bg-[var(--photo-chip-dark)] text-white flex items-center justify-center disabled:opacity-40"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label
                className={`inline-flex self-start items-center gap-2 h-11 px-4 rounded-[10px] text-[15px] font-bold transition-colors ${
                  photos.length >= MAX_PHOTOS || busy
                    ? 'bg-surface-soft text-ink-muted opacity-60 cursor-not-allowed'
                    : 'bg-surface-soft text-ink hover:bg-surface-pressed cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2'
                }`}
              >
                <ImagePlus className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
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

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={`${titleId}-caption`} className="text-xs font-semibold text-ink-soft">Descripción (opcional)</label>
                <span className="text-[13px] text-ink-muted">{`${caption.length}/${MAX_CAPTION}`}</span>
              </div>
              <textarea
                id={`${titleId}-caption`}
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                maxLength={MAX_CAPTION}
                rows={3}
                disabled={busy}
                placeholder="Contá cómo fue la jornada…"
                className={`${field} py-3 resize-none`}
              />
            </div>

            <p className="text-[13px] leading-snug text-ink-muted">
              Subí solo fotos tuyas o que tengas permiso para compartir.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
