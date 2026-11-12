// src/app/components/SponsorshipHistoryScreen.tsx — el historial de versiones del acuerdo de patrocinio (§326).
//
// Paso 3 del rediseño (lienzo del 11/11). /ngo/patrocinios/:empresaId/:projectId/historial y lo mismo bajo /company.
// A la izquierda las versiones (de la más nueva a la más vieja, con quién, qué hizo y quién la aceptó); a la derecha
// el detalle de la elegida: cada cambio con su tipo en texto (Agregó, Editó, Quitó), lo de antes y lo de ahora. Los
// datos son de GET …/historial (§324), solo para las partes; los acuerdos de antes de §324 no tienen el historial previo.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, SponsorshipAgreement, SponsorshipChange, SponsorshipPointSnapshot, SponsorshipVersion } from '../../lib/api';
import { parseBackendDate } from '../../lib/format';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { LoadError, describeLoadError } from './LoadError';
import { POINT_TYPE_LABEL } from './SponsorshipAgreementScreen';

type Side = 'company' | 'ngo';
const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`;
const ACTION_LABEL: Record<SponsorshipChange['action'], string> = { add: 'Agregó', edit: 'Editó', remove: 'Quitó' };
// El tipo de cambio se distingue por el texto y por el borde, no solo por el color.
const ACTION_STYLE: Record<SponsorshipChange['action'], string> = {
  add: 'bg-ink text-on-ink border-ink',
  edit: 'bg-surface text-ink border-ink',
  remove: 'bg-surface-soft text-ink-soft border-dashed border-border-strong',
};
const card = 'bg-surface rounded-2xl border border-hairline';

/** "11 nov, 15:40" en hora de Argentina (lo del navegador). */
function when(iso: string | null): string {
  if (!iso) return '';
  const ms = parseBackendDate(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "editó 1 punto y quitó 2 puntos": cuántos de cada acción, en el orden agregar, editar, quitar. */
function summary(changes: SponsorshipChange[]): string {
  const parts = (['add', 'edit', 'remove'] as const).map(action => {
    const n = changes.filter(c => c.action === action).length;
    return n ? `${ACTION_LABEL[action].toLowerCase()} ${n} ${n === 1 ? 'punto' : 'puntos'}` : '';
  }).filter(Boolean);
  return parts.join(' y ');
}

export function SponsorshipHistoryScreen() {
  const { empresaId, projectId } = useParams();
  const { pathname } = useLocation();
  const latest = useLatestRequest();
  const [a, setA] = useState<SponsorshipAgreement | null>(null);
  const [versions, setVersions] = useState<SponsorshipVersion[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  // Angosto, el detalle queda debajo de la lista: elegir una versión baja hasta él (visto en Chrome a 390 px).
  const wide = useMediaQuery('(min-width: 1024px)', true);
  const detail = useRef<HTMLElement>(null);
  const pick = (n: number) => {
    setPicked(n);
    if (!wide) detail.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const load = async () => {
    const req = latest.start();
    setLoadError(null);
    try {
      const [{ agreement }, { versions: v }] = await Promise.all([
        api.sponsorships.get(empresaId!, projectId!), api.sponsorships.history(empresaId!, projectId!),
      ]);
      if (!latest.isLatest(req)) return;
      setA(agreement);
      setVersions(v);
      setPicked(v[0]?.version ?? null);
    } catch (e) {
      if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos este acuerdo'));
    }
  };
  useEffect(() => { void load(); }, [empresaId, projectId]);

  // El acuerdo es la misma URL sin /historial (sirve bajo /ngo y bajo /company; las rutas son planas, así que un
  // ".." relativo a la ruta iría al panel y no al acuerdo).
  const agreementUrl = pathname.replace(/\/historial\/?$/, '');
  if (loadError) return <LoadError message={loadError.message} onRetry={loadError.retry ? load : undefined} home={agreementUrl} />;
  if (!a || !versions) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-ink-muted" aria-label="Cargando" /></div>;

  const party = (side: Side) => (side === 'company' ? a.company_name : a.ngo_name);
  const sideLabel = (side: Side) => (side === 'company' ? `Aporta ${a.company_name}` : `Ofrece ${a.ngo_name}`);
  const sel = versions.find(v => v.version === picked) ?? null;
  const oldest = versions.length ? versions[versions.length - 1].version : null;

  const listLine = (v: SponsorshipVersion) =>
    (v.changes.length ? `${v.author_name ?? 'Una cuenta borrada'}: ${summary(v.changes)}` : v.version === 1 ? `Propuesta de ${a.company_name}` : 'Sin cambios de puntos');
  const acceptLine = (v: SponsorshipVersion) => {
    const who = v.accepted_by.map(x => party(x.side));
    return who.length ? `La aceptó ${who.join(' y ')}` : 'Nadie la aceptó';
  };

  const snapshot = (s: SponsorshipPointSnapshot, struck = false) => (
    <>
      <span className={struck ? 'line-through' : ''}>{s.detail}</span>
      {s.amount != null && <span className={`font-bold text-brand-text ${struck ? 'line-through' : ''}`}> · {money(s.amount)}</span>}
    </>
  );

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-8">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-4 md:pt-8 flex flex-col gap-4">
        <Link to={agreementUrl} className="text-sm text-ink-soft inline-flex items-center gap-1 self-start">
          <ArrowLeft size={16} aria-hidden="true" />Volver al acuerdo
        </Link>
        <header>
          <h1 className="text-[22px] font-bold tracking-[-0.3px]">Historial de versiones</h1>
          <p className="text-sm text-ink-soft">
            {a.project_title} · {a.company_name} con {a.ngo_name}. Cada versión es lo que una parte guardó de una vez; las versiones no se editan.
          </p>
        </header>

        {versions.length === 0 ? (
          <p className={`${card} p-4 text-sm text-ink-muted`}>Todavía no hay versiones registradas.</p>
        ) : (
          <>
            {oldest != null && oldest > 1 && (
              <p className="text-[13px] text-ink-soft">
                El historial empieza en la versión {oldest}: los cambios anteriores no se guardaban.
              </p>
            )}
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
              <nav aria-label="Versiones" className={`${card} p-1.5`}>
                <ol className="flex flex-col gap-0.5">
                  {versions.map(v => {
                    const on = v.version === picked;
                    return (
                      <li key={v.version}>
                        <button type="button" aria-current={on ? 'true' : 'false'} onClick={() => pick(v.version)}
                          className={`w-full text-left rounded-[10px] px-3.5 py-3 flex flex-col gap-0.5 transition-colors ${on ? 'bg-surface-soft' : 'hover:bg-surface-soft'}`}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[15px] font-bold">Versión {v.version}</span>
                            <span className="text-xs text-ink-muted">{when(v.created_at)}</span>
                          </span>
                          <span className="text-[13px] text-ink-soft">{listLine(v)}</span>
                          <span className="text-xs text-ink-muted">{acceptLine(v)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {sel && (
                <section ref={detail} aria-labelledby="version-elegida" className={`${card} overflow-hidden scroll-mt-4`}>
                  <div className="p-4 flex flex-col gap-2 border-b border-hairline">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="version-elegida" className="text-lg font-bold">Versión {sel.version}</h2>
                      {sel.version === a.version && (
                        <span className="h-6 px-2.5 rounded-full bg-ink text-on-ink text-xs font-bold inline-flex items-center">Vigente</span>
                      )}
                    </div>
                    {sel.author_name && <p className="text-sm text-ink-soft">{sel.author_name} · {when(sel.created_at)}</p>}
                    <div className="flex flex-wrap gap-2">
                      {(['company', 'ngo'] as const).map(side => {
                        const acc = sel.accepted_by.find(x => x.side === side);
                        return (
                          <span key={side} className={`h-7 px-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center ${acc ? 'bg-people-soft text-people-text' : 'bg-surface-soft text-ink-soft'}`}>
                            {acc ? `${party(side)} la aceptó · ${when(acc.accepted_at)}` : `${party(side)} no la aceptó`}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {sel.changes.length === 0 ? (
                    <div className="p-4 flex flex-col gap-3">
                      <p className="text-sm text-ink-soft">No hubo cambios de puntos en esta versión.</p>
                      {sel.version === 1 && a.message && (
                        <div className="p-3 rounded-xl bg-surface-soft">
                          <p className="text-xs font-bold text-ink-soft mb-1">Mensaje al proponer</p>
                          <p className="text-sm">{a.message}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <ul>
                      {sel.changes.map((c, i) => {
                        const pt = c.after ?? c.before;
                        return (
                          <li key={`${c.point_id}-${i}`} className="px-4 py-3.5 border-t first:border-t-0 border-hairline flex gap-3">
                            <span className={`flex-shrink-0 w-16 h-[26px] rounded-md border-[1.5px] text-xs font-extrabold flex items-center justify-center ${ACTION_STYLE[c.action]}`}>
                              {ACTION_LABEL[c.action]}
                            </span>
                            <div className="min-w-0 flex-1 flex flex-col gap-1 text-[15px] leading-snug">
                              <p className="text-xs font-bold text-ink-soft">{sideLabel(c.side)} · {pt ? POINT_TYPE_LABEL[pt.type] : ''}</p>
                              {c.action === 'edit' && c.before && c.after ? (
                                <>
                                  <p className="text-sm text-ink-muted"><span className="font-bold">Antes: </span>{snapshot(c.before, true)}</p>
                                  <p><span className="font-bold">Ahora: </span>{snapshot(c.after)}</p>
                                </>
                              ) : c.action === 'remove' && c.before ? (
                                <p className="text-ink-muted">{snapshot(c.before, true)}</p>
                              ) : c.after ? (
                                <p>{snapshot(c.after)}</p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
