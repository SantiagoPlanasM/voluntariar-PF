// src/app/components/SponsorshipAgreementScreen.tsx — el acuerdo de patrocinio entre una empresa y una ONG (§265).
//
// La misma pantalla para las dos partes (/company/patrocinios/:empresaId/:projectId y /ngo/patrocinios/…). Rediseño
// §325 (lienzo del 11/11): una sola lista de puntos con filtros por parte, quién agregó o editó cada uno, el total de
// dinero, y lo que cambió desde que acepté (con el historial de §324). A la derecha, la aceptación por versión y la
// charla. §327: agregar, editar o quitar puntos va a un borrador (lib/sponsorshipDraft.ts) y "Guardar cambios" lo
// manda junto como UNA versión (POST …/cambios), con la versión sobre la que se armó. Cada parte edita solo sus puntos
// y solo mientras el acuerdo está abierto; las reglas las valida el backend (routes/patrocinios.js) y su mensaje se
// muestra tal cual. Los montos solo los ven las dos partes.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router';
import { ArrowLeft, Check, History, Loader2, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { api, ApiError, SponsorshipAgreement, SponsorshipPoint, SponsorshipVersion } from '../../lib/api';
import { formatTime, timeAgo, userMessage } from '../../lib/format';
import { SPONSORSHIP_LABEL, changesSince } from '../../lib/sponsorship';
import { Draft, addPoint, draftCount, editPoint, emptyDraft, newId, removePoint, toChanges, undoRemove } from '../../lib/sponsorshipDraft';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { useConfirm } from '../ui/UiProvider';
import { LoadError, describeLoadError } from './LoadError';

export const POINT_TYPE_LABEL: Record<SponsorshipPoint['type'], string> = {
  money: 'Dinero', supplies: 'Insumos', volunteers: 'Voluntarios de la empresa', outreach: 'Difusión', other: 'Otro',
};
const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`;

/** El formulario de un punto: `id` null es uno nuevo; si no, el id del punto (guardado o `new:<clave>`). */
type Form = { id: string | null; type: SponsorshipPoint['type']; detail: string; amount: string };
type Side = SponsorshipPoint['side'];
/** Un punto como se ve: el guardado con el borrador aplicado, o uno nuevo del borrador. */
type Row = SponsorshipPoint & { pending?: 'new' | 'edited' | 'removing' };
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
  const [form, setForm] = useState<Form | null>(null);
  const [pending, setPending] = useState<Draft>(emptyDraft);
  const nextKey = useRef(0);
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

  // §327: con cambios sin guardar, cerrar o recargar la pestaña pide confirmación al navegador.
  const unsaved = draftCount(pending);
  useEffect(() => {
    if (unsaved === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

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

  // Los puntos como se ven: los guardados con el borrador aplicado, y los nuevos del borrador al final.
  const rows: Row[] = [
    ...a.points.map((pt): Row => {
      if (pending.removes.includes(pt.id)) return { ...pt, pending: 'removing' };
      const edit = pending.edits[pt.id];
      return edit ? { ...pt, ...edit, pending: 'edited' } : pt;
    }),
    ...pending.adds.map((x): Row => ({
      id: newId(x.key), side: mine, type: x.type, detail: x.detail, amount: x.amount, created_at: '', updated_at: '',
      created_by_name: null, edited_by_name: null, edited_at: null, pending: 'new',
    })),
  ];

  /** "Listo" del formulario: el punto va al borrador (no se manda nada). */
  const applyForm = () => {
    if (!form) return;
    if (!form.detail.trim()) { setError('El detalle no puede estar vacío'); return; }
    setError('');
    const fields = { type: form.type, detail: form.detail, amount: form.type === 'money' ? Number(form.amount) : null };
    setPending(d => (form.id
      ? editPoint(d, a.points.find(pt => pt.id === form.id), form.id, fields)
      : addPoint(d, String(++nextKey.current), fields)));
    setForm(null);
  };
  const save = () => void run(() => api.sponsorships.saveChanges(e, p, a.version, toChanges(pending)), () => setPending(emptyDraft()));
  const discard = async () => {
    const ok = await confirm({
      title: '¿Descartar los cambios?', body: 'Se pierden los cambios que no guardaste.',
      confirmLabel: 'Descartar cambios', cancelLabel: 'Volver', danger: true,
    });
    if (ok) { setPending(emptyDraft()); setForm(null); }
  };
  const reject = async () => {
    const ok = await confirm({
      title: '¿Rechazar el acuerdo?', body: 'Se cierra para las dos partes. La empresa puede volver a proponer después.',
      confirmLabel: 'Rechazar acuerdo', cancelLabel: 'Volver', danger: true,
    });
    if (ok) void run(() => api.sponsorships.reject(e, p));
  };

  const pointForm = () => form && (
    <div className="p-3 rounded-xl bg-surface-soft flex flex-col gap-2">
      <select aria-label="Tipo de punto" value={form.type} className={field}
        onChange={ev => setForm({ ...form, type: ev.target.value as Form['type'] })}>
        {Object.entries(POINT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input aria-label="Detalle del punto" maxLength={300} value={form.detail} className={field}
        placeholder="Ej: 10 empleados una jornada" onChange={ev => setForm({ ...form, detail: ev.target.value })} />
      {form.type === 'money' && (
        <input aria-label="Monto en pesos" type="number" min="1" value={form.amount} className={field}
          onChange={ev => setForm({ ...form, amount: ev.target.value })} />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={applyForm} className={`${btn} flex-1 bg-ink text-on-ink`}>Listo</button>
        <button type="button" onClick={() => setForm(null)} className={`${btn} bg-surface text-ink`}>Cancelar</button>
      </div>
    </div>
  );

  const visible = rows.filter(r => r.pending !== 'removing');
  const count = (side: Side) => visible.filter(pt => pt.side === side).length;
  const filters: { id: 'all' | Side; label: string }[] = [
    { id: 'all', label: `Todos · ${visible.length}` },
    { id: 'company', label: `${sideLabel('company')} · ${count('company')}` },
    { id: 'ngo', label: `${sideLabel('ngo')} · ${count('ngo')}` },
  ];
  const shown = rows.filter(pt => filter === 'all' || pt.side === filter);
  const totalMoney = visible.reduce((s, pt) => s + (pt.type === 'money' && pt.amount ? pt.amount : 0), 0);

  const meta = (pt: SponsorshipPoint) => [
    pt.created_by_name ? `Agregado por ${pt.created_by_name}` : null,
    pt.edited_by_name && pt.edited_at ? `editado por ${pt.edited_by_name} · ${timeAgo(pt.edited_at)}` : null,
  ].filter(Boolean).join(' · ');

  const pointRow = (pt: Row) => {
    if (form?.id === pt.id) return <li key={pt.id} className="px-4 py-3 border-t border-hairline">{pointForm()}</li>;
    const own = pt.side === mine && open;
    const removing = pt.pending === 'removing';
    const change = since?.points.get(pt.id);   // los `new:` nunca están: son del borrador
    const info = meta(pt);
    return (
      <li key={pt.id} className={`px-4 py-3.5 border-t border-hairline flex items-start gap-3 ${change || pt.pending ? 'bg-surface-soft' : ''}`}>
        <div className={`min-w-0 flex-1 flex flex-col gap-1 ${removing ? 'opacity-70' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink-soft">{sideLabel(pt.side)}</span>
            <span className="h-[22px] px-2 rounded-md bg-surface-soft text-xs font-semibold text-ink-soft inline-flex items-center">{POINT_TYPE_LABEL[pt.type]}</span>
            {change && (
              <span className="h-[22px] px-2 rounded-md bg-ink text-on-ink text-xs font-bold inline-flex items-center">
                {change.kind === 'add' ? 'Nuevo desde que aceptaste' : 'Cambió desde que aceptaste'}
              </span>
            )}
            {(pt.pending === 'new' || pt.pending === 'edited') && (
              <span className="h-[22px] px-2 rounded-md border border-dashed border-border-strong text-xs font-bold text-ink inline-flex items-center">Sin guardar</span>
            )}
            {removing && (
              <span className="h-[22px] px-2 rounded-md border border-dashed border-border-strong text-xs font-bold text-ink inline-flex items-center">Se va a quitar</span>
            )}
          </div>
          <p className={`text-[15px] leading-snug ${removing ? 'line-through' : ''}`}>{pt.detail}</p>
          {pt.amount != null && <p className={`text-[15px] font-bold text-brand-text ${removing ? 'line-through' : ''}`}>{money(pt.amount)}</p>}
          {change?.kind === 'edit' && change.before && (
            <p className="text-[13px] text-ink-soft">
              Antes: <s>{change.before.detail}</s>
              {change.before.amount != null && change.before.amount !== pt.amount && <> · <s>{money(change.before.amount)}</s></>}
            </p>
          )}
          {info && <p className="text-xs text-ink-muted">{info}</p>}
        </div>
        {own && (removing ? (
          <button type="button" aria-label={`Deshacer: ${pt.detail}`} onClick={() => setPending(d => undoRemove(d, pt.id))}
            className="h-11 px-3 rounded-full hover:bg-surface-pressed inline-flex items-center gap-1.5 text-sm font-semibold text-ink flex-shrink-0">
            <Undo2 size={16} aria-hidden="true" />Deshacer
          </button>
        ) : (
          <div className="flex flex-shrink-0">
            <button type="button" aria-label={`Editar punto: ${pt.detail}`}
              onClick={() => setForm({ id: pt.id, type: pt.type, detail: pt.detail, amount: pt.amount == null ? '' : String(pt.amount) })}
              className="w-11 h-11 rounded-full hover:bg-surface-pressed inline-flex items-center justify-center text-ink-soft">
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Borrar punto: ${pt.detail}`} onClick={() => setPending(d => removePoint(d, pt.id))}
              className="w-11 h-11 rounded-full hover:bg-surface-pressed inline-flex items-center justify-center text-critical">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
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
  // Acuerdos de antes de §324: si el historial empieza después de mi aceptación, la cuenta solo ve lo registrado.
  const oldest = versions && versions.length ? Math.min(...versions.map(v => v.version)) : null;
  const partial = !!since && oldest != null && oldest > myAccepted! + 1;
  const headline = partial
    ? (n === 0 ? 'Hubo cambios' : n === 1 ? 'Cambió al menos 1 punto' : `Cambiaron al menos ${n} puntos`)
    : (n === 1 ? 'Cambió 1 punto' : `Cambiaron ${n} puntos`);

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

        {(n > 0 || partial) && (
          <section aria-label="Cambios desde tu aceptación" className={`${card} px-4 py-3 flex flex-col gap-1`}>
            <p className="text-sm font-bold">{headline} desde que aceptaste la versión {myAccepted}.</p>
            {partial && <p className="text-[13px] text-ink-soft">Los cambios de antes de la versión {oldest} no se guardaban.</p>}
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
          {/* Sin overflow-hidden: rompería el sticky de la barra "Cambios sin guardar" (visto en Chrome, §327). */}
          <section aria-labelledby="puntos-acuerdo" className={card}>
            <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="puntos-acuerdo" className="text-[17px] font-bold">Puntos del acuerdo</h2>
                {totalMoney > 0 && (
                  <p className="text-sm text-ink-soft">Dinero comprometido: <strong className="text-brand-text">{money(totalMoney)}</strong></p>
                )}
              </div>
              {rows.length > 0 && (
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
            {rows.length === 0 && <p className="px-4 pb-4 text-sm text-ink-muted">Todavía no hay puntos.</p>}
            {rows.length > 0 && shown.length === 0 && <p className="px-4 pb-4 text-sm text-ink-muted">No hay puntos de esta parte.</p>}
            <ul>{shown.map(pointRow)}</ul>
            {open && (
              <div className="px-4 py-3 border-t border-hairline">
                {form && !form.id ? pointForm() : (
                  <button type="button" onClick={() => setForm({ id: null, type: 'supplies', detail: '', amount: '' })}
                    className={`${btn} bg-surface-soft text-ink`}>
                    <Plus size={16} aria-hidden="true" />Agregar punto
                  </button>
                )}
              </div>
            )}
            {/* §327: el borrador se guarda junto, como una versión. */}
            {open && unsaved > 0 && (
              // Pegada abajo mientras se ve la lista; en el celular, arriba de la barra inferior de la app (56 px).
              <section aria-label="Cambios sin guardar" className="sticky bottom-[calc(56px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-10 rounded-b-2xl px-4 py-3 border-t border-hairline bg-surface flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{unsaved === 1 ? '1 cambio sin guardar' : `${unsaved} cambios sin guardar`}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void discard()} className={`${btn} bg-surface-soft text-ink`}>Descartar</button>
                  <button type="button" disabled={busy} onClick={save} className={`${btn} bg-ink text-on-ink`}>Guardar cambios</button>
                </div>
              </section>
            )}
          </section>

          <div className="flex flex-col gap-4 min-w-0">
            <section aria-label="Aceptación" className={`${card} p-4 flex flex-col gap-2`}>
              {open ? (
                <>
                  {status('company')}
                  {status('ngo')}
                  <p className="text-xs text-ink-muted">El acuerdo se cierra cuando las dos partes aceptan la misma versión. Cuando alguien guarda cambios en los puntos, hay que volver a aceptar.</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {a.accepted[mine]
                      ? <p className="text-sm font-semibold text-people-text">Ya aceptaste esta versión</p>
                      : <button type="button" disabled={busy || unsaved > 0} onClick={() => void run(() => api.sponsorships.accept(e, p, a.version))}
                          className={`${btn} bg-ink text-on-ink`}>Estoy de acuerdo</button>}
                    <button type="button" disabled={busy} onClick={() => void reject()} className={`${btn} bg-surface-soft text-critical`}>Rechazar acuerdo</button>
                  </div>
                  {unsaved > 0 && !a.accepted[mine] && <p className="text-xs text-ink-soft">Guardá o descartá tus cambios antes de aceptar.</p>}
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
