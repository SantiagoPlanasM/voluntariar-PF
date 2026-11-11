// src/app/components/SponsorshipAgreementScreen.tsx — el acuerdo de patrocinio entre una empresa y una ONG (§265).
//
// La misma pantalla para las dos partes (/company/patrocinios/:empresaId/:projectId y /ngo/patrocinios/…). Rediseño
// §325 (lienzo del 11/11): una sola lista de puntos con filtros por parte, quién agregó o editó cada uno, el total de
// dinero, y lo que cambió desde que acepté (con el historial de §324). A la derecha, la aceptación por versión y la
// charla. Cada parte edita solo sus puntos y solo mientras el acuerdo está abierto; las reglas las valida el backend
// (routes/patrocinios.js) y su mensaje se muestra tal cual. Los montos solo los ven las dos partes.
import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router';
import { ArrowLeft, Check, History, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, SponsorshipAgreement, SponsorshipPoint, SponsorshipPointInput, SponsorshipVersion } from '../../lib/api';
import { formatTime, timeAgo, userMessage } from '../../lib/format';
import { SPONSORSHIP_LABEL, changesSince } from '../../lib/sponsorship';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { useConfirm } from '../ui/UiProvider';
import { LoadError, describeLoadError } from './LoadError';

export const POINT_TYPE_LABEL: Record<SponsorshipPoint['type'], string> = {
  money: 'Dinero', supplies: 'Insumos', volunteers: 'Voluntarios de la empresa', outreach: 'Difusión', other: 'Otro',
};
const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`;

type Draft = { id: string | null; type: SponsorshipPoint['type']; detail: string; amount: string };
type Side = SponsorshipPoint['side'];
const field = 'w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btn = 'h-10 px-4 rounded-[10px] text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40';
const card = 'bg-surface rounded-2xl border border-hairline';

export function SponsorshipAgreementScreen() {
  const { empresaId, projectId } = useParams();
  const { pathname } = useLocation();
  const confirm = useConfirm();
  const latest = useLatestRequest();
  const [a, setA] = useState<SponsorshipAgreement | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | Side>('all');
  const [versions, setVersions] = useState<SponsorshipVersion[] | null>(null);

  const load = async () => {
    const req = latest.start();
    setLoadError(null);
    try {
      const { agreement } = await api.sponsorships.get(empresaId!, projectId!);
      if (latest.isLatest(req)) setA(agreement);
    } catch (e) {
      if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos este acuerdo'));
    }
  };
  useEffect(() => { void load(); }, [empresaId, projectId]);

  // §325: el historial solo hace falta si acepté una versión anterior a la vigente y el acuerdo sigue abierto. Si
  // falla, la pantalla sigue sin marcas (es una ayuda, no el acuerdo).
  const myAccepted = a ? a.accepted_versions[a.my_side] : null;
  const needsHistory = !!a && a.status === 'propuesto' && myAccepted != null && myAccepted < a.version;
  useEffect(() => {
    if (!needsHistory) { setVersions(null); return; }
    let live = true;
    api.sponsorships.history(empresaId!, projectId!)
      .then(r => { if (live) setVersions(r.versions); })
      .catch(() => { if (live) setVersions(null); });
    return () => { live = false; };
  }, [needsHistory, a?.version, empresaId, projectId]);

  /** Corre un cambio: muestra el acuerdo que devuelve, o el error; si el acuerdo cambió o se cerró (409), recarga. */
  const run = async (call: () => Promise<{ agreement: SponsorshipAgreement }>, after?: () => void) => {
    setBusy(true);
    setError('');
    try {
      const { agreement } = await call();
      setA(agreement);
      after?.();
    } catch (e) {
      setError(userMessage(e, 'No pudimos guardar el cambio. Revisá tu conexión y probá de nuevo.'));
      if (e instanceof ApiError && e.status === 409) void load();
    } finally {
      setBusy(false);
    }
  };

  const back = a?.my_side === 'ngo' ? '/ngo/patrocinios' : '/company/profile';
  const historyUrl = `${pathname.replace(/\/$/, '')}/historial`;   // §326: misma URL + /historial, bajo /ngo o /company
  if (loadError) return <LoadError message={loadError.message} onRetry={loadError.retry ? load : undefined} home={back} />;
  if (!a) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-ink-muted" aria-label="Cargando" /></div>;

  const open = a.status === 'propuesto';
  const mine = a.my_side;
  const e = a.company_id, p = a.project_id;
  const partyName = (side: Side) => (side === 'company' ? a.company_name : a.ngo_name);
  const sideLabel = (side: Side) => (side === 'company' ? `Aporta ${a.company_name}` : `Ofrece ${a.ngo_name}`);
  const since = needsHistory && versions ? changesSince(versions, myAccepted!) : null;

  const savePoint = () => {
    if (!draft) return;
    const body: SponsorshipPointInput = { type: draft.type, detail: draft.detail.trim() };
    if (draft.type === 'money') body.amount = Number(draft.amount);
    void run(() => (draft.id ? api.sponsorships.updatePoint(e, p, draft.id, body) : api.sponsorships.addPoint(e, p, body)), () => setDraft(null));
  };
  const removePoint = async (pt: SponsorshipPoint) => {
    const ok = await confirm({ title: '¿Borrar este punto?', body: pt.detail, confirmLabel: 'Borrar punto', cancelLabel: 'Volver', danger: true });
    if (ok) void run(() => api.sponsorships.deletePoint(e, p, pt.id));
  };
  const reject = async () => {
    const ok = await confirm({
      title: '¿Rechazar el acuerdo?', body: 'Se cierra para las dos partes. La empresa puede volver a proponer después.',
      confirmLabel: 'Rechazar acuerdo', cancelLabel: 'Volver', danger: true,
    });
    if (ok) void run(() => api.sponsorships.reject(e, p));
  };

  const pointForm = () => draft && (
    <div className="p-3 rounded-xl bg-surface-soft flex flex-col gap-2">
      <select aria-label="Tipo de punto" value={draft.type} className={field}
        onChange={ev => setDraft({ ...draft, type: ev.target.value as Draft['type'] })}>
        {Object.entries(POINT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input aria-label="Detalle del punto" maxLength={300} value={draft.detail} className={field}
        placeholder="Ej: 10 empleados una jornada" onChange={ev => setDraft({ ...draft, detail: ev.target.value })} />
      {draft.type === 'money' && (
        <input aria-label="Monto en pesos" type="number" min="1" value={draft.amount} className={field}
          onChange={ev => setDraft({ ...draft, amount: ev.target.value })} />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={savePoint} disabled={busy} className={`${btn} flex-1 bg-ink text-on-ink`}>Guardar punto</button>
        <button type="button" onClick={() => setDraft(null)} disabled={busy} className={`${btn} bg-surface text-ink`}>Cancelar</button>
      </div>
    </div>
  );

  const count = (side: Side) => a.points.filter(pt => pt.side === side).length;
  const filters: { id: 'all' | Side; label: string }[] = [
    { id: 'all', label: `Todos · ${a.points.length}` },
    { id: 'company', label: `${sideLabel('company')} · ${count('company')}` },
    { id: 'ngo', label: `${sideLabel('ngo')} · ${count('ngo')}` },
  ];
  const shown = a.points.filter(pt => filter === 'all' || pt.side === filter);
  const totalMoney = a.points.reduce((s, pt) => s + (pt.type === 'money' && pt.amount ? pt.amount : 0), 0);

  const meta = (pt: SponsorshipPoint) => [
    pt.created_by_name ? `Agregado por ${pt.created_by_name}` : null,
    pt.edited_by_name && pt.edited_at ? `editado por ${pt.edited_by_name} · ${timeAgo(pt.edited_at)}` : null,
  ].filter(Boolean).join(' · ');

  const pointRow = (pt: SponsorshipPoint) => {
    if (draft?.id === pt.id) return <li key={pt.id} className="px-4 py-3 border-t border-hairline">{pointForm()}</li>;
    const own = pt.side === mine && open;
    const change = since?.points.get(pt.id);
    const info = meta(pt);
    return (
      <li key={pt.id} className={`px-4 py-3.5 border-t border-hairline flex items-start gap-3 ${change ? 'bg-surface-soft' : ''}`}>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink-soft">{sideLabel(pt.side)}</span>
            <span className="h-[22px] px-2 rounded-md bg-surface-soft text-xs font-semibold text-ink-soft inline-flex items-center">{POINT_TYPE_LABEL[pt.type]}</span>
            {change && (
              <span className="h-[22px] px-2 rounded-md bg-ink text-on-ink text-xs font-bold inline-flex items-center">
                {change.kind === 'add' ? 'Nuevo desde que aceptaste' : 'Cambió desde que aceptaste'}
              </span>
            )}
          </div>
          <p className="text-[15px] leading-snug">{pt.detail}</p>
          {pt.amount != null && <p className="text-[15px] font-bold text-brand-text">{money(pt.amount)}</p>}
          {change?.kind === 'edit' && change.before && (
            <p className="text-[13px] text-ink-soft">
              Antes: <s>{change.before.detail}</s>
              {change.before.amount != null && change.before.amount !== pt.amount && <> · <s>{money(change.before.amount)}</s></>}
            </p>
          )}
          {info && <p className="text-xs text-ink-muted">{info}</p>}
        </div>
        {own && (
          <div className="flex flex-shrink-0">
            <button type="button" aria-label={`Editar punto: ${pt.detail}`} disabled={busy}
              onClick={() => setDraft({ id: pt.id, type: pt.type, detail: pt.detail, amount: pt.amount == null ? '' : String(pt.amount) })}
              className="w-11 h-11 rounded-full hover:bg-surface-pressed inline-flex items-center justify-center text-ink-soft">
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Borrar punto: ${pt.detail}`} disabled={busy} onClick={() => void removePoint(pt)}
              className="w-11 h-11 rounded-full hover:bg-surface-pressed inline-flex items-center justify-center text-critical">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </li>
    );
  };

  const status = (side: Side) => {
    const ok = a.accepted[side];
    const prev = a.accepted_versions[side];
    const at = a.accepted_at[side];
    return (
      <div className="flex flex-col">
        <p className="text-sm flex items-center gap-1.5">
          {ok && <Check size={16} className="text-people-text" aria-hidden="true" />}
          {`${partyName(side)}: ${ok ? 'de acuerdo con esta versión' : 'pendiente'}`}
        </p>
        {ok && at && <p className="text-xs text-ink-muted pl-[22px]">{timeAgo(at)}</p>}
        {!ok && prev != null && (
          <p className="text-xs text-ink-muted">{side === mine ? 'Habías' : 'Había'} aceptado la versión {prev}</p>
        )}
      </div>
    );
  };

  const n = since?.count ?? 0;
  const removed = since?.removed ?? [];

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-8">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-4 md:pt-8 flex flex-col gap-4">
        <Link to={back} className="text-sm text-ink-soft inline-flex items-center gap-1 self-start">
          <ArrowLeft size={16} aria-hidden="true" />Volver
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">Acuerdo de patrocinio</h1>
            <p className="text-[15px] font-semibold">{a.project_title}</p>
            <p className="text-sm text-ink-soft">{a.company_name} · {a.ngo_name} · versión {a.version}</p>
          </div>
          {/* §326: el historial de versiones */}
          <Link to={historyUrl} className={`${btn} bg-surface border border-hairline text-ink`}>
            <History size={16} aria-hidden="true" />Historial de versiones
          </Link>
        </header>

        {n > 0 && (
          <section aria-label="Cambios desde tu aceptación" className={`${card} px-4 py-3 flex flex-col gap-1`}>
            <p className="text-sm font-bold">
              {n === 1 ? 'Cambió 1 punto' : `Cambiaron ${n} puntos`} desde que aceptaste la versión {myAccepted}.
            </p>
            <p className="text-[13px] text-ink-soft">Están marcados abajo. Revisalos y, si estás de acuerdo, aceptá la versión {a.version}.</p>
            {removed.length > 0 && (
              <p className="text-[13px] text-ink-soft">
                {removed.length === 1 ? 'Se quitó' : 'Se quitaron'}: {removed.map(r => r.detail).join(', ')}
              </p>
            )}
            <Link to={historyUrl} className="self-start mt-1 text-[13px] font-bold underline underline-offset-2">Ver qué cambió</Link>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
          <section aria-labelledby="puntos-acuerdo" className={`${card} overflow-hidden`}>
            <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="puntos-acuerdo" className="text-[17px] font-bold">Puntos del acuerdo</h2>
                {totalMoney > 0 && (
                  <p className="text-sm text-ink-soft">Dinero comprometido: <strong className="text-brand-text">{money(totalMoney)}</strong></p>
                )}
              </div>
              {a.points.length > 0 && (
                <div role="group" aria-label="Filtrar por parte" className="flex flex-wrap gap-2">
                  {filters.map(f => (
                    <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                      className={`h-9 px-3 rounded-full text-[13px] font-bold border ${filter === f.id ? 'bg-ink text-on-ink border-ink' : 'bg-surface text-ink-soft border-hairline'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {a.points.length === 0 && <p className="px-4 pb-4 text-sm text-ink-muted">Todavía no hay puntos.</p>}
            {a.points.length > 0 && shown.length === 0 && <p className="px-4 pb-4 text-sm text-ink-muted">No hay puntos de esta parte.</p>}
            <ul>{shown.map(pointRow)}</ul>
            {open && (
              <div className="px-4 py-3 border-t border-hairline">
                {draft && !draft.id ? pointForm() : (
                  <button type="button" onClick={() => setDraft({ id: null, type: 'supplies', detail: '', amount: '' })}
                    className={`${btn} bg-surface-soft text-ink`}>
                    <Plus size={16} aria-hidden="true" />Agregar punto
                  </button>
                )}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-4 min-w-0">
            <section aria-label="Aceptación" className={`${card} p-4 flex flex-col gap-2`}>
              {open ? (
                <>
                  {status('company')}
                  {status('ngo')}
                  <p className="text-xs text-ink-muted">El acuerdo se cierra cuando las dos partes aceptan la misma versión. Si alguien cambia un punto, hay que volver a aceptar.</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {a.accepted[mine]
                      ? <p className="text-sm font-semibold text-people-text">Ya aceptaste esta versión</p>
                      : <button type="button" disabled={busy} onClick={() => void run(() => api.sponsorships.accept(e, p, a.version))}
                          className={`${btn} bg-ink text-on-ink`}>Estoy de acuerdo</button>}
                    <button type="button" disabled={busy} onClick={() => void reject()} className={`${btn} bg-surface-soft text-critical`}>Rechazar acuerdo</button>
                  </div>
                </>
              ) : (
                <p className="text-sm font-semibold">Acuerdo cerrado: {SPONSORSHIP_LABEL[a.status]}</p>
              )}
              {error && <p role="alert" className="text-sm text-critical">{error}</p>}
            </section>

            <section aria-label="Charla" className={`${card} p-4 flex flex-col gap-3`}>
              <h2 className="text-[15px] font-bold">Charla</h2>
              <ul className="flex flex-col gap-2">
                {a.message && (
                  <li className="text-sm"><span className="font-semibold">{a.company_name}</span> <span className="text-ink-muted">(al proponer)</span><p>{a.message}</p></li>
                )}
                {a.messages.map(m => (
                  <li key={m.id} className="text-sm">
                    <span className="font-semibold">{m.author_name}</span> <span className="text-ink-muted">{formatTime(m.created_at)}</span>
                    <p className="whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
                {!a.message && a.messages.length === 0 && <li className="text-sm text-ink-muted">Todavía no hay mensajes.</li>}
              </ul>
              {open && (
                <div className="flex gap-2">
                  <textarea aria-label="Escribir un mensaje" rows={2} maxLength={1000} value={text} onChange={ev => setText(ev.target.value)}
                    className={`${field} flex-1 resize-none`} placeholder="Escribí a la otra parte…" />
                  <button type="button" disabled={busy || !text.trim()} className={`${btn} bg-ink text-on-ink self-end`}
                    onClick={() => void run(() => api.sponsorships.sendMessage(e, p, text.trim()), () => setText(''))}>Enviar</button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
