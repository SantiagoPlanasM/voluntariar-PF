// src/app/components/CvSection.tsx
//
// "Mi CV" en el perfil propio del voluntario (PLAN_FALTANTE.md, Etapa 5, §166). Si hay CV sale de `has_cv` en
// GET /auth/me (§165). Subir o reemplazar va con PUT /voluntarios/me/cv; al reemplazar, el backend borra el anterior.
// Borrar pide confirmación en la pantalla (no window.confirm). El archivo es privado: lo ven el voluntario y las ONG
// de los voluntariados a los que se postuló (pendiente o aprobado), con un link que vence.
import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { checkCvFile, openCv } from '../../lib/cv';
import { userMessage } from '../../lib/format';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';

export function CvSection({ userId }: { userId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [hasCv, setHasCv] = useState<boolean | null>(null);   // null = todavía no se sabe
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'delete' | 'open' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then(({ profile }) => { if (!cancelled) setHasCv(Boolean(profile?.has_cv)); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const start = () => { setError(''); setDone(''); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    start();
    const invalid = checkCvFile(file);
    if (invalid) { setError(invalid); return; }
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('cv', file);
      const r = await api.voluntarios.cv.upload(form);
      setHasCv(r.has_cv);
      setDone('CV guardado');
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
    } finally { setBusy(null); }
  };

  const view = async () => {
    start();
    setBusy('open');
    try { await openCv(userId); }
    catch (err) { setError(userMessage(err, NETWORK_ERROR)); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    start();
    setConfirming(false);
    setBusy('delete');
    try {
      const r = await api.voluntarios.cv.remove();
      setHasCv(r.has_cv);
      setDone('CV borrado');
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
    } finally { setBusy(null); }
  };

  const btn = 'h-10 px-3.5 rounded-[10px] text-[13px] font-bold transition-colors disabled:opacity-50';

  return (
    <section aria-labelledby="cv-title" className="rounded-xl bg-surface border border-hairline p-4 flex flex-col">
      <h2 id="cv-title" className="text-[15px] font-bold mb-1 flex items-center gap-1.5">
        <FileText className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />Mi CV
      </h2>
      {loadFailed ? (
        <p className="text-[13px] text-ink-muted">No se pudo cargar.</p>
      ) : hasCv === null ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" aria-label="Cargando" />
      ) : (
        <>
          <p className="text-[15px]">{hasCv ? 'Tu CV está cargado.' : 'Todavía no cargaste tu CV.'}</p>
          <p className="text-[13px] text-ink-muted mt-0.5">
            PDF de hasta 5 MB. Solo lo ven las ONG de los voluntariados a los que te postulaste.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {hasCv && (
              <button type="button" onClick={view} disabled={busy !== null} className={`${btn} bg-surface-soft text-ink hover:bg-surface-pressed`}>
                Ver CV
              </button>
            )}
            <button type="button" onClick={() => input.current?.click()} disabled={busy !== null}
              className={`${btn} bg-surface-soft text-ink hover:bg-surface-pressed`}>
              {busy === 'upload' ? 'Subiendo…' : hasCv ? 'Reemplazar' : 'Subir CV'}
            </button>
            {hasCv && !confirming && (
              <button type="button" onClick={() => { start(); setConfirming(true); }} disabled={busy !== null}
                className={`${btn} text-critical hover:bg-surface-soft`}>
                Borrar CV
              </button>
            )}
          </div>
          {confirming && (
            <div role="group" aria-label="¿Borrar tu CV?" className="mt-3 p-3 bg-surface-soft rounded-xl flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-ink-soft flex-1">¿Borrar tu CV? Las ONG dejan de poder verlo.</p>
              <button type="button" onClick={remove} className={`${btn} bg-critical text-white hover:opacity-90`}>Sí, borrar</button>
              <button type="button" onClick={() => setConfirming(false)} className={`${btn} bg-surface text-ink`}>Cancelar</button>
            </div>
          )}
          <input ref={input} type="file" accept="application/pdf" aria-label="Elegir un PDF con tu CV"
            className="hidden" onChange={onFile} />
          {error && <p role="alert" className="text-[13px] font-medium text-critical mt-2">{error}</p>}
          {done && !error && <p role="status" className="text-[13px] font-semibold text-people-text mt-2">{done}</p>}
        </>
      )}
    </section>
  );
}
