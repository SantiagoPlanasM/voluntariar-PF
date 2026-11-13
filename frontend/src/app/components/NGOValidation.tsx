// "Validar la ONG" (/ngo/validacion) y su acceso en el Panel (§317; DESIGN.md → Validación de ONGs).
// La ONG manda CUIT, tipo de personería, estatuto y constancia (PDF privados, como el CV); el equipo de VoluntariAR la
// revisa en /admin/validaciones. "Validada" es solo la insignia azul: sin validar puede publicar y recibir postulaciones.
// Estados: sin pedido o rechazada → el formulario (rechazada, con el motivo); en revisión o validada → los datos enviados.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, BadgeCheck, FileText, Loader2 } from 'lucide-react';
import { api, LegalType, NgoValidation, ValidationDoc } from '../../lib/api';
import { openSignedLink } from '../../lib/cv';
import { userMessage } from '../../lib/format';
import { LEGAL_TYPE_OPTIONS, STATUS_LABEL, checkValidationDoc, legalTypeLabel } from '../../lib/ngoValidation';
import { Button } from '../ui/Button';
import { PROFILE_FIELD } from '../ui/fieldStyles';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { InlineError } from './LoadError';
import { ShortcutCard } from './ShortcutCard';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
const REVIEW_TIME = 'Tarda hasta 5 días hábiles. Te avisamos por notificación y por email.';
const DOCS: { key: ValidationDoc; label: string; view: string }[] = [
  { key: 'statute', label: 'Estatuto (PDF)', view: 'Ver estatuto' },
  { key: 'registration', label: 'Constancia de inscripción (PDF)', view: 'Ver constancia' },
];

/** El estado como chip (DESIGN.md): validada en azul con la insignia; el resto, gris. */
export function ValidationChip({ status }: { status: NgoValidation['status'] }) {
  const approved = status === 'approved';
  return (
    <span className={`h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${approved ? 'bg-brand-soft text-brand-text' : 'bg-surface-soft text-ink-soft'}`}>
      {approved && <VerifiedBadge size={14} />}{STATUS_LABEL[status]}
    </span>
  );
}

export function NGOValidationScreen() {
  const [validation, setValidation] = useState<NgoValidation | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sentNow, setSentNow] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    setValidation(null);
    api.ngos.validation.get()
      .then(({ validation: v }) => setValidation(v))
      .catch((err) => setLoadError(userMessage(err, NETWORK_ERROR)));
  }, []);
  useEffect(load, [load]);

  const canSend = validation?.status === 'none' || validation?.status === 'rejected';

  return (
    <div className="min-h-screen bg-canvas-soft pb-8">
      <div className="max-w-[560px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-4">
        <header className="flex items-center gap-1 -ml-3">
          <Link to="/ngo/dashboard" aria-label="Volver" className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-surface-soft">
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <h1 className="text-[22px] font-bold tracking-[-0.3px] flex-1">Validar la ONG</h1>
          {validation && <ValidationChip status={validation.status} />}
        </header>

        <p className="text-[15px] text-ink-soft leading-[1.45]">
          La insignia azul muestra que el equipo de VoluntariAR revisó la documentación de tu ONG. Mientras tanto
          podés publicar voluntariados y recibir postulaciones; las donaciones dependen de Mercado Pago, que es un paso aparte.
        </p>

        {loadError ? (
          <InlineError message={loadError} onRetry={load} />
        ) : !validation ? (
          <Loader2 className="w-5 h-5 animate-spin text-ink-muted" aria-label="Cargando" />
        ) : canSend ? (
          <ValidationForm previous={validation} onSent={(v) => { setValidation(v); setSentNow(true); }} />
        ) : (
          <ValidationSummary validation={validation} sentNow={sentNow} />
        )}
      </div>
    </div>
  );
}

/** Los datos de un pedido en revisión o aprobado, con los PDF para ver. */
function ValidationSummary({ validation, sentNow }: { validation: Extract<NgoValidation, { cuit: string }>; sentNow: boolean }) {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<ValidationDoc | null>(null);
  const view = async (doc: ValidationDoc) => {
    setError('');
    setOpening(doc);
    try { await openSignedLink(() => api.ngos.validation.document(doc)); }
    catch (err) { setError(userMessage(err, NETWORK_ERROR)); }
    finally { setOpening(null); }
  };
  return (
    <section aria-label="Tu pedido" className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-3">
      {sentNow && <p role="status" className="text-[15px] font-semibold text-people-text">Recibimos la documentación.</p>}
      {validation.status === 'approved'
        ? <p className="text-[15px]">Tu ONG está validada: aparece con la insignia azul en su perfil y en sus voluntariados.</p>
        : <p className="text-[15px]">Estamos revisando la documentación. {REVIEW_TIME}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
        <dt className="text-ink-muted">CUIT</dt><dd>{validation.cuit}</dd>
        <dt className="text-ink-muted">Personería</dt><dd>{legalTypeLabel(validation.legal_type)}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        {DOCS.map((d) => (
          <Button key={d.key} variant="secondary" onClick={() => void view(d.key)} disabled={opening !== null}>
            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />{d.view}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
    </section>
  );
}

/** El formulario: la primera vez, o después de un rechazo (con el motivo y los datos de antes). */
function ValidationForm({ previous, onSent }: { previous: NgoValidation; onSent: (v: NgoValidation) => void }) {
  const rejected = previous.status === 'rejected' ? previous : null;
  const [cuit, setCuit] = useState(rejected?.cuit ?? '');
  const [legalType, setLegalType] = useState<LegalType | ''>(rejected?.legal_type ?? '');
  const [files, setFiles] = useState<Record<ValidationDoc, File | null>>({ statute: null, registration: null });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const problem = !cuit.trim() ? 'Escribí el CUIT de la ONG'
      : !legalType ? 'Elegí el tipo de personería'
      : checkValidationDoc('statute', files.statute) ?? checkValidationDoc('registration', files.registration);
    if (problem) { setError(problem); return; }
    setError('');
    setSending(true);
    try {
      const form = new FormData();
      form.append('cuit', cuit.trim());
      form.append('legal_type', legalType);
      form.append('statute', files.statute as File);
      form.append('registration', files.registration as File);
      const { validation } = await api.ngos.validation.submit(form);
      onSent(validation);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
      setSending(false);
    }
  };

  const lbl = 'text-[13px] font-semibold text-ink-soft';
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {rejected && (
        <section aria-label="Motivo del rechazo" className="rounded-xl bg-surface border border-hairline p-4">
          <p className="text-[15px] font-semibold">No pudimos validarla por este motivo:</p>
          <p className="text-[15px] text-ink-soft mt-1 whitespace-pre-line break-words">{rejected.reason}</p>
          <p className="text-[13px] text-ink-muted mt-2">Corregilo y volvé a enviar los dos PDF.</p>
        </section>
      )}
      <ol aria-label="Pasos" className="flex flex-col gap-3">
        <li className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Datos de la organización</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="val-cuit" className={lbl}>CUIT</label>
            <input id="val-cuit" className={PROFILE_FIELD} inputMode="numeric" placeholder="30-12345678-9" value={cuit}
              onChange={(e) => { setCuit(e.target.value); setError(''); }} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="val-legal" className={lbl}>Tipo de personería</label>
            <select id="val-legal" className={PROFILE_FIELD} value={legalType}
              onChange={(e) => { setLegalType(e.target.value as LegalType | ''); setError(''); }}>
              <option value="">Elegí una</option>
              {LEGAL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </li>
        <li className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Documentación</h2>
          <p className="text-[13px] text-ink-muted">PDF de hasta 5 MB cada uno. Solo los ve el equipo de VoluntariAR.</p>
          {DOCS.map((d) => (
            <div key={d.key} className="flex flex-col gap-1">
              <label htmlFor={`val-${d.key}`} className={lbl}>{d.label}</label>
              <input id={`val-${d.key}`} type="file" accept="application/pdf" className="text-[13px]"
                onChange={(e) => { const f = e.target.files?.[0] ?? null; setFiles((s) => ({ ...s, [d.key]: f })); setError(''); }} />
              {files[d.key] && <span className="text-[13px] text-ink-soft">{files[d.key]!.name}</span>}
            </div>
          ))}
        </li>
        <li className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-1">
          <h2 className="text-[15px] font-bold">Revisión del equipo de VoluntariAR</h2>
          <p className="text-[13px] text-ink-muted">{REVIEW_TIME}</p>
        </li>
      </ol>
      {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
      <Button type="submit" busy={sending} busyLabel="Enviando…" block>
        {rejected ? 'Volver a enviar' : 'Enviar para revisión'}
      </Button>
    </form>
  );
}

const CARD_DETAIL: Record<NgoValidation['status'], string> = {
  none: 'Pedí la insignia azul de ONG validada',
  pending: STATUS_LABEL.pending,
  approved: STATUS_LABEL.approved,
  rejected: 'Rechazada: revisá el motivo y volvé a enviarla',
};

/** El acceso del Panel (NGOShortcuts): lleva a /ngo/validacion y resume el estado; si la carga falla, queda sin él. */
export function NGOValidationCard() {
  const [status, setStatus] = useState<NgoValidation['status'] | null>(null);
  useEffect(() => {
    let alive = true;
    api.ngos.validation.get().then(({ validation }) => { if (alive) setStatus(validation.status); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return <ShortcutCard to="/ngo/validacion" icon={BadgeCheck} title="Validación" detail={status ? CARD_DETAIL[status] : undefined} />;
}
