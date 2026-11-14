import { useState, useEffect, useId } from 'react';
import { Star } from 'lucide-react';
import { api, Rating } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { formatMonthYear, userMessage } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { InlineError } from './LoadError';

interface ReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  avgRating?: number;
  initialRatings?: Rating[];
  canRate?: boolean;
  onReviewAdded?: (newAvg: number, newCount: number) => void;
}

export function ReviewsModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  avgRating,
  initialRatings,
  canRate,
  onReviewAdded,
}: ReviewsModalProps) {
  const { user, openAuthModal } = useAuth();

  const [ratings, setRatings] = useState<Rating[]>(initialRatings || []);
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Formulario de calificación
  const [userScore, setUserScore] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // La reseña propia (el backend hace upsert: una por persona y proyecto). Se busca en la lista recién pedida a
  // GET /projects/:id (desde el feed también llega user_id, pero esa lista puede estar vieja: S3).
  const mine = (list: Rating[]) => (user ? list.find(r => r.user_id === user.id) : undefined);

  // Lista nueva del servidor; si ya calificó, el formulario arranca con su reseña (REVISION S4). Antes arrancaba
  // en 5 ★ y vacío, y mandarlo sin mirar pisaba la reseña anterior (y borraba el comentario).
  const applyRatings = (list: Rating[]) => {
    setRatings(list);
    const own = mine(list);
    if (own) {
      setUserScore(own.rating);
      setUserComment(own.comment || '');
    }
  };

  const loadRatings = async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.projects.get(projectId);
      applyRatings(res.project?.ratings || []);
    } catch (err) {
      // Antes solo se logueaba y el modal decía "Sin reseñas todavía" (REVISION S1, como §65 y §98).
      setLoadError(userMessage(err, 'No pudimos cargar las reseñas. Revisá tu conexión.'));
    } finally {
      setLoading(false);
    }
  };

  // Al abrir, SIEMPRE se recarga (REVISION S3). Antes, con `initialRatings` (el feed) no se pedía nada y se
  // volvía a mostrar esa lista: después de calificar, al reabrir se veía la lista vieja. `initialRatings` queda
  // solo como lo que se muestra mientras llega la respuesta. Recargar es además la única forma de saber si la
  // persona ya calificó (S4). Las dependencias no incluyen `initialRatings` a propósito: un array nuevo del
  // padre no tiene que reiniciar el formulario con el modal abierto.
  useEffect(() => {
    if (isOpen) {
      setRatings(initialRatings || []);
      setUserScore(5);
      setUserComment('');
      setErrorMsg('');
      setSuccessMsg('');
      void loadRatings();
    }
  }, [isOpen, projectId]);

  // Escape y foco: <Modal>. Antes el listener en window cerraba también este modal cuando se apretaba
  // Escape en el login abierto encima ("Iniciá sesión para calificar").

  if (!isOpen) return null;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('Iniciá sesión para calificar');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.projects.rate(projectId, userScore, userComment.trim() || undefined);
      setSuccessMsg('Tu reseña se guardó.');

      // Recargar lista actualizada (el formulario queda con lo que se guardó: ahora es "tu reseña")
      const updated = await api.projects.get(projectId);
      const newRatings = updated.project?.ratings || [];
      applyRatings(newRatings);

      if (onReviewAdded) {
        onReviewAdded(updated.project?.avg_rating || 0, newRatings.length);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar calificación');
    } finally {
      setSubmitting(false);
    }
  };

  const calculatedAvg = ratings.length
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : (avgRating || 0);
  const editing = Boolean(mine(ratings));

  return (
    <Sheet title="Reseñas" titleId={titleId} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-ink-muted truncate -mt-1">{projectTitle}</p>

        {/* El promedio, en grande, con las estrellas y la cantidad. */}
        <div className="flex items-center gap-3">
          <span className="text-[32px] font-extrabold tracking-[-0.5px] leading-none">
            {calculatedAvg > 0 ? calculatedAvg.toFixed(1).replace('.', ',') : '—'}
          </span>
          <div className="flex flex-col gap-0.5">
            <Stars value={Math.round(calculatedAvg)} size={16} />
            <p className="text-[13px] text-ink-soft">
              {loadError ? 'No se pudieron cargar las reseñas'
                : ratings.length === 1 ? '1 reseña en total' : `${ratings.length} reseñas en total`}
            </p>
          </div>
        </div>

        {/* Formulario de calificación (si participó y fue aprobado) */}
        {canRate && (
          <form onSubmit={handleSubmitReview} className="rounded-xl bg-surface-soft p-4 flex flex-col gap-3">
            <p className="text-[15px] font-semibold">{editing
              ? 'Ya calificaste este voluntariado. Podés editar tu reseña.'
              : '¿Participaste en este voluntariado? Dejá tu opinión'}</p>

            <div className="flex items-center gap-1 -ml-2.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  type="button"
                  key={star}
                  aria-label={`${star} estrella${star > 1 ? 's' : ''}`} aria-pressed={star === userScore}
                  onClick={() => setUserScore(star)}
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full active:scale-95 transition-transform"
                >
                  <Star size={26} className={star <= userScore ? 'fill-star text-star' : 'text-border-strong'} aria-hidden="true" />
                </button>
              ))}
              <span className="text-[13px] font-semibold text-ink-soft ml-1">{userScore} de 5</span>
            </div>

            <textarea
              aria-label="Tu reseña"
              value={userComment}
              onChange={e => { setUserComment(e.target.value); setErrorMsg(''); }}
              placeholder="Contá tu experiencia, aprendizajes o qué te pareció la coordinación..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface text-[15px] leading-[1.45] border-[1.5px] border-hairline focus:border-ink outline-none resize-none"
            />

            {errorMsg && <p role="alert" className="text-[13px] text-critical">{errorMsg}</p>}
            {successMsg && <p role="status" className="text-[13px] font-semibold">{successMsg}</p>}

            {/* Mientras cargan no se sabe si ya calificó: mandar ahí pisaría su reseña con 5 ★ (S4). */}
            <Button type="submit" variant="primary" className="self-start" busy={submitting} busyLabel="Guardando…" disabled={loading}>
              {editing ? 'Actualizar reseña' : 'Publicar reseña'}
            </Button>
          </form>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-ink-soft">Reseñas de personas que participaron</h3>

          {/* Si ya hay una lista (la del feed), se sigue viendo mientras se recarga. */}
          {loading && ratings.length === 0 ? (
            <div role="status" aria-label="Cargando reseñas" className="flex flex-col gap-4">
              {[0, 1].map(i => (
                <div key={i} aria-hidden="true" className="flex gap-3">
                  <div className="w-9 h-9 flex-shrink-0 rounded-full skeleton" />
                  <div className="flex-1 flex flex-col gap-2"><div className="h-4 w-1/3 rounded skeleton" /><div className="h-3 w-2/3 rounded skeleton" /></div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <InlineError message={loadError} onRetry={loadRatings} />
          ) : ratings.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[15px] font-semibold">Sin reseñas todavía</p>
              <p className="text-[13px] text-ink-soft mt-1 max-w-xs mx-auto">
                Quienes participen de este voluntariado van a poder calificarlo acá.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {ratings.map(r => {
                const when = formatMonthYear(r.created_at || '');
                return (
                  <li key={r.id} className="flex gap-3">
                    {/* La foto de quien calificó, o sus iniciales si no tiene (§133). */}
                    <Avatar src={r.user_avatar} name={r.user_name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold break-words">{r.user_name}</p>
                      <p className="text-[13px] text-ink-soft break-words">
                        Participó en <span className="font-semibold text-ink">{projectTitle}</span>{when && ` · ${when}`}
                      </p>
                      <Stars value={r.rating} size={14} className="my-1" />
                      {r.comment && <p className="text-[15px] leading-snug text-ink-soft break-words">{r.comment}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Estrellas de solo lectura: el color nunca es la única señal, se leen como "4 de 5". */
function Stars({ value, size, className = '' }: { value: number; size: number; className?: string }) {
  return (
    <div className={`flex gap-0.5 ${className}`} role="img" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star key={star} size={size} className={star <= value ? 'fill-star text-star' : 'text-hairline'} aria-hidden="true" />
      ))}
    </div>
  );
}
