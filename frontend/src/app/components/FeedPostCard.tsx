// Tarjeta de voluntariado (DESIGN.md → Tarjeta de voluntariado). La usan el Inicio (`MainFeed`) y la portada
// pública (`PublicFeed`). Cerrada cuenta en 3 segundos qué es, quién lo hace, dónde, cuánto falta y cómo ayudar;
// "Más información" abre el detalle (roles, costo, comunidad, comentarios).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bell, Check, ChevronDown, Clock, MapPin, Send, Star } from 'lucide-react';
import { FeedProject, AppComment, Rating, api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ReviewsModal } from './ReviewsModal';
import { userMessage, FOLLOW_ERROR } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { LogoMark } from '../ui/Logo';
import { TypeBadge } from '../ui/TypeBadge';
import { Button, ButtonLink } from '../ui/Button';
import { DualGoal, formatMoney } from '../ui/Meter';
import { cardActions } from '../volunteering/cardActions';

interface FeedPostCardProps {
  project: FeedProject;
  onRefresh?: () => void;
  /** Sin sesión (portada): "Inscribirme", "Seguir" y "Donar" abren el ingreso. */
  onRequireAuth?: (message: string) => void;
}

function durationLabel(p: FeedProject): string | null {
  if (p.type === 'fugaz') return p.duration || null;
  if (p.hours_per_week) return `${p.hours_per_week} h por semana`;
  return p.duration || null;
}

export function FeedPostCard({ project, onRefresh }: FeedPostCardProps) {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [isExpanded, setIsExpanded] = useState(false);

  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [currentAvgRating, setCurrentAvgRating] = useState<number>(project.avg_rating || 0);
  const [currentRatingsCount, setCurrentRatingsCount] = useState<number>(
    project.ratings_count !== undefined ? project.ratings_count : (project.ratings?.length || 0)
  );
  const [cardRatings] = useState<Rating[]>(project.ratings || []);

  const [comments, setComments] = useState<AppComment[]>(project.recent_comments || []);
  const [commentsCount, setCommentsCount] = useState<number>(project.comments_count || (project.recent_comments?.length || 0));
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const [enrollment, setEnrollment] = useState(project.my_enrollment_status ?? null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [isFollowing, setIsFollowing] = useState(
    project.follow_source === 'project_follow' || project.follow_source === 'both'
  );
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followersCount, setFollowersCount] = useState(project.followers || 0);

  const actions = cardActions(project, enrollment, user?.role ?? null);
  const ratingValue = currentAvgRating && currentAvgRating > 0 ? Number(currentAvgRating).toFixed(1).replace('.', ',') : null;
  const duration = durationLabel(project);
  const cost = (project.cost_per_person || 0) > 0 ? `${formatMoney(project.cost_per_person)} por persona` : null;
  const titleId = `vc-${project.id}`;
  const detailId = `vc-detail-${project.id}`;

  const handleEnroll = async () => {
    if (!user) {
      openAuthModal('Iniciá sesión para inscribirte como voluntario');
      return;
    }
    if (user.role !== 'volunteer') { navigate(`/project/${project.id}`); return; }
    if (enrolling || actions.join.kind !== 'join') return;

    setEnrolling(true);
    setEnrollMsg(null);
    try {
      await api.enrollments.enroll(project.id);
      setEnrollment('pending');
      setEnrollMsg({ ok: true, text: 'Inscripción enviada. La ONG te responde por notificación.' });
      onRefresh?.();
    } catch (err: any) {
      setEnrollMsg({ ok: false, text: err.message || 'No pudimos inscribirte. Probá de nuevo.' });
    } finally {
      setEnrolling(false);
    }
  };

  const handleDonate = () => {
    if (!user) { openAuthModal('Iniciá sesión para donar'); return; }
    navigate(`/project/${project.id}`);
  };

  const handleToggleProjectFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { openAuthModal('Iniciá sesión para seguir este voluntariado'); return; }
    if (user.role !== 'volunteer' || togglingFollow) return;

    setTogglingFollow(true);
    setFollowError('');
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
      setFollowError(userMessage(err, FOLLOW_ERROR));
    } finally {
      setTogglingFollow(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('Iniciá sesión para comentar'); return; }
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
      setCommentError(err.message || 'No pudimos enviar el comentario.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const showFollow = !user || user.role === 'volunteer';
  const followContext = project.follow_label || (followersCount > 0
    ? `${followersCount} ${followersCount === 1 ? 'persona sigue' : 'personas siguen'} este voluntariado`
    : null);

  return (
    <article aria-labelledby={titleId} className="bg-surface border border-hairline rounded-2xl overflow-hidden">
      {/* ── Foto ───────────────────────────────────────────────────── */}
      <div className="relative aspect-[16/10] bg-surface-soft">
        <Link to={`/project/${project.id}`} aria-label={`Abrir ${project.title}`} tabIndex={-1} className="block w-full h-full">
          {project.image ? (
            <img src={project.image} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="w-full h-full flex items-center justify-center opacity-30" aria-hidden="true"><LogoMark size={56} /></span>
          )}
        </Link>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap max-w-[65%]">
          {project.category && (
            <span className="h-7 px-2.5 rounded-full bg-[var(--photo-chip)] text-[var(--on-photo)] text-xs font-semibold inline-flex items-center">
              {project.category}
            </span>
          )}
          <TypeBadge type={project.type} variant="photo" />
        </div>
        {showFollow && (
          <Button
            variant="photo"
            onClick={handleToggleProjectFollow}
            disabled={togglingFollow}
            aria-pressed={isFollowing}
            title={isFollowing ? 'Dejar de seguir voluntariado' : 'Seguir voluntariado'}
            className="absolute top-2.5 right-2.5"
          >
            <Bell size={16} strokeWidth={1.75} className={isFollowing ? 'fill-current' : ''} aria-hidden="true" />
            {isFollowing ? 'Siguiendo' : 'Seguir'}
          </Button>
        )}
        {followError && (
          <p role="alert" className="absolute top-14 right-2.5 max-w-[75%] px-2.5 py-1.5 rounded-[10px] bg-[var(--photo-chip)] text-xs font-medium text-[#d12d21]">
            {followError}
          </p>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* ── ONG ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 h-8">
          <Link to={`/ngo/${project.ngo_id}`} className="flex items-center gap-2 min-w-0">
            <Avatar src={project.ngo_logo} name={project.ngo_name || 'ONG'} kind="org" size={32} />
            <span className="text-[15px] font-semibold truncate">{project.ngo_name}</span>
          </Link>
        </div>

        {/* ── Título + puntaje ─────────────────────────────────────── */}
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold leading-tight tracking-[-0.2px] line-clamp-2">
            <Link to={`/project/${project.id}`}>{project.title}</Link>
          </h2>
          {ratingValue ? (
            <button type="button" onClick={() => setShowReviewsModal(true)}
              aria-label={`Puntaje ${ratingValue}, ${currentRatingsCount} reseñas. Ver reseñas`}
              className="flex-shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold">
              <Star size={14} className="fill-star text-star" aria-hidden="true" />
              {ratingValue}<span className="text-ink-muted font-normal">({currentRatingsCount})</span>
            </button>
          ) : (
            <span className="flex-shrink-0 text-[13px] text-ink-muted">Nuevo</span>
          )}
        </div>

        <p className="text-[15px] leading-[1.45] text-ink-soft line-clamp-2">{project.description}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-muted">
          {project.location && (
            <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={16} strokeWidth={1.75} aria-hidden="true" className="flex-shrink-0" /><span className="truncate">{project.location}</span></span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1"><Clock size={16} strokeWidth={1.75} aria-hidden="true" />{duration}</span>
          )}
        </div>

        <DualGoal
          fundingGoal={project.funding_goal || 0}
          currentFunding={project.current_funding || 0}
          volunteersNeeded={project.volunteers_needed || 0}
          currentVolunteers={project.current_volunteers || 0}
        />

        {/* ── Detalle (acordeón) ───────────────────────────────────── */}
        <div
          id={detailId}
          className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
          aria-hidden={!isExpanded}
        >
          <div className="overflow-hidden" {...(!isExpanded ? { inert: '' as unknown as boolean } : {})}>
            <div className="flex flex-col gap-4 pt-1 pb-1">
              {followContext && <p className="text-[13px] text-ink-soft">{followContext}</p>}

              {project.roles_needed?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-ink-soft">Roles que se necesitan</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.roles_needed.map(r => (
                      <span key={r} className="h-8 px-3 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-ink-soft">Costo por persona</span>
                <span className="text-[15px] font-bold">{cost ?? 'Sin costo'}</span>
              </div>

              <p className="text-[13px] text-ink-muted">
                {followersCount} {followersCount === 1 ? 'seguidor' : 'seguidores'} · {commentsCount} {commentsCount === 1 ? 'comentario' : 'comentarios'}
              </p>

              {comments.length > 0 && (
                <ul className="flex flex-col gap-2.5">
                  {comments.slice(0, 3).map(c => (
                    <li key={c.id} className="flex gap-2.5">
                      <Avatar src={c.user_avatar} name={c.user_name} size={32} />
                      <div className="min-w-0 text-[15px] leading-snug">
                        <Link to={`/volunteer/${c.user_id}`} className="font-semibold">{c.user_name}</Link>
                        {c.is_participant ? <span className="ml-1.5 text-xs font-semibold text-people-text">Participó</span> : null}
                        <p className="text-ink-soft break-words">{c.comment}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handlePostComment} className="flex items-center gap-2">
                <input
                  aria-label="Comentario"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  maxLength={1000}
                  placeholder="Escribí un comentario…"
                  className="flex-1 min-w-0 h-11 px-4 rounded-full bg-surface-soft text-[15px] outline-none focus:bg-surface focus:ring-[1.5px] focus:ring-ink"
                />
                <button type="submit" disabled={!newComment.trim() || submittingComment} aria-label="Enviar comentario"
                  className="w-11 h-11 rounded-full inline-flex items-center justify-center text-ink disabled:opacity-40">
                  <Send size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </form>
              {commentError && <p role="alert" className="text-[13px] text-critical">{commentError}</p>}

              <Link to={`/project/${project.id}`} className="text-[15px] font-semibold">Ver página completa →</Link>
            </div>
          </div>
        </div>

        {/* ── Acciones ─────────────────────────────────────────────── */}
        {enrollMsg && (
          <p role={enrollMsg.ok ? 'status' : 'alert'} className={`text-[13px] font-medium ${enrollMsg.ok ? 'text-people-text' : 'text-critical'}`}>
            {enrollMsg.text}
          </p>
        )}
        <div className="flex gap-2">
          <JoinButton action={actions.join} busy={enrolling} onJoin={handleEnroll} projectId={project.id} />
          <DonateButton action={actions.donate} onDonate={handleDonate} fullWidth={actions.join.kind === 'hidden'} />
        </div>

        <button type="button" onClick={() => setIsExpanded(v => !v)} aria-expanded={isExpanded} aria-controls={detailId}
          className="h-11 -my-1 inline-flex items-center justify-center gap-1 text-[15px] font-semibold">
          {isExpanded ? 'Menos información' : 'Más información'}
          <ChevronDown size={16} strokeWidth={1.75} className={`transition-transform duration-[220ms] ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <ReviewsModal
        isOpen={showReviewsModal}
        onClose={() => setShowReviewsModal(false)}
        projectId={project.id}
        projectTitle={project.title}
        avgRating={currentAvgRating}
        initialRatings={cardRatings}
        canRate={enrollment === 'approved'}
        onReviewAdded={(avg, count) => { setCurrentAvgRating(avg); setCurrentRatingsCount(count); }}
      />
    </article>
  );
}

import type { JoinAction, DonateAction } from '../volunteering/cardActions';

export function JoinButton({ action, busy, onJoin, projectId, block = true }:
  { action: JoinAction; busy?: boolean; onJoin: () => void; projectId: string; block?: boolean }) {
  const cls = block ? 'flex-1' : '';
  switch (action.kind) {
    case 'join':
      return <Button variant="join" busy={busy} busyLabel="Enviando…" onClick={onJoin} className={cls}>Inscribirme</Button>;
    case 'pending':
      return <Button variant="secondary" disabled className={`${cls} h-12 rounded-[12px]`}><Clock size={16} strokeWidth={1.75} aria-hidden="true" />Postulado</Button>;
    case 'accepted':
      return (
        <span className={`${cls} h-12 rounded-[12px] bg-people-soft text-people-text text-[15px] font-bold inline-flex items-center justify-center gap-1.5`}>
          <Check size={18} strokeWidth={2.25} aria-hidden="true" />Vas a ir
        </span>
      );
    case 'rejected':
      return <Button variant="secondary" disabled className={`${cls} h-12 rounded-[12px]`}>No seleccionado</Button>;
    case 'full':
      return <Button variant="secondary" disabled className={`${cls} h-12 rounded-[12px]`}>Cupos completos</Button>;
    case 'past':
      return <ButtonLink to={`/project/${projectId}`} variant="secondary" className={`${cls} h-12 rounded-[12px]`}>Ver cómo salió</ButtonLink>;
    default:
      return null;
  }
}

export function DonateButton({ action, onDonate, fullWidth }: { action: DonateAction; onDonate: () => void; fullWidth?: boolean }) {
  const cls = fullWidth ? 'w-full' : 'flex-1';
  if (action.kind === 'donate') return <Button variant="donate" onClick={onDonate} className={cls}>Donar</Button>;
  if (action.kind === 'goal-met') {
    return (
      <Button variant="donate" onClick={onDonate} className={`${cls} !bg-brand-soft !text-brand-text`}>
        <Check size={18} strokeWidth={2.25} aria-hidden="true" />Meta cumplida
      </Button>
    );
  }
  return null;
}
