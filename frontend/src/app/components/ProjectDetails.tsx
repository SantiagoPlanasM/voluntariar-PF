// Página del voluntariado (DESIGN.md → Página del voluntariado): foto grande, datos ordenados y los botones
// siempre a mano (barra fija abajo en el celular, caja fija a la derecha en escritorio). Los bloques son
// secciones apiladas con un título cada una; no hay tarjetas dentro de tarjetas.
import { useParams, useNavigate, Link } from 'react-router';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ArrowLeft, Briefcase, Check, Clock, Laptop, Globe, MapPin, Send, Share2, Star, Bell,
} from 'lucide-react';
import { api, ProjectDetail } from '../../lib/api';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { hasBadWord } from '../../lib/badWords';
import { LoadError, describeLoadError } from './LoadError';
import { useAuth } from '../../lib/AuthContext';
import { MomentsGrid } from './MomentsGrid';
import { DonateModal } from './DonateModal';
import { Avatar } from '../ui/Avatar';
import { Button, ButtonLink } from '../ui/Button';
import { DualGoal, formatMoney } from '../ui/Meter';
import { LogoMark } from '../ui/Logo';
import { TypeBadge } from '../ui/TypeBadge';
import { useToast } from '../ui/UiProvider';
import { JoinButton } from './FeedPostCard';
import { cardActions } from '../volunteering/cardActions';
import { isRemote } from '../volunteering/isRemote';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="py-6 border-t border-hairline flex flex-col gap-3">
      <h2 id={id} className="text-lg font-bold tracking-[-0.2px]">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="h-7 px-2.5 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center gap-1">{children}</span>;
}

export function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, openAuthModal } = useAuth();
  const [project, setProject]     = useState<ProjectDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [showDonate, setShowDonate] = useState(false);   // modal "Donar" (§172)
  const [comment, setComment]     = useState('');
  const [commenting, setCommenting] = useState(false);
  const [commentErr, setCommentErr] = useState('');

  // Seguir voluntariado
  const [isFollowing, setIsFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);

  // Calificar voluntariado
  const [userRating, setUserRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingMsg, setRatingMsg] = useState('');
  const [ratingErr, setRatingErr] = useState('');

  // Reseña propia: el backend hace upsert, así que si ya calificó se precargan su puntaje y comentario
  // (antes arrancaba en 5 ★ y vacío y mandar sin mirar la pisaba; mismo arreglo que ReviewsModal, §112).
  // Se precarga UNA vez por proyecto (y otra después de guardar), no en cada recarga: comentar o reintentar
  // también llaman a load(), y eso no tiene que pisar lo que la persona está escribiendo. Si toca el
  // formulario antes de que llegue la precarga (p. ej. la sesión se confirma tarde), gana lo que escribió.
  const prefillPending = useRef(true);

  // Solo vale la respuesta del último pedido (al cambiar de :id, reintentar o recargar tras una acción): REVISION F15, §89.
  const latest = useLatestRequest();
  useEffect(() => {
    if (!id) return;
    // Otro proyecto con el componente montado: el formulario del anterior no sirve.
    setUserRating(5); setRatingComment(''); setRatingMsg(''); setRatingErr('');
    prefillPending.current = true;
    void load(id);
  }, [id]);

  // useLayoutEffect, no useEffect: la precarga se aplica antes de pintar. Con useEffect había un render con el
  // proyecto ya cargado y el formulario todavía en 5 ★ (un parpadeo, y un test que a veces lo leía; §241).
  useLayoutEffect(() => {
    if (!prefillPending.current || !project || project.id !== id || !user) return;
    prefillPending.current = false;
    const own = project.ratings.find(r => r.user_id === user.id);
    if (own) { setUserRating(own.rating); setRatingComment(own.comment ?? ''); }
  }, [project, user?.id]);

  const load = async (pid: string) => {
    const req = latest.start();
    setLoading(true);
    setLoadError(null);
    try {
      const [projRes, followRes] = await Promise.all([
        api.projects.get(pid),
        api.follows.projectStatus(pid).catch(() => ({ following: false })),
      ]);
      if (!latest.isLatest(req)) return;
      setProject(projRes.project);
      setIsFollowing(followRes.following);
    }
    catch (e) { if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos este voluntariado')); }
    finally { if (latest.isLatest(req)) setLoading(false); }
  };

  const handleToggleFollow = async () => {
    if (!user) {
      openAuthModal('Iniciá sesión para seguir este voluntariado');
      return;
    }
    if (user.role !== 'volunteer' || !project || togglingFollow) return;
    setTogglingFollow(true);
    try {
      if (isFollowing) {
        await api.follows.unfollowProject(project.id);
        setIsFollowing(false);
      } else {
        await api.follows.followProject(project.id);
        setIsFollowing(true);
      }
    } catch (e) {
      toast('No pudimos actualizar el seguimiento. Probá de nuevo.', { kind: 'error' });
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) { openAuthModal('Iniciá sesión para inscribirte'); return; }
    setEnrolling(true); setEnrollMsg('');
    try { await api.enrollments.enroll(id!); setEnrollMsg('Inscripción enviada.'); void load(id!); }
    catch (e: any) { setEnrollMsg(e.message); }
    finally { setEnrolling(false); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: project?.title, url }); return; }
      await navigator.clipboard.writeText(url);
      toast('Link copiado');
    } catch { /* la persona canceló */ }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('Iniciá sesión para comentar'); return; }
    const c = comment.trim();
    if (!c || c.length < 3) { setCommentErr('Muy corto'); return; }
    if (hasBadWord(c)) { setCommentErr('Contiene palabras no permitidas'); return; }
    setCommenting(true); setCommentErr('');
    try { await api.projects.comment(id!, c); setComment(''); void load(id!); }
    catch (e: any) { setCommentErr(e.message); }
    finally { setCommenting(false); }
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { openAuthModal('Iniciá sesión para calificar'); return; }
    if (!id || submittingRating) return;
    setSubmittingRating(true);
    setRatingMsg('');
    setRatingErr('');
    try {
      await api.projects.rate(id, userRating, ratingComment.trim() || undefined);
      setRatingMsg('¡Calificación guardada con éxito!');
      // No se vacía: al recargar, el formulario muestra lo que guardó el servidor (que ahora es "tu reseña").
      prefillPending.current = true;
      void load(id);
    } catch (err: any) {
      setRatingErr(err.message || 'Error al calificar');
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) return (
    <div role="status" aria-label="Cargando voluntariado" className="flex flex-col">
      <div className="aspect-[4/3] md:aspect-[16/6] skeleton" />
      <div className="p-4 flex flex-col gap-3"><div className="h-6 w-2/3 rounded skeleton" /><div className="h-4 w-1/3 rounded skeleton" /><div className="h-24 rounded-xl skeleton" /></div>
    </div>
  );
  if (loadError || !project) return (
    <LoadError message={loadError?.message ?? 'No encontramos este voluntariado'}
      onRetry={loadError?.retry && id ? () => load(id) : undefined} home="/" />
  );

  const hasFunding = (project.funding_goal || 0) > 0;
  // Solo GET /projects/:id trae user_id en las reseñas (§112); sin sesión ninguna es propia.
  const hasOwnRating = !!user && project.ratings.some(r => r.user_id === user.id);
  const remote = isRemote(project);
  const hoursLabel = project.type === 'fugaz'
    ? (project.duration || 'Sin especificar')
    : (project.hours_per_week ? `${project.hours_per_week} h por semana` : 'No especificado');
  const avg = project.avg_rating ? Number(project.avg_rating).toFixed(1).replace('.', ',') : null;
  const spotsLeft = Math.max(0, (project.volunteers_needed || 0) - (project.current_volunteers || 0));
  const active = project.status === 'active';
  const goalMet = hasFunding && project.current_funding >= project.funding_goal;
  const canDonate = active && user?.role !== 'ngo' && !!project.accepts_donations;
  const actions = cardActions(project, project.my_enrollment?.status ?? null, user?.role ?? null);
  const mapsHref = project.latitude != null && project.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}` : null;

  /** Los botones de acción: se dibujan en la barra fija (celular) y en la caja de la derecha (escritorio). */
  const ActionButtons = () => {
    if (user?.role === 'company') {
      return (
        <div className="flex gap-2 w-full">
          <ButtonLink
            // ?proponer: el perfil abre "Proponer" con este proyecto ya elegido (REVISION F6)
            to={`/company/profile?proponer=${encodeURIComponent(project.id)}`}
            variant="secondary" className="flex-1 h-12 rounded-[12px]">
            <Briefcase size={16} strokeWidth={1.75} aria-hidden="true" />Patrocinar este proyecto
          </ButtonLink>
          {canDonate && <Button variant="donate" onClick={() => setShowDonate(true)} className="flex-1">Donar</Button>}
        </div>
      );
    }
    if (user?.role === 'ngo') {
      // Solo a la ONG dueña: antes se ofrecía a cualquier ONG y el panel de un proyecto ajeno daba 403
      // (REVISION F16). can_manage lo calcula el backend.
      return project.can_manage ? (
        <ButtonLink to={`/ngo/dashboard/project/${project.id}`} variant="primary" block className="h-12 rounded-[12px]">Ver en el panel</ButtonLink>
      ) : null;
    }
    return (
      <div className="flex gap-2 w-full">
        <JoinButton action={actions.join} busy={enrolling} onJoin={handleEnroll} projectId={project.id} />
        {canDonate && (
          <Button variant="donate" onClick={() => (user ? setShowDonate(true) : openAuthModal('Iniciá sesión para donar'))}
            className={`flex-1 ${goalMet ? '!bg-brand-soft !text-brand-text' : ''}`}>
            {goalMet ? <><Check size={18} strokeWidth={2.25} aria-hidden="true" />Meta cumplida</> : 'Donar'}
          </Button>
        )}
      </div>
    );
  };

  const enrollNotice = enrollMsg && (
    <p role={enrollMsg === 'Inscripción enviada.' ? 'status' : 'alert'}
      className={`text-[13px] font-medium ${enrollMsg === 'Inscripción enviada.' ? 'text-people-text' : 'text-critical'}`}>
      {enrollMsg}
    </p>
  );
  const noDonations = active && user?.role !== 'ngo' && !project.accepts_donations && (
    <p className="text-[13px] text-ink-muted">Esta ONG todavía no recibe donaciones</p>
  );

  const goalBlock = (
    <>
      <DualGoal
        fundingGoal={project.funding_goal || 0}
        currentFunding={project.current_funding || 0}
        volunteersNeeded={project.volunteers_needed || 0}
        currentVolunteers={project.current_volunteers || 0}
        large
      />
      {active && project.volunteers_needed > 0 && (
        <p className="text-[13px] text-ink-muted">{spotsLeft === 0 ? 'No quedan lugares' : `Quedan ${spotsLeft} ${spotsLeft === 1 ? 'lugar' : 'lugares'}`}</p>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-24 md:pb-10">
      <div className="max-w-[1040px] mx-auto md:px-6 md:pt-6">
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8 md:items-start">

          {/* ── Columna principal ──────────────────────────────────── */}
          <div className="bg-canvas md:rounded-2xl md:border md:border-hairline overflow-hidden min-w-0">
            <div className="relative aspect-[4/3] md:aspect-[16/10] bg-surface-soft">
              {project.image ? (
                <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center opacity-30" aria-hidden="true"><LogoMark size={72} /></span>
              )}
              <button type="button" onClick={() => navigate(-1)} aria-label="Volver"
                className="absolute top-3 left-3 w-10 h-10 rounded-full bg-[var(--photo-chip)] text-[var(--on-photo)] flex items-center justify-center active:scale-95 transition-transform">
                <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <div className="absolute top-3 right-3 flex gap-2">
                <button type="button" onClick={handleShare} aria-label="Compartir"
                  className="w-10 h-10 rounded-full bg-[var(--photo-chip)] text-[var(--on-photo)] flex items-center justify-center active:scale-95 transition-transform">
                  <Share2 size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
                {(!user || user.role === 'volunteer') && (
                  <button type="button" onClick={handleToggleFollow} disabled={togglingFollow} aria-pressed={isFollowing}
                    title={isFollowing ? 'Dejar de seguir voluntariado' : 'Seguir voluntariado'}
                    className="h-10 px-3.5 rounded-full bg-[var(--photo-chip)] text-[var(--on-photo)] text-[13px] font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60">
                    <Bell size={16} strokeWidth={1.75} className={isFollowing ? 'fill-current' : ''} aria-hidden="true" />
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 md:px-6 pt-5 pb-6 flex flex-col gap-3">
              <h1 className="text-[22px] font-bold leading-[1.2] tracking-[-0.3px]">{project.title}</h1>
              <div className="flex items-center gap-2 flex-wrap text-[15px]">
                <Link to={project.ngo_id ? `/ngo/${project.ngo_id}` : '#'} className="inline-flex items-center gap-2 min-w-0">
                  <Avatar src={project.ngo_logo} name={project.ngo_name || 'ONG'} kind="org" size={28} />
                  <span className="font-semibold truncate">{project.ngo_name}</span>
                </Link>
                <span className="text-[13px] text-ink-muted inline-flex items-center gap-1">
                  ·{' '}
                  {avg ? <><Star size={14} className="fill-star text-star" aria-hidden="true" />{avg} · {project.ratings.length} {project.ratings.length === 1 ? 'reseña' : 'reseñas'}</> : 'Nuevo, sin reseñas'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {project.category && <Chip>{project.category}</Chip>}
                <TypeBadge type={project.type} variant="soft" className="!h-7" />
                {remote ? <Chip><Laptop size={14} strokeWidth={1.75} aria-hidden="true" />Remoto</Chip>
                  : project.modality === 'hibrido' ? <Chip><Globe size={14} strokeWidth={1.75} aria-hidden="true" />Híbrido</Chip>
                  : <Chip>Presencial</Chip>}
              </div>
            </div>

            <div className="px-4 md:px-6 pb-6 grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-ink-muted">{project.type === 'fugaz' ? 'Duración' : 'Dedicación'}</span><span className="text-[15px] font-bold leading-snug">{hoursLabel}</span></div>
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-ink-muted">Costo por persona</span><span className="text-[15px] font-bold leading-snug">{(project.cost_per_person || 0) === 0 ? 'Sin costo' : formatMoney(project.cost_per_person)}</span></div>
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-ink-muted">Lugares</span><span className="text-[15px] font-bold leading-snug">{project.current_volunteers || 0} de {project.volunteers_needed || 0}</span></div>
            </div>
            <div className="px-4 md:px-6 pb-6 flex items-center gap-2 text-[15px]">
              {remote ? <Laptop size={16} strokeWidth={1.75} aria-hidden="true" className="flex-shrink-0" /> : <MapPin size={16} strokeWidth={1.75} aria-hidden="true" className="flex-shrink-0" />}
              <span className="flex-1 min-w-0">{remote ? (project.location && project.location.toLowerCase() !== 'remoto' ? `Remoto · ${project.location}` : '100% remoto') : project.location}</span>
              {mapsHref && !remote && <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="font-semibold flex-shrink-0">Cómo llegar</a>}
            </div>

            {/* La doble meta en el celular; en escritorio vive en la caja de la derecha. */}
            <div className="md:hidden px-4">
              <Section id="como-vamos" title="Cómo vamos">
                {goalBlock}
                {noDonations}
              </Section>
            </div>

            <div className="px-4 md:px-6">
              <Section id="sobre" title="Sobre el voluntariado">
                <p className="text-[15px] leading-[1.5] whitespace-pre-line">{project.full_description || project.description}</p>
                {project.requirements && project.requirements.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-semibold text-ink-soft">Requisitos</h3>
                    <ul className="flex flex-col gap-1">
                      {project.requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-[15px]"><Check size={16} strokeWidth={2} className="mt-1 text-ink-muted flex-shrink-0" aria-hidden="true" />{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              {project.roles_needed && project.roles_needed.length > 0 && (
                <Section id="roles" title="Roles que se necesitan">
                  <div className="flex flex-wrap gap-2">
                    {project.roles_needed.map((r, i) => (
                      <span key={i} className="h-8 px-3 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center">{r}</span>
                    ))}
                  </div>
                </Section>
              )}

              {/* KPIs públicos */}
              {project.kpis && project.kpis.length > 0 && (
                <Section id="impacto" title="Impacto del voluntariado">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
                    {project.kpis.map((k: any) => (
                      <div key={k.id} className="flex flex-col">
                        <dd className="order-1 text-[22px] font-extrabold tracking-[-0.3px] leading-tight">
                          {k.valor !== null && k.valor !== undefined
                            ? k.tipo_valor === 'porcentaje' ? `${k.valor} %`
                              : k.tipo_valor === 'booleano' ? (k.valor ? 'Sí' : 'No')
                              : `${k.valor}${k.unidad ? ' ' + k.unidad : ''}`
                            : '—'}
                        </dd>
                        <dt className="order-2 text-[13px] text-ink-soft">{k.nombre}</dt>
                      </div>
                    ))}
                  </dl>
                </Section>
              )}

              {/* Reseñas */}
              <Section id="resenas" title={project.ratings.length ? `Reseñas (${project.ratings.length})` : 'Reseñas'}>
                {/* Formulario de calificación: solo para voluntarios con inscripción aprobada */}
                {project.my_enrollment?.status === 'approved' ? (
                  <form onSubmit={handleRate} className="rounded-xl bg-surface-soft p-4 flex flex-col gap-3">
                    <h3 className="text-[15px] font-semibold">
                      {hasOwnRating
                        ? 'Ya calificaste este voluntariado. Podés editar tu reseña.'
                        : '¿Qué te pareció? Dejá tu reseña'}
                    </h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button type="button" key={star}
                          aria-label={`${star} estrella${star > 1 ? 's' : ''}`} aria-pressed={star === userRating}
                          onClick={() => { setUserRating(star); prefillPending.current = false; }}
                          className="w-10 h-10 -mx-0.5 flex items-center justify-center active:scale-90 transition-transform">
                          <Star size={26} className={star <= userRating ? 'fill-star text-star' : 'text-border-strong'} aria-hidden="true" />
                        </button>
                      ))}
                      <span className="ml-2 text-[15px] font-bold">{userRating} / 5</span>
                    </div>
                    <textarea
                      aria-label="Tu reseña"
                      value={ratingComment}
                      onChange={e => { setRatingComment(e.target.value); setRatingErr(''); prefillPending.current = false; }}
                      placeholder="Contá tu experiencia, qué aprendiste o qué mejorarías"
                      rows={3}
                      className="w-full px-3.5 py-3 rounded-[10px] bg-surface text-[15px] border-[1.5px] border-transparent focus:border-ink outline-none resize-none"
                    />
                    {ratingErr && <p role="alert" className="text-[13px] text-critical font-medium">{ratingErr}</p>}
                    {ratingMsg && <p role="status" className="text-[13px] text-people-text font-semibold">{ratingMsg}</p>}
                    <Button type="submit" variant="primary" busy={submittingRating} busyLabel="Guardando…" className="self-start">
                      {hasOwnRating ? 'Actualizar reseña' : 'Guardar reseña'}
                    </Button>
                  </form>
                ) : (
                  <p className="text-[13px] text-ink-muted">Solo pueden reseñar las personas que participaron con inscripción aprobada.</p>
                )}

                {project.ratings.length === 0 ? (
                  <p className="text-[15px] text-ink-soft">Sin reseñas aún.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {project.ratings.map(r => (
                      <li key={r.id} className="flex gap-3">
                        {r.user_id ? (
                          <Link to={`/volunteer/${r.user_id}`} aria-label={`Perfil de ${r.user_name}`} className="flex-shrink-0">
                            <Avatar src={r.user_avatar} name={r.user_name} size={36} />
                          </Link>
                        ) : <Avatar src={r.user_avatar} name={r.user_name} size={36} />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.user_id
                              ? <Link to={`/volunteer/${r.user_id}`} className="text-[15px] font-semibold">{r.user_name}</Link>
                              : <span className="text-[15px] font-semibold">{r.user_name}</span>}
                            <span className="text-xs font-semibold text-people-text">Participó</span>
                          </div>
                          <div className="flex my-0.5" aria-label={`${r.rating} de 5`} role="img">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={14} className={i < r.rating ? 'fill-star text-star' : 'text-hairline'} aria-hidden="true" />
                            ))}
                          </div>
                          {r.comment && <p className="text-[15px] leading-snug text-ink-soft">{r.comment}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Comentarios */}
              <Section id="comentarios" title={project.comments.length ? `Comentarios (${project.comments.length})` : 'Comentarios'}>
                {project.comments.length === 0 && <p className="text-[15px] text-ink-soft">Sin comentarios aún. Sé la primera persona.</p>}
                <ul className="flex flex-col gap-3">
                  {project.comments.map(c => (
                    <li key={c.id} className="flex gap-2.5">
                      {c.user_id
                        ? <Link to={`/volunteer/${c.user_id}`} className="flex-shrink-0"><Avatar src={c.user_avatar} name={c.user_name} size={32} /></Link>
                        : <Avatar src={c.user_avatar} name={c.user_name} size={32} />}
                      <div className="min-w-0 text-[15px] leading-snug">
                        {c.user_id ? <Link to={`/volunteer/${c.user_id}`} className="font-semibold">{c.user_name}</Link> : <span className="font-semibold">{c.user_name}</span>}
                        {Boolean(c.is_participant) && <span className="ml-1.5 text-xs font-semibold text-people-text">Participó</span>}
                        <p className="text-ink-soft break-words">{c.comment}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleComment} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Comentario"
                      maxLength={1000}
                      value={comment}
                      onChange={e => { setComment(e.target.value); setCommentErr(''); }}
                      placeholder={user ? 'Escribí un comentario…' : 'Iniciá sesión para comentar'}
                      readOnly={!user}
                      onClick={() => !user && openAuthModal('Iniciá sesión para comentar')}
                      className={`flex-1 min-w-0 h-11 px-4 rounded-full bg-surface-soft text-[15px] outline-none focus:bg-surface focus:ring-[1.5px] focus:ring-ink ${!user ? 'cursor-pointer' : ''}`}
                    />
                    {user && (
                      <button type="submit" disabled={commenting} aria-label="Publicar comentario"
                        className="w-11 h-11 rounded-full inline-flex items-center justify-center disabled:opacity-40">
                        <Send size={20} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {commentErr && <p role="alert" className="text-[13px] text-critical ml-1">{commentErr}</p>}
                </form>
              </Section>

              {/* Publicaciones de este voluntariado */}
              {id && (
                <section aria-labelledby="publicaciones" className="py-6 border-t border-hairline flex flex-col gap-3">
                  <h2 id="publicaciones" className="text-lg font-bold tracking-[-0.2px]">Publicaciones de este voluntariado</h2>
                  <MomentsGrid filters={{ project_id: id }} />
                </section>
              )}
            </div>
          </div>

          {/* ── Caja fija (escritorio) ─────────────────────────────── */}
          <aside className="hidden md:flex flex-col gap-4 sticky top-6 rounded-2xl bg-surface border border-hairline p-5" aria-label="Cómo sumarte">
            {goalBlock}
            <div className="flex items-baseline justify-between border-t border-hairline pt-3">
              <span className="text-xs font-semibold text-ink-soft">Costo por persona</span>
              <span className="text-[15px] font-bold">{(project.cost_per_person || 0) === 0 ? 'Sin costo' : formatMoney(project.cost_per_person)}</span>
            </div>
            {enrollNotice}
            <ActionButtons />
            {noDonations}
          </aside>
        </div>
      </div>

      {/* ── Barra fija (celular) ──────────────────────────────────── */}
      <div className="md:hidden fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-20 bg-surface border-t border-hairline px-4 py-3 flex flex-col gap-2">
        {enrollNotice}
        <ActionButtons />
      </div>

      {showDonate && (
        <DonateModal projectId={project.id} projectTitle={project.title} onClose={() => setShowDonate(false)} />
      )}
    </div>
  );
}
