// Mis voluntariados (DESIGN.md → Mis voluntariados): cuatro pestañas.
//   Próximos      → inscripciones aprobadas de voluntariados que siguen activos
//   Postulaciones → todas las inscripciones, con su estado
//   Seguidos      → los voluntariados que sigo (grilla)
//   Realizados    → aprobadas en voluntariados terminados (con "Dejá tu reseña")
// "Cancelar postulación" está en el menú "···" de cada fila y pide confirmación en un diálogo propio.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarClock, Check, Clock, MoreHorizontal } from 'lucide-react';
import { api, EnrollmentWithProject, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ReviewsModal } from './ReviewsModal';
import { InlineError } from './LoadError';
import { LogoMark } from '../ui/Logo';
import { Button } from '../ui/Button';
import { useConfirm, useToast } from '../ui/UiProvider';
import { VolunteeringTile } from '../volunteering/VolunteeringTile';
import { userMessage } from '../../lib/format';
import { interviewWhen } from './InterviewPanel';

type TabKey = 'upcoming' | 'applications' | 'following' | 'done';

const STATUS: Record<string, { label: string; tone: 'soft' | 'ok' }> = {
  pending:   { label: 'Pendiente',       tone: 'soft' },
  approved:  { label: 'Aceptado',        tone: 'ok' },
  rejected:  { label: 'No seleccionado', tone: 'soft' },
  cancelled: { label: 'Cancelado',       tone: 'soft' },
};

function StatusChip({ status, interview }: { status: string; interview?: boolean }) {
  const s = STATUS[status] || STATUS.rejected;
  // Pendiente con entrevista programada: el chip "Entrevista" de DESIGN.md (§262).
  if (status === 'pending' && interview) return (
    <span className="h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0 bg-surface-soft text-ink-soft">
      <CalendarClock size={14} strokeWidth={1.75} aria-hidden="true" />Entrevista
    </span>
  );
  return (
    <span className={`h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0 ${s.tone === 'ok' ? 'bg-people-soft text-people-text' : 'bg-surface-soft text-ink-soft'}`}>
      {status === 'approved' && <Check size={14} strokeWidth={2.25} aria-hidden="true" />}
      {status === 'pending' && <Clock size={14} strokeWidth={1.75} aria-hidden="true" />}
      {s.label}
    </span>
  );
}

export function MyParticipation() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [items, setItems]       = useState<EnrollmentWithProject[]>([]);
  const [followed, setFollowed] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState<TabKey>('applications');
  const [menuFor, setMenuFor]   = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; title: string } | null>(null);
  const tabChosen = useRef(false);

  const load = () => {
    setLoading(true);
    setError('');
    // allSettled no rechaza nunca: los errores de cada pedido se leen en su `status` (de ahí el `void`).
    void Promise.allSettled([api.enrollments.my(), api.follows.myProjects()]).then(([mine, fol]) => {
      if (mine.status === 'rejected') setError(userMessage(mine.reason, 'No pudimos cargar tus voluntariados. Revisá tu conexión.'));
      else setItems(mine.value.enrollments);
      if (fol.status === 'fulfilled') setFollowed(fol.value.projects);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (user.role === 'ngo') { navigate('/ngo/dashboard', { replace: true }); return; }
    if (user.role === 'company') { navigate('/company/profile', { replace: true }); return; }
    load();
  }, [user]);

  const upcoming = useMemo(() => items.filter(i => i.status === 'approved' && i.project_status === 'active'), [items]);
  const done = useMemo(() => items.filter(i => i.status === 'approved' && i.project_status !== 'active'), [items]);
  const applications = useMemo(() => items.filter(i => (i.status as string) !== 'cancelled'), [items]);

  // La primera vez, si hay algo próximo, se empieza por ahí.
  useEffect(() => {
    if (!loading && !tabChosen.current && upcoming.length > 0) setTab('upcoming');
  }, [loading, upcoming.length]);

  const handleCancel = async (item: EnrollmentWithProject) => {
    setMenuFor(null);
    const ok = await confirm({
      title: '¿Cancelar tu postulación?',
      body: `${item.ngo_name} deja de verla. Podés volver a postularte más adelante.`,
      confirmLabel: 'Cancelar postulación',
      cancelLabel: 'Volver',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.enrollments.cancel(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast(`Cancelaste tu postulación a ${item.title}`);
    } catch (e) {
      toast(userMessage(e, 'No pudimos cancelar la postulación. Probá de nuevo.'), { kind: 'error' });
    }
  };

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center bg-canvas">
      <p className="text-[22px] font-bold tracking-[-0.3px]">Mis voluntariados</p>
      <p className="text-[15px] text-ink-soft">Iniciá sesión para ver tus postulaciones y lo que seguís.</p>
      <Button variant="primary" onClick={() => openAuthModal()}>Iniciar sesión</Button>
    </div>
  );

  const tabs: { key: TabKey; label: string; n: number }[] = [
    { key: 'upcoming', label: 'Próximos', n: upcoming.length },
    { key: 'applications', label: 'Postulaciones', n: applications.length },
    { key: 'following', label: 'Seguidos', n: followed.length },
    { key: 'done', label: 'Realizados', n: done.length },
  ];

  const row = (item: EnrollmentWithProject, opts: { menu?: boolean; review?: boolean; hours?: boolean } = {}) => {
    const iv = item.status === 'pending' && item.interview?.status === 'scheduled' ? item.interview : null;
    return (
    <li key={item.id} className="relative flex flex-wrap items-center gap-3 min-h-[72px]">
      <Link to={`/project/${item.project_id}`} className="flex items-center gap-3 flex-1 min-w-0">
        {item.image
          ? <img src={item.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-surface-soft" />
          : <span className="w-14 h-14 rounded-xl bg-surface-soft flex items-center justify-center flex-shrink-0 opacity-70" aria-hidden="true"><LogoMark size={28} /></span>}
        <span className="min-w-0 flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-snug line-clamp-2">{item.title}</span>
          <span className="text-[13px] text-ink-muted truncate">{item.ngo_name}{item.location ? ` · ${item.location.split(',')[0]}` : ''}</span>
          {opts.hours && !!item.hours_logged && (
            <span className="text-[13px] font-semibold text-people-text">{item.hours_logged} {item.hours_logged === 1 ? 'hora verificada' : 'horas verificadas'} por la ONG</span>
          )}
        </span>
      </Link>
      {opts.review ? (
        <button type="button" onClick={() => setReviewTarget({ id: item.project_id, title: item.title })} className="h-11 px-1 text-[13px] font-semibold flex-shrink-0">Dejá tu reseña</button>
      ) : (
        <StatusChip status={item.status} interview={!!iv} />
      )}
      {opts.menu && item.status === 'pending' && (
        <div className="relative flex-shrink-0 -mr-3">
          <button type="button" onClick={() => setMenuFor(menuFor === item.id ? null : item.id)} aria-label={`Opciones de ${item.title}`} aria-haspopup="menu" aria-expanded={menuFor === item.id}
            className="w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-muted hover:bg-surface-soft">
            <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {menuFor === item.id && (
            <div role="menu" className="absolute right-2 top-11 z-10 w-60 p-1.5 rounded-xl bg-surface border border-hairline shadow-[var(--elev-popover)]">
              <Link role="menuitem" to={`/project/${item.project_id}`} className="h-11 px-3 rounded-lg flex items-center text-[15px] hover:bg-surface-soft">Ver voluntariado</Link>
              <button type="button" role="menuitem" onClick={() => handleCancel(item)} className="w-full h-11 px-3 rounded-lg text-left text-[15px] font-semibold text-critical hover:bg-surface-soft">Cancelar postulación</button>
            </div>
          )}
        </div>
      )}
      {iv && (
        // Fuera del <Link> de la fila: el link de la videollamada no puede ir adentro de otro enlace.
        <div className="basis-full pl-[68px] -mt-1 pb-1 flex flex-col gap-0.5 text-[13px]">
          <span className="font-semibold">Entrevista: {interviewWhen(iv)}</span>
          {iv.place && <span className="text-ink-soft">{iv.place}</span>}
          {iv.link && (
            <a href={iv.link} target="_blank" rel="noopener noreferrer" aria-label="Abrir el link de la entrevista"
              className="text-brand-text underline break-all">{iv.link}</a>
          )}
          {iv.note && <span className="text-ink-muted italic">{iv.note}</span>}
        </div>
      )}
    </li>
    );
  };

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline min-h-[60vh]">
          <h1 className="px-4 pt-4 text-[22px] font-bold tracking-[-0.3px]">Mis voluntariados</h1>
          <div role="tablist" aria-label="Mis voluntariados" className="mt-2 px-4 flex gap-5 border-b border-hairline overflow-x-auto scrollbar-hide">
            {tabs.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                onClick={() => { tabChosen.current = true; setTab(t.key); }}
                className={`h-11 whitespace-nowrap text-[13px] border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-ink font-bold text-ink' : 'border-transparent font-semibold text-ink-muted'}`}>
                {t.label}{!loading && t.n > 0 ? ` · ${t.n}` : ''}
              </button>
            ))}
          </div>

          <div className="p-4 flex flex-col gap-5" role="tabpanel">
            {loading ? (
              <div role="status" aria-label="Cargando tus voluntariados" className="flex flex-col gap-4">
                {[1, 2, 3].map(i => <div key={i} aria-hidden="true" className="flex gap-3"><div className="w-14 h-14 rounded-xl skeleton" /><div className="flex-1 flex flex-col gap-2 pt-1"><div className="h-4 w-3/4 rounded skeleton" /><div className="h-3 w-1/2 rounded skeleton" /></div></div>)}
              </div>
            ) : error ? (
              <InlineError message={error} onRetry={load} />
            ) : tab === 'upcoming' ? (
              upcoming.length === 0
                ? <Empty text="Todavía no tenés voluntariados próximos" hint="Cuando una ONG acepte tu postulación, aparece acá." cta />
                : <ul className="flex flex-col gap-4">{upcoming.map(i => row(i, { hours: true }))}</ul>
            ) : tab === 'applications' ? (
              applications.length === 0
                ? <Empty text="No te postulaste a ningún voluntariado" hint="Elegí uno en Explorar y tocá Inscribirme." cta />
                : (
                  <>
                    <p className="rounded-xl bg-surface-soft px-3.5 py-3 text-[13px] leading-snug text-ink-soft">Las ONG suelen responder en pocos días. Te avisamos por notificación y por mensaje.</p>
                    <ul className="flex flex-col gap-4">{applications.map(i => row(i, { menu: true, hours: true }))}</ul>
                  </>
                )
            ) : tab === 'following' ? (
              followed.length === 0
                ? <Empty text="Todavía no seguís ningún voluntariado" hint="Tocá Seguir en un voluntariado para recibir sus novedades." cta />
                : <div className="grid grid-cols-2 gap-x-2 gap-y-5">{followed.map(p => <VolunteeringTile key={p.id} project={p} />)}</div>
            ) : (
              done.length === 0
                ? <Empty text="Todavía no realizaste voluntariados" hint="Los que termines aparecen acá, con tus horas verificadas." />
                : <ul className="flex flex-col gap-4">{done.map(i => row(i, { review: true, hours: true }))}</ul>
            )}
          </div>
        </div>
      </div>

      {reviewTarget && (
        // El mismo modal que el feed (antes había un ReviewModal aparte que hacía lo mismo; §101): muestra las
        // reseñas de otros y, como la inscripción está aprobada, el formulario para dejar la propia.
        <ReviewsModal
          isOpen
          projectId={reviewTarget.id}
          projectTitle={reviewTarget.title}
          canRate
          onClose={() => setReviewTarget(null)}
        />
      )}
    </div>
  );
}

function Empty({ text, hint, cta }: { text: string; hint: string; cta?: boolean }) {
  return (
    <div className="py-12 text-center flex flex-col items-center gap-1">
      <p className="text-[15px] font-semibold">{text}</p>
      <p className="text-[13px] text-ink-muted max-w-xs">{hint}</p>
      {cta && <Link to="/explore" className="mt-2 h-10 px-4 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold inline-flex items-center">Explorar voluntariados</Link>}
    </div>
  );
}
