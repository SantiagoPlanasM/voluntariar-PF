// Postulaciones de la ONG (/ngo/postulaciones y, para un coordinador, /equipo/:ngoId/postulaciones; §319).
// Todas las de todos los voluntariados juntas, pensada para cientos: pestañas por estado con su cantidad, filtros
// (voluntariado con sus cupos, entrevista, solo con CV, búsqueda, orden), de a 50 con "Mostrar más", y decisión en lote.
// El lote manda las elegidas de la más vieja a la más nueva (orden de llegada) en tandas de 500; el backend aprueba hasta
// llenar los cupos de cada voluntariado (regla 20) y el resumen dice qué pasó con cada una. La lógica, en lib/applications.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarClock, Check, FileText, Loader2, X } from 'lucide-react';
import { api, BulkSummary, NgoEnrollment, NgoEnrollmentsPage } from '../../lib/api';
import { openCv } from '../../lib/cv';
import { timeAgo, userMessage } from '../../lib/format';
import {
  ApplicationFilters, DEFAULT_FILTERS, InterviewFilter, SortKey, StatusFilter,
  bulkOrder, chunk, countByStatus, filterApplications, mergeSummaries, summaryText,
} from '../../lib/applications';
import { Avatar } from '../ui/Avatar';
import { Button, ButtonLink } from '../ui/Button';
import { PROFILE_FIELD } from '../ui/fieldStyles';
import { useConfirm } from '../ui/UiProvider';
import { EnrollmentPhone } from './EnrollmentPhone';
import { interviewWhen } from './InterviewPanel';
import { InlineError } from './LoadError';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
const PAGE = 50;
const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'pending', label: 'Pendientes' }, { key: 'approved', label: 'Aprobadas' },
  { key: 'rejected', label: 'Rechazadas' }, { key: 'all', label: 'Todas' },
];
const STATUS_LABEL: Record<NgoEnrollment['status'], string> = {
  pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada',
};
const ZERO: BulkSummary = { applied: 0, unchanged: 0, full: 0, stale: 0, not_found: 0 };
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function NGOApplications({ team = false }: { team?: boolean }) {
  const { ngoId } = useParams();
  const scope = team ? ngoId : undefined;
  const confirm = useConfirm();
  const [data, setData] = useState<NgoEnrollmentsPage | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filters, setFiltersState] = useState<ApplicationFilters>(DEFAULT_FILTERS);
  const [visible, setVisible] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  /** `quiet`: recargar sin vaciar la pantalla (después de decidir). */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setData(null); setLoadError(''); }
    try { setData(await api.enrollments.manage(scope)); }
    catch (err) { if (!quiet) setLoadError(userMessage(err, NETWORK_ERROR)); }
  }, [scope]);
  useEffect(() => { void load(); }, [load]);

  // Cambiar un filtro vuelve a la primera página y vacía la selección: no se decide sobre lo que ya no se ve.
  const setFilters = (patch: Partial<ApplicationFilters>) => {
    setFiltersState((f) => ({ ...f, ...patch }));
    setVisible(PAGE);
    setSelected(new Set());
  };

  const list = data?.enrollments ?? [];
  const filtered = useMemo(() => filterApplications(list, filters), [list, filters]);
  const counts = useMemo(() => countByStatus(list, filters.project), [list, filters.project]);
  const shown = filtered.slice(0, visible);
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const toggle = (id: string) => setSelected((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((e) => e.id)));

  const decide = async (ids: string[], status: 'approved' | 'rejected') => {
    setBusy(true);
    setNotice('');
    setError('');
    let total = ZERO;
    let done = 0;
    try {
      for (const part of chunk(ids)) {
        total = mergeSummaries(total, (await api.enrollments.bulk(part, status)).summary);
        done += 1;
      }
      setNotice(summaryText(total, status));
      setSelected(new Set());
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
    } finally {
      if (done > 0) await load(true);
      setBusy(false);
    }
  };

  const decideSelected = async (status: 'approved' | 'rejected') => {
    const ids = bulkOrder(list, selected);
    const what = plural(ids.length, 'postulación', 'postulaciones');
    const ok = await confirm(status === 'approved'
      ? { title: `¿Aprobar ${what}?`, confirmLabel: 'Aprobar', cancelLabel: 'Volver',
          body: 'Se aprueban por orden de llegada (las más viejas primero) hasta llenar los cupos de cada voluntariado; las que no entren siguen pendientes. A cada persona le llega un aviso y un email.' }
      : { title: `¿Rechazar ${what}?`, confirmLabel: 'Rechazar', cancelLabel: 'Volver', danger: true,
          body: 'A cada persona le llega un aviso y un email. Si alguna estaba aprobada, libera su cupo.' });
    if (ok) await decide(ids, status);
  };

  const back = team ? `/equipo/${ngoId}` : '/ngo/dashboard';
  const detail = (e: NgoEnrollment) => `${team ? `/equipo/${ngoId}` : '/ngo/dashboard'}/project/${e.project_id}?postulacion=${e.id}`;

  return (
    <div className="min-h-screen bg-canvas-soft pb-28">
      <div className="max-w-[880px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-4">
        <header className="flex items-center gap-1 -ml-3">
          <Link to={back} aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">Postulaciones</h1>
            {data && <p className="text-[13px] text-ink-muted truncate">{data.ngo.name}</p>}
          </div>
        </header>

        {loadError ? (
          <InlineError message={loadError} onRetry={() => void load()} />
        ) : !data ? (
          <Loader2 className="w-5 h-5 animate-spin text-ink-muted" aria-label="Cargando" />
        ) : (
          <>
            {data.truncated && (
              <p className="rounded-xl bg-surface border border-hairline p-3 text-[13px] text-ink-soft">
                Se muestran las 2000 postulaciones más nuevas. Filtrá por voluntariado para ver el resto.
              </p>
            )}

            {/* overflow-y-hidden (§322): el -mb-px de las pestañas dibujaba una barra de scroll vertical. */}
            <div role="tablist" aria-label="Estado" className="flex border-b border-hairline overflow-x-auto overflow-y-hidden">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={filters.status === t.key}
                  onClick={() => setFilters({ status: t.key })}
                  className={`flex-1 min-w-[96px] h-11 text-[13px] border-b-2 -mb-px ${filters.status === t.key ? 'border-ink font-bold text-ink' : 'border-transparent font-semibold text-ink-muted'}`}>
                  {t.label} <span className="tabular-nums">{counts[t.key]}</span>
                </button>
              ))}
            </div>

            <section aria-label="Filtros" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="ap-project" label="Voluntariado">
                <select id="ap-project" className={PROFILE_FIELD} value={filters.project} onChange={(e) => setFilters({ project: e.target.value })}>
                  <option value="">Todos</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.current_volunteers}/{p.volunteers_needed} cupos)</option>
                  ))}
                </select>
              </Field>
              <Field id="ap-interview" label="Entrevista">
                <select id="ap-interview" className={PROFILE_FIELD} value={filters.interview}
                  onChange={(e) => setFilters({ interview: e.target.value as InterviewFilter })}>
                  <option value="any">Cualquiera</option>
                  <option value="scheduled">Con entrevista programada</option>
                  <option value="none">Sin entrevista</option>
                </select>
              </Field>
              <Field id="ap-sort" label="Ordenar">
                <select id="ap-sort" className={PROFILE_FIELD} value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as SortKey })}>
                  <option value="newest">Más nuevas primero</option>
                  <option value="oldest">Más viejas primero</option>
                  <option value="name">Por nombre</option>
                </select>
              </Field>
              <Field id="ap-q" label="Buscar">
                <input id="ap-q" type="search" className={PROFILE_FIELD} placeholder="Nombre, mail o voluntariado" value={filters.q}
                  onChange={(e) => setFilters({ q: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-[15px] sm:col-span-2 lg:col-span-4">
                <input type="checkbox" checked={filters.cvOnly} onChange={(e) => setFilters({ cvOnly: e.target.checked })} className="w-4 h-4" />
                Solo con CV
              </label>
            </section>

            {notice && <p role="status" className="text-[15px] font-semibold text-people-text">{notice}</p>}
            {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}

            {filtered.length === 0 ? (
              <div className="rounded-xl bg-surface border border-hairline p-6 text-center flex flex-col items-center gap-3">
                <p className="text-[15px] text-ink-soft">Ninguna postulación con estos filtros.</p>
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>Limpiar filtros</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-1">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4"
                      aria-label={`Elegir las ${filtered.length} que se ven con estos filtros`} />
                    Elegir todas
                  </label>
                  <p className="text-[13px] text-ink-muted">
                    {shown.length < filtered.length ? `Mostrando ${shown.length} de ${filtered.length}` : plural(filtered.length, 'postulación', 'postulaciones')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {shown.map((e) => (
                    <Row key={e.id} e={e} checked={selected.has(e.id)} onToggle={() => toggle(e.id)} busy={busy}
                      showStatus={filters.status === 'all'} interviewHref={detail(e)}
                      onDecide={(status) => void decide([e.id], status)} onError={setError} />
                  ))}
                </div>
                {shown.length < filtered.length && (
                  <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)} className="self-center">Mostrar más</Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selected.size > 0 && (
        <section aria-label="Elegidas"
          className="fixed bottom-16 md:bottom-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[640px] z-30 rounded-2xl bg-surface border border-hairline shadow-lg p-3 flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-bold flex-1 min-w-[120px]">{plural(selected.size, 'elegida', 'elegidas')}</p>
          <Button variant="primary" disabled={busy} onClick={() => void decideSelected('approved')}>Aprobar {selected.size}</Button>
          <Button variant="danger" disabled={busy} onClick={() => void decideSelected('rejected')}>Rechazar {selected.size}</Button>
          <Button variant="text" disabled={busy} onClick={() => setSelected(new Set())}>Quitar selección</Button>
        </section>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

function Row({ e, checked, onToggle, busy, showStatus, interviewHref, onDecide, onError }: {
  e: NgoEnrollment; checked: boolean; onToggle: () => void; busy: boolean; showStatus: boolean; interviewHref: string;
  onDecide: (status: 'approved' | 'rejected') => void; onError: (msg: string) => void;
}) {
  const name = e.volunteer_name;
  const open = e.status === 'pending' || e.status === 'approved';
  const viewCv = async () => {
    try { await openCv(e.user_id); } catch (err) { onError(userMessage(err, NETWORK_ERROR)); }
  };
  return (
    <article aria-label={name} className={`rounded-xl bg-surface border p-3 flex gap-3 ${checked ? 'border-ink' : 'border-hairline'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Elegir a ${name}`} className="w-4 h-4 mt-3 flex-shrink-0" />
      <Avatar src={e.volunteer_avatar} name={name} size={40} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-[15px] font-semibold flex flex-wrap items-center gap-x-2">
          <Link to={`/volunteer/${e.user_id}`} className="hover:underline truncate">{name}</Link>
          {showStatus && <span className="text-xs font-semibold text-ink-soft">{STATUS_LABEL[e.status]}</span>}
        </p>
        <p className="text-[13px] text-ink-soft truncate">{e.project_title} · {timeAgo(e.created_at)}</p>
        {e.message && <p className="text-[13px] text-ink-soft line-clamp-2 break-words">{e.message}</p>}
        <EnrollmentPhone phone={e.phone} name={name} />
        {e.interview?.status === 'scheduled' && (
          <p className="text-xs font-semibold text-ink-soft">Entrevista: {interviewWhen(e.interview)}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {e.status === 'pending' && (
            <Button variant="primary" disabled={busy} onClick={() => onDecide('approved')} aria-label={`Aprobar a ${name}`} className="!h-9 !px-3 !text-[13px]">
              <Check size={16} strokeWidth={2.25} aria-hidden="true" />Aprobar
            </Button>
          )}
          {open && (
            <Button variant="text" disabled={busy} onClick={() => onDecide('rejected')} aria-label={`Rechazar a ${name}`} className="!h-9 !px-2 !text-[13px]">
              <X size={16} strokeWidth={2} aria-hidden="true" />Rechazar
            </Button>
          )}
          {e.has_cv && (
            <Button variant="text" onClick={() => void viewCv()} aria-label={`Ver CV de ${name}`} className="!h-9 !px-2 !text-[13px]">
              <FileText size={16} strokeWidth={1.75} aria-hidden="true" />CV
            </Button>
          )}
          {open && (
            <ButtonLink variant="text" to={interviewHref} aria-label={`Entrevista con ${name}`} className="!h-9 !px-2 !text-[13px]">
              <CalendarClock size={16} strokeWidth={2} aria-hidden="true" />Entrevista
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  );
}
