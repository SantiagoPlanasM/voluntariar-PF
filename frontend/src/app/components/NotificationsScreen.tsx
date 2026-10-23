// Notificaciones (DESIGN.md → Notificaciones): agrupadas por tiempo ("Hoy", "Esta semana", "Antes"), con un círculo
// que dice de qué tipo es cada una. Las no leídas llevan fondo suave y un punto. El destino de cada notificación
// (el voluntariado, el perfil) necesita que el backend la mande en `data`: hoy la lista solo trae título y texto.
import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, UserPlus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { api, AppNotification } from '../../lib/api';
import { parseBackendDate, timeAgo, userMessage } from '../../lib/format';
import { InlineError } from './LoadError';
import { useAuth } from '../../lib/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';

// Tipo → círculo de 20 px sobre el ícono: verde = te aceptaron, el resto, neutro. Sin colores nuevos.
const KIND: Record<string, { icon: typeof Bell; badge: string }> = {
  enrollment_approved: { icon: Check,    badge: 'bg-people text-white' },
  enrollment_rejected: { icon: X,        badge: 'bg-ink-muted text-white' },
  new_enrollment:      { icon: UserPlus, badge: 'bg-ink text-on-ink' },
  new_follower:        { icon: UserPlus, badge: 'bg-ink text-on-ink' },
  new_project:         { icon: Bell,     badge: 'bg-ink text-on-ink' },
};

// "Hace cuánto": el timeAgo compartido (lib/format.ts). Antes había una copia acá con `new Date(fecha)`, que
// leía el formato de SQLite (UTC sin zona) como hora local: 3 h de desfase en Córdoba (REVISION F11).

/** A dónde lleva cada notificación, según su tipo y los ids que guardó el backend en `data`. Sin destino → null. */
export function notificationHref(n: Pick<AppNotification, 'type' | 'data'>): string | null {
  let d: Record<string, unknown> = {};
  if (typeof n.data === 'string' && n.data) { try { d = JSON.parse(n.data) ?? {}; } catch { d = {}; } }
  else if (n.data && typeof n.data === 'object') d = n.data;
  const id = (k: string) => (typeof d[k] === 'string' && d[k] ? encodeURIComponent(d[k] as string) : null);
  const project = id('project_id');
  switch (n.type) {
    case 'new_enrollment':       // a la ONG: las postulaciones de ese voluntariado
    case 'donation_received':    // a la ONG: el voluntariado que recibió la donación
      return project ? `/ngo/dashboard/project/${project}` : '/ngo/dashboard';
    case 'sponsor_proposal':     // a la ONG: las propuestas de patrocinio
      return '/ngo/patrocinios';
    case 'mp_reconnect_needed':  // a la ONG: vincular Mercado Pago de nuevo
      return '/ngo/profile#mercadopago';
    case 'enrollment_approved':
    case 'enrollment_rejected':  // al voluntario: sus postulaciones
      return '/participation';
    case 'new_follower':
      return id('follower_id') ? `/volunteer/${id('follower_id')}` : null;
    case 'sponsor_accepted':     // a la empresa: el voluntariado que patrocina
      return project ? `/project/${project}` : '/company/profile';
    case 'sponsor_rejected':
      return '/company/profile';
    case 'new_project':
      return project ? `/project/${project}` : null;
    default:
      return null;
  }
}

type Group = 'today' | 'week' | 'before';
const GROUP_LABEL: Record<Group, string> = { today: 'Hoy', week: 'Esta semana', before: 'Antes' };

function groupOf(iso: string, now = Date.now()): Group {
  const t = parseBackendDate(iso);
  if (Number.isNaN(t)) return 'before';
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  if (t >= startOfToday.getTime()) return 'today';
  return now - t < 7 * 24 * 3600 * 1000 ? 'week' : 'before';
}

// Texto del estado vacío: los avisos que el backend crea para cada rol. La ONG veía el del voluntario (D26, §247).
const EMPTY_TEXT: Record<string, string> = {
  volunteer: 'Cuando una ONG responda o alguien te siga, aparece acá.',
  ngo: 'Cuando alguien se postule, done o una empresa te proponga un patrocinio, aparece acá.',
  company: 'Cuando una ONG responda a tus propuestas de patrocinio, aparece acá.',
};

// `inPanel`: dentro del panel de la ONG la pantalla es la misma; se conserva el parámetro por compatibilidad con la ruta.
export function NotificationsScreen(_props: { inPanel?: boolean } = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  // Contador del backend (COUNT sobre todas): la lista viene limitada a 50 y contarla acá daba ≤50 (§152).
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try { const r = await api.notifications.list(); setNotifs(r.notifications); setUnread(r.unread); }
    catch (e) { setNotifs([]); setUnread(0); setLoadError(userMessage(e, 'No pudimos cargar tus notificaciones. Revisá tu conexión.')); } // antes: "Sin notificaciones" (F9)
    finally { setLoading(false); }
  };

  // Al tocar una notificación se marca como leída (sin esperar la respuesta) y se navega a su destino.
  const open = (n: AppNotification) => {
    if (n.read || n.read === 1) return;
    setNotifs(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread(u => Math.max(0, u - 1));
    api.notifications.markRead(n.id).catch(() => {});
  };

  const markAll = async () => {
    setMarking(true);
    setActionError('');
    try { await api.notifications.markAllRead(); void load(); }
    catch (e) { setActionError(userMessage(e, 'No pudimos marcar las notificaciones como leídas. Revisá tu conexión.')); }
    finally { setMarking(false); }
  };

  const groups = useMemo(() => {
    const out: Record<Group, AppNotification[]> = { today: [], week: [], before: [] };
    for (const n of notifs) out[groupOf(n.created_at)].push(n);
    return out;
  }, [notifs]);

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 px-6 text-center">
      <p className="text-[15px] text-ink-soft">Iniciá sesión para ver tus notificaciones</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline min-h-[60vh]">
          <header className="h-14 pl-1 pr-2 flex items-center gap-1">
            <button type="button" onClick={() => navigate(-1)} aria-label="Volver"
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft md:hidden">
              <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <h1 className="flex-1 text-[22px] font-bold tracking-[-0.3px] pl-3 md:pl-4">Notificaciones</h1>
            {unread > 0 && (
              <Button variant="text" onClick={markAll} busy={marking} busyLabel="Marcando…" className="!text-[13px]">
                Marcar todo leído
              </Button>
            )}
          </header>
          {unread > 0 && <p className="px-4 md:px-4 text-[13px] text-ink-muted -mt-1 mb-1">{unread} sin leer</p>}

          {actionError && <p role="alert" className="mx-4 my-2 text-[13px] font-medium text-critical">{actionError}</p>}

          {loading ? (
            <div role="status" aria-label="Cargando notificaciones" className="px-4 py-3 flex flex-col gap-4">
              {[1, 2, 3].map(i => <div key={i} aria-hidden="true" className="flex gap-3"><div className="w-11 h-11 rounded-full skeleton" /><div className="flex-1 flex flex-col gap-2 pt-1"><div className="h-4 w-3/4 rounded skeleton" /><div className="h-3 w-1/3 rounded skeleton" /></div></div>)}
            </div>
          ) : loadError ? (
            <div className="px-4 py-2"><InlineError message={loadError} onRetry={load} /></div>
          ) : notifs.length === 0 ? (
            <div className="text-center py-16 px-6 flex flex-col items-center gap-1">
              <Bell size={28} strokeWidth={1.75} className="text-ink-muted mb-1" aria-hidden="true" />
              <p className="text-[15px] font-semibold">No tenés notificaciones</p>
              <p className="text-[13px] text-ink-muted max-w-xs">{EMPTY_TEXT[user?.role ?? ''] ?? EMPTY_TEXT.volunteer}</p>
            </div>
          ) : (
            (['today', 'week', 'before'] as Group[]).filter(g => groups[g].length > 0).map(g => (
              <section key={g} aria-labelledby={`ng-${g}`} className="pt-3">
                <h2 id={`ng-${g}`} className="px-4 pb-1 text-[15px] font-bold">{GROUP_LABEL[g]}</h2>
                <ul>
                  {groups[g].map(n => {
                    const isUnread = !n.read && n.read !== 1;
                    const kind = KIND[n.type];
                    const Icon = kind?.icon ?? Bell;
                    const href = notificationHref(n);
                    const rowClass = `px-4 py-2.5 flex gap-3 items-start ${isUnread ? 'bg-canvas-soft' : ''}`;
                    const content = (
                      <>
                        <span className="relative flex-shrink-0 w-11 h-11 rounded-full bg-surface-soft flex items-center justify-center" aria-hidden="true">
                          <Icon size={20} strokeWidth={1.75} />
                          {kind && <span className={`absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full border-2 border-canvas flex items-center justify-center ${kind.badge}`}><Icon size={11} strokeWidth={3} /></span>}
                        </span>
                        <div className="flex-1 min-w-0 pt-0.5 text-[15px] leading-snug">
                          <p className={isUnread ? 'font-semibold' : ''}>{n.title}</p>
                          {n.body && <p className="text-ink-soft">{n.body}</p>}
                          <p className="text-[13px] text-ink-muted mt-0.5">{timeAgo(n.created_at)}</p>
                        </div>
                        {isUnread && <span role="img" aria-label="Sin leer" className="w-2 h-2 rounded-full bg-ink mt-3 flex-shrink-0" />}
                      </>
                    );
                    return (
                      <li key={n.id}>
                        {href ? (
                          <Link to={href} onClick={() => open(n)} className={`${rowClass} hover:bg-surface-soft transition-colors`}>{content}</Link>
                        ) : (
                          <div className={rowClass}>{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
