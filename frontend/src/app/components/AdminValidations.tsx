// Panel de administración: validaciones de ONG (/admin/validaciones, §317; DESIGN.md → Validación de ONGs, "Revisión").
// Lo usan los mails de ADMIN_EMAILS, sean del rol que sean. La autorización es de la API (regla 15): si responde 403,
// la pantalla lo dice. Cada fila: la ONG, el CUIT, la personería, los dos PDF (link firmado que vence) y, si está en
// revisión, "Aprobar" (con confirmación) o "Rechazar" (con el motivo, que le llega a la ONG por notificación y email).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FileText, Loader2 } from 'lucide-react';
import { api, AdminValidation, ApiError, ValidationDoc } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { openSignedLink } from '../../lib/cv';
import { timeAgo, userMessage } from '../../lib/format';
import { REASON_MAX, checkRejectReason, legalTypeLabel } from '../../lib/ngoValidation';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/UiProvider';
import { InlineError } from './LoadError';
import { ValidationChip } from './NGOValidation';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
const DOCS: { key: ValidationDoc; view: string }[] = [
  { key: 'statute', view: 'Ver estatuto' },
  { key: 'registration', view: 'Ver constancia' },
];

export function AdminValidations() {
  const { user, openAuthModal } = useAuth();
  const [all, setAll] = useState(false);
  const [items, setItems] = useState<AdminValidation[] | null>(null);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);

  const load = useCallback(() => {
    setError(null);
    setItems(null);
    api.admin.validations.list(all)
      .then(({ validations }) => setItems(validations))
      .catch((err) => setError(err instanceof ApiError && err.status === 403
        ? { message: 'Esta pantalla es solo para el equipo de VoluntariAR.', forbidden: true }
        : { message: userMessage(err, NETWORK_ERROR), forbidden: false }));
  }, [all]);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) {
    return (
      <div className="min-h-screen bg-canvas-soft flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] text-ink-soft">Iniciá sesión para ver las validaciones.</p>
        <button type="button" onClick={() => openAuthModal()} className="h-10 px-4 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold">Iniciar sesión</button>
      </div>
    );
  }

  const replace = (v: AdminValidation) => setItems((list) => list?.map((x) => (x.id === v.id ? v : x)) ?? list);
  const filters = [{ key: false, label: 'En revisión' }, { key: true, label: 'Todas' }];

  return (
    <div className="min-h-screen bg-canvas-soft pb-8">
      <div className="max-w-[720px] mx-auto px-4 pt-4 md:pt-8 flex flex-col gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.3px]">Validaciones de ONG</h1>
        {error?.forbidden ? (
          <p className="text-[15px] text-ink-soft">{error.message}</p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Qué validaciones ver" className="h-10 p-1 rounded-[10px] bg-surface-soft flex max-w-[320px]">
              {filters.map((f) => (
                <button key={f.label} type="button" role="radio" aria-checked={all === f.key} onClick={() => setAll(f.key)}
                  className={`flex-1 rounded-lg text-[13px] transition-colors ${all === f.key ? 'bg-surface font-bold text-ink' : 'font-semibold text-ink-soft'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {error ? (
              <InlineError message={error.message} onRetry={load} />
            ) : !items ? (
              <Loader2 className="w-5 h-5 animate-spin text-ink-muted" aria-label="Cargando" />
            ) : items.length === 0 ? (
              <p className="text-[15px] text-ink-soft">{all ? 'Todavía no hay validaciones.' : 'No hay validaciones en revisión.'}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((v) => <ValidationRow key={v.id} v={v} onChange={replace} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ValidationRow({ v, onChange }: { v: AdminValidation; onChange: (v: AdminValidation) => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<'open' | 'decide' | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const run = async (kind: 'open' | 'decide', fn: () => Promise<void>) => {
    setError('');
    setBusy(kind);
    try { await fn(); }
    catch (err) { setError(userMessage(err, NETWORK_ERROR)); }
    finally { setBusy(null); }
  };

  const approve = async () => {
    const ok = await confirm({
      title: `¿Validar ${v.ngo_name}?`,
      body: 'Va a aparecer con la insignia azul. Le avisamos por notificación y por email.',
      confirmLabel: 'Validar', cancelLabel: 'Volver',
    });
    if (!ok) return;
    await run('decide', async () => { onChange((await api.admin.validations.approve(v.id)).validation); });
  };

  const reject = async () => {
    const problem = checkRejectReason(reason);
    if (problem) { setError(problem); return; }
    await run('decide', async () => {
      const { validation } = await api.admin.validations.reject(v.id, reason.trim());
      setRejecting(false);
      onChange(validation);
    });
  };

  const pending = v.status === 'pending';
  return (
    <article aria-label={v.ngo_name} className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/ngo/${encodeURIComponent(v.ngo_id)}`} className="text-[15px] font-bold hover:underline">{v.ngo_name}</Link>
          <p className="text-[13px] text-ink-soft">CUIT {v.cuit} · {legalTypeLabel(v.legal_type)}</p>
          <p className="text-[13px] text-ink-muted">Enviada {timeAgo(v.submitted_at)}</p>
        </div>
        <ValidationChip status={v.status} />
      </div>
      {v.status === 'rejected' && v.reason && (
        <p className="text-[13px] text-ink-soft whitespace-pre-line break-words">Motivo: {v.reason}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {DOCS.map((d) => (
          <Button key={d.key} variant="secondary" disabled={busy !== null}
            onClick={() => void run('open', () => openSignedLink(() => api.admin.validations.document(v.id, d.key)))}>
            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />{d.view}
          </Button>
        ))}
        {pending && !rejecting && (
          <>
            <Button variant="primary" disabled={busy !== null} onClick={() => void approve()}>Aprobar</Button>
            <Button variant="text" disabled={busy !== null} onClick={() => { setError(''); setRejecting(true); }}>Rechazar</Button>
          </>
        )}
      </div>
      {pending && rejecting && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`reason-${v.id}`} className="text-[13px] font-semibold text-ink-soft">Motivo del rechazo</label>
          <textarea id={`reason-${v.id}`} rows={3} maxLength={REASON_MAX} value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            className="w-full px-3.5 py-2.5 rounded-[10px] bg-surface-soft text-[15px] border-[1.5px] border-hairline focus:bg-surface focus:border-ink outline-none" />
          <p className="text-[13px] text-ink-muted text-right">{reason.length}/{REASON_MAX}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" busy={busy === 'decide'} busyLabel="Rechazando…" onClick={() => void reject()}>Confirmar rechazo</Button>
            <Button variant="text" disabled={busy !== null} onClick={() => { setRejecting(false); setError(''); }}>Cancelar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
    </article>
  );
}
