import { useState, useEffect, useId } from 'react';
import { X, Star, Loader2, MessageSquare, CheckCircle2, UserCheck } from 'lucide-react';
import { api, Rating } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { userMessage } from '../../lib/format';
import { Modal } from './Modal';
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

  // La reseña propia (el backend hace upsert: una por persona y proyecto). Solo la trae GET /projects/:id: las
  // reseñas que llegan en el feed no tienen user_id.
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
      loadRatings();
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
      setSuccessMsg('¡Tu calificación se guardó correctamente!');

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
    <Modal onClose={onClose} labelledBy={titleId}
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden"
    >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h3 id={titleId} className="text-lg font-black text-gray-900 leading-tight">
              Reseñas y Calificaciones
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5 line-clamp-1">
              {projectTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Contenido con Scroll ────────────────────────────────────────── */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Resumen de Calificación */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/60 border border-amber-100/80">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-amber-500">
                {calculatedAvg > 0 ? calculatedAvg.toFixed(1) : '—'}
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(calculatedAvg)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-amber-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {loadError ? 'No se pudieron cargar las reseñas'
                    : ratings.length === 1 ? '1 reseña en total' : `${ratings.length} reseñas en total`}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full">
              {calculatedAvg >= 4.5 ? 'Excelente' : calculatedAvg >= 3.5 ? 'Muy bueno' : calculatedAvg > 0 ? 'Aceptable' : 'Sin calificar'}
            </span>
          </div>

          {/* Formulario de Calificación (si es participante aprobado) */}
          {canRate && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100/90 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>{editing
                  ? 'Ya calificaste este voluntariado. Podés editar tu reseña.'
                  : '¿Participaste en este voluntariado? Dejá tu opinión'}</span>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">Puntuación:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        aria-label={`${star} estrella${star > 1 ? 's' : ''}`} aria-pressed={star === userScore}
                        onClick={() => setUserScore(star)}
                        className="p-1 hover:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= userScore
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-gray-700 ml-1">
                    {userScore} / 5
                  </span>
                </div>

                <textarea
                  aria-label="Tu reseña"
                  value={userComment}
                  onChange={e => { setUserComment(e.target.value); setErrorMsg(''); }}
                  placeholder="Contá tu experiencia, aprendizajes o qué te pareció la coordinación..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-white text-xs rounded-xl border border-gray-200 focus:border-emerald-500 focus:outline-none resize-none"
                />

                {errorMsg && (
                  <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
                )}
                {successMsg && (
                  <p className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{successMsg}</span>
                  </p>
                )}

                <button
                  type="submit"
                  // Mientras cargan no se sabe si ya calificó: mandar ahí pisaría su reseña con 5 ★ (S4).
                  disabled={submitting || loading}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editing ? 'Actualizar reseña' : 'Publicar reseña'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Lista de Reseñas */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Todas las reseñas
            </h4>

            {/* Si ya hay una lista (la del feed), se sigue viendo mientras se recarga. */}
            {loading && ratings.length === 0 ? (
              <div className="py-8 flex items-center justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : loadError ? (
              <InlineError message={loadError} onRetry={loadRatings} />
            ) : ratings.length === 0 ? (
              <div className="py-8 text-center bg-gray-50 rounded-2xl border border-gray-100 p-4">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600">Sin reseñas todavía</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  Los voluntarios que participen y completen este voluntariado podrán calificarlo acá.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ratings.map(r => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          {r.user_name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{r.user_name}</span>
                            <span className="px-1.5 py-0.5 bg-[#e4f1e0] text-[#255f24] text-[10px] font-bold rounded">
                              Participó
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Estrellas */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= r.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {r.comment && (
                      <p className="text-gray-600 leading-relaxed pl-9">
                        {r.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
    </Modal>
  );
}
