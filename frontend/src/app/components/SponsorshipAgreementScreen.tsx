// src/app/components/SponsorshipAgreementScreen.tsx — el acuerdo de patrocinio entre una empresa y una ONG (§265).
//
// La misma pantalla para las dos partes (/company/patrocinios/:empresaId/:projectId y /ngo/patrocinios/…): dos
// columnas de puntos (lo que aporta la empresa, lo que pide u ofrece la ONG), la aceptación por versión y la charla.
// Cada parte edita solo su columna y solo mientras el acuerdo está abierto; las reglas las valida el backend
// (routes/patrocinios.js) y su mensaje se muestra tal cual. Los montos solo los ven las dos partes.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, SponsorshipAgreement, SponsorshipPoint, SponsorshipPointInput } from '../../lib/api';
import { formatTime, userMessage } from '../../lib/format';
import { SPONSORSHIP_LABEL } from '../../lib/sponsorship';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { useConfirm } from '../ui/UiProvider';
import { LoadError, describeLoadError } from './LoadError';

export const POINT_TYPE_LABEL: Record<SponsorshipPoint['type'], string> = {
  money: 'Dinero', supplies: 'Insumos', volunteers: 'Voluntarios de la empresa', outreach: 'Difusión', other: 'Otro',
};
const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`;

type Draft = { id: string | null; type: SponsorshipPoint['type']; detail: string; amount: string };
const field = 'w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btn = 'h-10 px-4 rounded-[10px] text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40';

export function SponsorshipAgreementScreen() {
  const { empresaId, projectId } = useParams();
  const confirm = useConfirm();
  const latest = useLatestRequest();
  const [a, setA] = useState<SponsorshipAgreement | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
  if (loadError) return <LoadError message={loadError.message} onRetry={loadError.retry ? load : undefined} home={back} />;
  if (!a) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-ink-muted" aria-label="Cargando" /></div>;

  const open = a.status === 'propuesto';
  const mine = a.my_side;
  const e = a.company_id, p = a.project_id;

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

  const column = (side: 'company' | 'ngo') => {
    const title = side === 'company' ? `Lo que aporta ${a.company_name}` : `Lo que pide u ofrece ${a.ngo_name}`;
    const own = side === mine && open;
    const pts = a.points.filter(pt => pt.side === side);
    return (
      <section aria-label={title} className="bg-surface rounded-2xl border border-hairline p-4 flex flex-col gap-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {pts.length === 0 && <p className="text-sm text-ink-muted">Todavía no hay puntos.</p>}
        <ul className="flex flex-col gap-2">
          {pts.map(pt => (draft?.id === pt.id ? <li key={pt.id}>{pointForm()}</li> : (
            <li key={pt.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-soft">{POINT_TYPE_LABEL[pt.type]}</p>
                <p className="text-sm">{pt.detail}</p>
                {pt.amount != null && <p className="text-sm font-semibold">{money(pt.amount)}</p>}
              </div>
              {own && (
                <>
                  <button type="button" aria-label={`Editar punto: ${pt.detail}`} disabled={busy}
                    onClick={() => setDraft({ id: pt.id, type: pt.type, detail: pt.detail, amount: pt.amount == null ? '' : String(pt.amount) })}
                    className="w-9 h-9 rounded-full hover:bg-surface-soft inline-flex items-center justify-center text-ink-muted">
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Borrar punto: ${pt.detail}`} disabled={busy} onClick={() => void removePoint(pt)}
                    className="w-9 h-9 rounded-full hover:bg-surface-soft inline-flex items-center justify-center text-critical">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          )))}
        </ul>
        {own && (draft && !draft.id ? pointForm() : (
          <button type="button" onClick={() => setDraft({ id: null, type: 'supplies', detail: '', amount: '' })}
            className={`${btn} self-start bg-surface-soft text-ink`}>
            <Plus size={16} aria-hidden="true" />Agregar punto
          </button>
        ))}
      </section>
    );
  };

  const status = (name: string, ok: boolean) => (
    <p className="text-sm flex items-center gap-1.5">
      {ok && <Check size={16} className="text-people-text" aria-hidden="true" />}
      {`${name}: ${ok ? 'de acuerdo con esta versión' : 'pendiente'}`}
    </p>
  );

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-8">
      <div className="max-w-[960px] mx-auto px-4 pt-4 md:pt-8 flex flex-col gap-4">
        <Link to={back} className="text-sm text-ink-soft inline-flex items-center gap-1 self-start">
          <ArrowLeft size={16} aria-hidden="true" />Volver
        </Link>
        <header>
          <h1 className="text-[22px] font-bold tracking-[-0.3px]">Acuerdo de patrocinio</h1>
          <p className="text-[15px] font-semibold">{a.project_title}</p>
          <p className="text-sm text-ink-soft">{a.company_name} · {a.ngo_name} · versión {a.version}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">{column('company')}{column('ngo')}</div>

        <section aria-label="Aceptación" className="bg-surface rounded-2xl border border-hairline p-4 flex flex-col gap-2">
          {open ? (
            <>
              {status(a.company_name, a.accepted.company)}
              {status(a.ngo_name, a.accepted.ngo)}
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

        <section aria-label="Charla" className="bg-surface rounded-2xl border border-hairline p-4 flex flex-col gap-3">
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
  );
}
