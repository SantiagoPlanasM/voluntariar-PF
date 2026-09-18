import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MapPin, Calendar, Briefcase, DollarSign, Users,
  Star, MessageSquare, ChevronDown, ChevronUp,
  Send, Zap, CheckCircle2, Loader2, Bookmark
} from 'lucide-react';
import { FeedProject, AppComment, Rating, api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ReviewsModal } from './ReviewsModal';

interface FeedPostCardProps {
  project: FeedProject;
  onRefresh?: () => void;
}

function safePct(a: any, b: any) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!nb || isNaN(na) || isNaN(nb)) return 0;
  return Math.min(100, Math.round((na / nb) * 100));
}

function safeMoney(val: any) {
  const n = parseFloat(val);
  return isNaN(n) ? '$0' : '$' + n.toLocaleString('es-AR');
}

export function FeedPostCard({ project, onRefresh }: FeedPostCardProps) {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  // Acordeón: arranca colapsado por defecto según el diseño
  const [isExpanded, setIsExpanded] = useState(false);

  // Modal de reseñas emergente
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [currentAvgRating, setCurrentAvgRating] = useState<number>(project.avg_rating || 0);
  const [currentRatingsCount, setCurrentRatingsCount] = useState<number>(
    project.ratings_count !== undefined ? project.ratings_count : (project.ratings?.length || 0)
  );
  const [cardRatings, setCardRatings] = useState<Rating[]>(project.ratings || []);

  const [comments, setComments] = useState<AppComment[]>(project.recent_comments || []);
  const [commentsCount, setCommentsCount] = useState<number>(project.comments_count || (project.recent_comments?.length || 0));
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const [enrolled, setEnrolled] = useState(
    project.my_enrollment_status === 'approved' || project.my_enrollment_status === 'pending'
  );
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

  const [isFollowing, setIsFollowing] = useState(
    project.follow_source === 'project_follow' || project.follow_source === 'both'
  );
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [followersCount, setFollowersCount] = useState(project.followers || 0);

  const fundPct = safePct(project.current_funding, project.funding_goal);
  const volPct = safePct(project.current_volunteers, project.volunteers_needed);
  const hasFunding = (project.funding_goal || 0) > 0;
  const ratingValue = currentAvgRating && currentAvgRating > 0 ? Number(currentAvgRating).toFixed(1) : null;

  const handleEnroll = async () => {
    if (!user) {
      openAuthModal('Iniciá sesión para inscribirte como voluntario');
      return;
    }
    if (user.role !== 'volunteer') {
      navigate(`/project/${project.id}`);
      return;
    }
    if (enrolled || enrolling) return;

    setEnrolling(true);
    setEnrollMsg('');
    try {
      await api.enrollments.enroll(project.id);
      setEnrolled(true);
      setEnrollMsg('¡Inscripción enviada con éxito!');
      onRefresh?.();
    } catch (err: any) {
      setEnrollMsg(err.message || 'Error al inscribirse');
    } finally {
      setEnrolling(false);
    }
  };

  const handleToggleProjectFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('Iniciá sesión para seguir este voluntariado');
      return;
    }
    if (user.role !== 'volunteer' || togglingFollow) return;

    setTogglingFollow(true);
    try {
      if (isFollowing) {
        const res = await api.follows.unfollowProject(project.id);
        setIsFollowing(false);
        setFollowersCount(res.followers);
      } else {
        const res = await api.follows.followProject(project.id);
        setIsFollowing(true);
        setFollowersCount(res.followers);
      }
    } catch (err) {
      console.error('Error toggling project follow', err);
    } finally {
      setTogglingFollow(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('Iniciá sesión para comentar');
      return;
    }
    if (!newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    setCommentError('');
    try {
      const res = await api.projects.comment(project.id, newComment.trim());
      if (res.comment) {
        setComments(prev => [res.comment, ...prev]);
        setCommentsCount(c => c + 1);
        setNewComment('');
      }
    } catch (err: any) {
      setCommentError(err.message || 'Error al enviar comentario');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReviewAdded = (newAvg: number, newCount: number) => {
    setCurrentAvgRating(newAvg);
    setCurrentRatingsCount(newCount);
  };

  // Label de contexto de seguimiento o prueba social
  const getFollowContext = () => {
    if (project.follow_label) {
      return project.follow_label;
    }
    if (followersCount > 0) {
      return `Seguido por ${followersCount} persona${followersCount === 1 ? '' : 's'}`;
    }
    return 'Organización en Voluntariar';
  };

  return (
    <article className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden mb-6 transition-shadow hover:shadow-md">
      {/* ── 1. Hero Image con Badges ────────────────────────────────────────── */}
      <div className="relative w-full h-64 sm:h-72 bg-gray-100 overflow-hidden group">
        <img
          src={project.image || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80'}
          alt={project.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

        {/* Badges superiores izquierda: Categoría y Tipo */}
        <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap z-10">
          <span className="px-3 py-1 bg-white/95 backdrop-blur-sm rounded-full text-xs font-bold text-gray-800 shadow-sm">
            {project.category || 'Comunidad'}
          </span>
          {project.type === 'fugaz' ? (
            <span className="px-3 py-1 bg-blue-600/95 backdrop-blur-sm rounded-full text-xs font-semibold text-white flex items-center gap-1 shadow-sm">
              <Zap className="w-3.5 h-3.5 fill-current" />
              Fugaz
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-700/95 backdrop-blur-sm rounded-full text-xs font-semibold text-white flex items-center gap-1 shadow-sm">
              <Calendar className="w-3.5 h-3.5" />
              Sostenido
            </span>
          )}
        </div>

        {/* Botón Seguir / Bookmark voluntariado en esquina superior derecha */}
        {user?.role === 'volunteer' && (
          <button
            onClick={handleToggleProjectFollow}
            disabled={togglingFollow}
            title={isFollowing ? 'Dejar de seguir voluntariado' : 'Seguir este voluntariado'}
            className={`absolute top-4 right-4 w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all z-10 ${
              isFollowing
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white/80 hover:bg-white text-gray-700 shadow-sm'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* ── 2. Contenido del Post ───────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* ONG Header */}
        <div className="flex items-center gap-3">
          <Link
            to={`/ngo/${project.ngo_id}`}
            className="flex-shrink-0 group/avatar"
          >
            {project.ngo_logo ? (
              <img
                src={project.ngo_logo}
                alt={project.ngo_name || 'ONG'}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100 group-hover/avatar:ring-emerald-500 transition-all"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm ring-2 ring-gray-100">
                {project.ngo_name?.[0] || 'O'}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to={`/ngo/${project.ngo_id}`}
              className="font-bold text-gray-900 text-base hover:text-emerald-700 transition-colors block truncate"
            >
              {project.ngo_name || 'Organización'}
            </Link>
            {/* Social proof: visible en el post expandido según el diseño de Figma */}
            {isExpanded && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="truncate">{getFollowContext()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Título & Rating con Acordeón */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
            <Link to={`/project/${project.id}`} className="hover:text-emerald-800 transition-colors">
              {project.title}
            </Link>
          </h2>

          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            {/* ⭐ Estrellas / Calificación: Al tocarlas se abre el pop up de reseñas */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviewsModal(true);
              }}
              className="inline-flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100/90 active:scale-95 px-2 py-0.5 rounded-lg border border-amber-200/60 transition-all cursor-pointer shadow-2xs"
              title="Ver reseñas de la comunidad"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{ratingValue || 'Nuevo'}</span>
            </button>

            {/* Chevron para abrir / cerrar acordeón */}
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              aria-label={isExpanded ? 'Colapsar detalles' : 'Expandir detalles'}
              className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Descripción corta */}
        <p className="text-sm text-gray-600 leading-relaxed">
          {project.description}
        </p>

        {/* Metadata básica: Ubicación y Duración */}
        <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-600 font-medium pt-1">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {project.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {project.type === 'fugaz'
              ? (project.duration || 'Fugaz')
              : (project.hours_per_week ? `${project.hours_per_week} hs/semana` : 'Sostenido')}
          </span>
        </div>

        {/* Barras de Progreso: Financiamiento y Voluntarios (SIEMPRE visibles en el post, como en Figma) */}
        <div className="space-y-3 pt-1">
          {hasFunding && (
            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-gray-600 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                  Financiamiento
                </span>
                <span className="text-blue-700 font-bold">
                  {safeMoney(project.current_funding)} / {safeMoney(project.funding_goal)}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${fundPct}%` }}
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center text-xs font-semibold mb-1">
              <span className="text-gray-600 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                Voluntarios
              </span>
              <span className="text-[#2f4f2f] font-bold">
                {project.current_volunteers || 0} / {project.volunteers_needed || 0}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3d6139] rounded-full transition-all duration-500"
                style={{ width: `${volPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── 3. Sección Expandible (Acordeón que se abre con el Chevron) ──────── */}
        {isExpanded && (
          <div className="space-y-4 pt-3 border-t border-gray-100 animate-fadeIn">
            {/* Roles Necesitados */}
            {project.roles_needed && project.roles_needed.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-2">
                  <Briefcase className="w-3.5 h-3.5 text-gray-500" />
                  <span>Roles necesitados:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {project.roles_needed.map((role, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-[#f0f6ee] text-[#2f4f2f] text-xs font-semibold rounded-full border border-[#dce8d9]"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Costo por persona */}
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-gray-600 font-medium">Costo por persona:</span>
              <span className="font-extrabold text-[#2f4f2f] text-base">
                {(project.cost_per_person || 0) === 0 ? 'Gratis' : safeMoney(project.cost_per_person)}
              </span>
            </div>

            {/* Fila de Estadísticas: Calificación (clickeable), Seguidores, Comentarios */}
            <div className="flex items-center justify-between py-2 border-y border-gray-100 text-xs font-semibold text-gray-500">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReviewsModal(true);
                }}
                className="flex items-center gap-1 text-gray-700 hover:text-amber-600 font-bold transition-colors cursor-pointer"
                title="Ver reseñas de la comunidad"
              >
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{ratingValue || 'Nuevo'}</span>
                {currentRatingsCount > 0 && (
                  <span className="text-gray-400 font-normal">({currentRatingsCount})</span>
                )}
              </button>

              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{followersCount} seguidores</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span>Comentarios ({commentsCount})</span>
              </div>
            </div>

            {/* Comentarios Inline */}
            <div className="space-y-2.5">
              {comments.length > 0 ? (
                <div className="space-y-2">
                  {comments.slice(0, 3).map(c => (
                    <div
                      key={c.id}
                      className="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-xs space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        {c.user_avatar ? (
                          <img
                            src={c.user_avatar}
                            alt={c.user_name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-[10px]">
                            {c.user_name?.[0] || 'U'}
                          </div>
                        )}
                        <span className="font-bold text-gray-900">{c.user_name}</span>
                        {Boolean(c.is_participant) && (
                          <span className="px-2 py-0.5 bg-[#e4f1e0] text-[#255f24] text-[10px] font-bold rounded-md tracking-wide">
                            Participó
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 pl-8 leading-relaxed">{c.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-1">
                  Sé el primero en dejar un comentario sobre este voluntariado.
                </p>
              )}

              {/* Formulario de Comentario Rápido */}
              <form onSubmit={handlePostComment} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Escribí un comentario..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 bg-gray-100 hover:bg-gray-100/80 focus:bg-white text-xs px-3.5 py-2.5 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                  title="Enviar comentario"
                >
                  {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </form>
              {commentError && (
                <p className="text-[11px] text-red-600 px-1 font-medium">{commentError}</p>
              )}
            </div>

            {/* Enlace "Ver detalles completos →" */}
            <div className="text-center pt-1">
              <Link
                to={`/project/${project.id}`}
                className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1"
              >
                Ver detalles completos →
              </Link>
            </div>

            {/* Mensaje de estado de inscripción */}
            {enrollMsg && (
              <p
                className={`text-xs px-3.5 py-2 rounded-xl font-medium text-center ${
                  enrolled ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-600'
                }`}
              >
                {enrollMsg}
              </p>
            )}

            {/* Botón Principal CTA: "Inscribirse" */}
            <button
              onClick={handleEnroll}
              disabled={enrolling || enrolled}
              className={`w-full py-3 rounded-2xl font-bold text-sm text-center transition-all shadow-sm flex items-center justify-center gap-2 ${
                enrolled
                  ? 'bg-gray-100 text-gray-500 cursor-default'
                  : 'bg-[#2f4f2f] hover:bg-[#253f25] text-white active:scale-[0.99] shadow-emerald-900/10 cursor-pointer'
              }`}
            >
              {enrolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Inscribiendo...</span>
                </>
              ) : enrolled ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Inscripto / Solicitud enviada</span>
                </>
              ) : (
                'Inscribirse'
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Modal Pop-Up de Reseñas ───────────────────────────────────────── */}
      <ReviewsModal
        isOpen={showReviewsModal}
        onClose={() => setShowReviewsModal(false)}
        projectId={project.id}
        projectTitle={project.title}
        avgRating={currentAvgRating}
        initialRatings={cardRatings}
        canRate={project.my_enrollment_status === 'approved'}
        onReviewAdded={handleReviewAdded}
      />
    </article>
  );
}
