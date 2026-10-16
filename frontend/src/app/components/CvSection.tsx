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

  const btn = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" aria-hidden="true" />Mi CV
      </p>
      {loadFailed ? (
        <p className="text-xs text-gray-500">No se pudo cargar.</p>
      ) : hasCv === null ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-300" aria-label="Cargando" />
      ) : (
        <>
          <p className="text-sm text-gray-700">{hasCv ? 'Tu CV está cargado.' : 'Todavía no cargaste tu CV.'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            PDF de hasta 5 MB. Solo lo ven las ONG de los voluntariados a los que te postulaste.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {hasCv && (
              <button type="button" onClick={view} disabled={busy !== null} className={`${btn} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                Ver CV
              </button>
            )}
            <button type="button" onClick={() => input.current?.click()} disabled={busy !== null}
              className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
              {busy === 'upload' ? 'Subiendo…' : hasCv ? 'Reemplazar' : 'Subir CV'}
            </button>
            {hasCv && !confirming && (
              <button type="button" onClick={() => { start(); setConfirming(true); }} disabled={busy !== null}
                className={`${btn} text-red-600 hover:bg-red-50`}>
                Borrar CV
              </button>
            )}
          </div>
          {confirming && (
            <div role="group" aria-label="¿Borrar tu CV?" className="mt-3 p-3 bg-red-50 rounded-xl flex flex-wrap items-center gap-2">
              <p className="text-xs text-red-700 flex-1">¿Borrar tu CV? Las ONG dejan de poder verlo.</p>
              <button type="button" onClick={remove} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Sí, borrar</button>
              <button type="button" onClick={() => setConfirming(false)} className={`${btn} bg-white text-gray-700`}>Cancelar</button>
            </div>
          )}
          <input ref={input} type="file" accept="application/pdf" aria-label="Elegir un PDF con tu CV"
            className="hidden" onChange={onFile} />
          {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
          {done && !error && <p role="status" className="text-xs text-emerald-600 mt-2">{done}</p>}
        </>
      )}
    </div>
  );
}
