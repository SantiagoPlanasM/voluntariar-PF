// src/app/components/InterviewPanel.tsx — la entrevista de una postulación, en el panel de la ONG (§262).
//
// Pendiente sin entrevista programada: "Agendar entrevista". Programada: el resumen, "Reprogramar", "Cancelar
// entrevista" y, si ya pasó, "Marcar realizada". Las reglas (fecha futura, link https o lugar, una sola programada)
// las valida el backend: acá se muestra su mensaje tal cual.
import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { api, EnrollmentWithVolunteer, Interview, InterviewInput } from '../../lib/api';
import { formatDateOnly, userMessage } from '../../lib/format';
import { useConfirm } from '../ui/UiProvider';
import { googleCalendarUrl, icsHref, interviewEvent, toIcs } from '../../lib/calendar';

/** true si la fecha y hora (de Argentina, UTC-3) ya pasaron. */
export const interviewPassed = (iv: Interview) => Date.parse(`${iv.date}T${iv.time}:00-03:00`) <= Date.now();

/** Fecha y hora de la entrevista, para mostrar: "10 mar 2030 · 18:00". */
export const interviewWhen = (iv: Interview) => `${formatDateOnly(iv.date)} · ${iv.time}`;

const EMPTY = { date: '', time: '', link: '', place: '', note: '' };
const field = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500';
const smallBtn = 'py-2 px-3 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50';

export function InterviewPanel({ enrollment, onChange }: {
  enrollment: EnrollmentWithVolunteer; onChange: (interview: Interview) => void;
}) {
  const confirm = useConfirm();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const iv = enrollment.interview;
  const scheduled = iv?.status === 'scheduled' ? iv : null;
  // §271: la entrevista en el calendario de la ONG, con el nombre de quien se postuló.
  const calendarEvent = scheduled && { ...interviewEvent(scheduled, '', ''), title: `Entrevista con ${enrollment.volunteer_name}` };

  if (enrollment.status !== 'pending' && iv?.status !== 'done') return null;

  const run = async (call: () => Promise<{ interview: Interview }>) => {
    setBusy(true);
    setError('');
    try {
      const { interview } = await call();
      onChange(interview);
      setForm(null);
    } catch (e) {
      setError(userMessage(e, 'No pudimos guardar la entrevista. Revisá tu conexión y probá de nuevo.'));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!form) return;
    // Solo lo cargado: un campo vacío no se manda (el backend lo toma como "sin link" o "sin lugar").
    const body: InterviewInput = { date: form.date, time: form.time };
    for (const k of ['link', 'place', 'note'] as const) if (form[k].trim()) body[k] = form[k].trim();
    void run(() => (scheduled ? api.enrollments.updateInterview(enrollment.id, body) : api.enrollments.scheduleInterview(enrollment.id, body)));
  };

  const cancel = async () => {
    const ok = await confirm({
      title: '¿Cancelar la entrevista?',
      body: `A ${enrollment.volunteer_name} le llega un aviso. La postulación sigue pendiente.`,
      confirmLabel: 'Cancelar entrevista',
      cancelLabel: 'Volver',
      danger: true,
    });
    if (ok) void run(() => api.enrollments.updateInterview(enrollment.id, { status: 'cancelled' }));
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <section aria-label={`Entrevista con ${enrollment.volunteer_name}`} className="mt-3 ml-13 flex flex-col gap-2">
      {iv?.status === 'done' && (
        <p className="text-xs text-ink-soft flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Entrevista realizada</span> <span className="text-ink-muted">({interviewWhen(iv)})</span>
        </p>
      )}

      {scheduled && !form && (
        <div className="p-3 rounded-xl bg-surface-soft flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />Entrevista: {interviewWhen(scheduled)}
          </p>
          {scheduled.place && <p className="text-xs text-ink-soft">{scheduled.place}</p>}
          {scheduled.link && (
            <a href={scheduled.link} target="_blank" rel="noopener noreferrer" aria-label="Abrir el link de la entrevista"
              className="text-xs text-brand-text underline break-all">{scheduled.link}</a>
          )}
          {scheduled.note && <p className="text-xs text-ink-muted italic">{scheduled.note}</p>}
          {calendarEvent && (
            <p className="text-xs flex flex-wrap gap-x-3">
              <a href={googleCalendarUrl(calendarEvent)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-text underline">Agregar a Google Calendar</a>
              <a href={icsHref(toIcs(calendarEvent, scheduled.id))} download="entrevista.ics" className="font-semibold text-brand-text underline">Descargar .ics</a>
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-1">
            <button type="button" disabled={busy} onClick={() => setForm({ ...EMPTY, date: scheduled.date, time: scheduled.time,
              link: scheduled.link ?? '', place: scheduled.place ?? '', note: scheduled.note ?? '' })}
              className={`${smallBtn} bg-surface hover:bg-surface-pressed text-ink`}>Reprogramar</button>
            <button type="button" disabled={busy} onClick={() => void cancel()}
              className={`${smallBtn} bg-surface hover:bg-surface-pressed text-critical`}>Cancelar entrevista</button>
            {interviewPassed(scheduled) && (
              <button type="button" disabled={busy} onClick={() => void run(() => api.enrollments.updateInterview(enrollment.id, { status: 'done' }))}
                className={`${smallBtn} bg-surface hover:bg-surface-pressed text-people-text`}>Marcar realizada</button>
            )}
          </div>
        </div>
      )}

      {!scheduled && !form && enrollment.status === 'pending' && (
        <button type="button" onClick={() => setForm(EMPTY)}
          className={`${smallBtn} self-start bg-surface-soft hover:bg-surface-pressed text-ink flex items-center gap-1.5`}>
          <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />Agendar entrevista
        </button>
      )}

      {form && (
        <div className="p-3 rounded-xl bg-surface-soft grid grid-cols-2 gap-2">
          <input type="date" aria-label="Fecha de la entrevista" value={form.date} onChange={set('date')} className={field} />
          <input type="time" aria-label="Hora de la entrevista" value={form.time} onChange={set('time')} className={field} />
          <input type="url" aria-label="Link de la videollamada" placeholder="https://meet.google.com/…" value={form.link}
            onChange={set('link')} className={`${field} col-span-2`} />
          <input aria-label="Lugar de la entrevista" placeholder="O un lugar: Sede de la ONG" maxLength={200} value={form.place}
            onChange={set('place')} className={`${field} col-span-2`} />
          <input aria-label="Nota para el voluntario" placeholder="Nota (opcional)" maxLength={500} value={form.note}
            onChange={set('note')} className={`${field} col-span-2`} />
          <div className="col-span-2 flex gap-2">
            <button type="button" onClick={save} disabled={busy}
              className={`${smallBtn} flex-1 bg-ink text-on-ink hover:opacity-90 flex items-center justify-center gap-1.5`}>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}Guardar entrevista
            </button>
            <button type="button" onClick={() => { setForm(null); setError(''); }} disabled={busy}
              className={`${smallBtn} bg-surface hover:bg-surface-pressed text-ink`}>Cancelar</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-critical">{error}</p>}
    </section>
  );
}
