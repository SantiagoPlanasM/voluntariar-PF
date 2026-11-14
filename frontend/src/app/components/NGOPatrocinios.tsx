// Propuestas de patrocinio de la ONG (/ngo/patrocinios). Pantalla de panel (DESIGN.md → Paneles de gestión):
// fondo `canvas-soft`, bloques `surface` con borde `hairline`, sin sombras. Las pendientes arriba, con el acceso al
// acuerdo y "Aceptar" / "Rechazar"; abajo, el historial con el estado como chip.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, Patrocinio } from '../../lib/api';
import { userMessage } from '../../lib/format';
import { SPONSORSHIP_BADGE, SPONSORSHIP_LABEL } from '../../lib/sponsorship';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { InlineError } from './LoadError';

const BLOCK = 'rounded-xl bg-surface border border-hairline';
const SECTION_TITLE = 'text-[13px] font-semibold text-ink-soft';

export function NGOPatrocinios() {
  const [patrocinios, setPatrocinios] = useState<Patrocinio[] | null>(null);
  const [decidingKey, setDecidingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { void load(); }, []);

  // Solo corre con la lista todavía sin cargar (al entrar y en "Reintentar"): por eso se ve el esqueleto.
  const load = async () => {
    setLoadError('');
    try { const { patrocinios: p } = await api.ngos.patrocinios.list(); setPatrocinios(p); }
    // Antes se tragaba y se veía "Todavía no recibiste propuestas" (REVISION F9).
    catch (e) { setLoadError(userMessage(e, 'No pudimos cargar las propuestas. Revisá tu conexión.')); }
  };

  const decide = async (empresaId: string, projectId: string, estado: 'aceptado' | 'rechazado') => {
    const key = `${empresaId}-${projectId}`;
    setDecidingKey(key);
    setActionError('');
    try {
      const { message } = await api.ngos.patrocinios.decide(empresaId, projectId, estado);
      // §264: si los puntos cambiaron, aceptar no cierra el acuerdo: falta la empresa. Se avisa en vez de no mostrar nada.
      setNotice(estado === 'aceptado' && message.startsWith('Aceptaste esta versión') ? message : '');
    } catch (e) {
      setActionError(userMessage(e, 'No se pudo guardar tu decisión. Revisá tu conexión y probá de nuevo.'));
      setDecidingKey(null);
      return;
    }
    // La decisión ya está guardada: la lista se vuelve a pedir sin vaciar la pantalla.
    try { const { patrocinios: p } = await api.ngos.patrocinios.list(); setPatrocinios(p); }
    catch { setActionError('Tu decisión se guardó, pero no pudimos actualizar la lista. Recargá la página para verla.'); }
    finally { setDecidingKey(null); }
  };

  const pendientes = (patrocinios ?? []).filter(p => p.estado === 'propuesto');
  const decididas  = (patrocinios ?? []).filter(p => p.estado !== 'propuesto');

  return (
    <div className="min-h-screen bg-canvas-soft pb-28">
      <div className="w-full max-w-[880px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.3px] min-h-11 flex items-center">Propuestas de patrocinio</h1>

        {notice && <p role="status" className={`${BLOCK} p-3 text-[13px] text-ink`}>{notice}</p>}
        {actionError && <p role="alert" className={`${BLOCK} p-3 text-[13px] text-critical`}>{actionError}</p>}

        {loadError ? (
          <InlineError message={loadError} onRetry={load} />
        ) : !patrocinios ? (
          // Esqueleto con la forma de la lista: dos propuestas con su logo, dos renglones y los botones.
          <div role="status" aria-label="Cargando propuestas" className="flex flex-col gap-2">
            {[0, 1].map(i => (
              <div key={i} aria-hidden="true" className={`${BLOCK} p-4 flex flex-col gap-3`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex-shrink-0 rounded-[28%] skeleton" />
                  <div className="flex-1 flex flex-col gap-2"><div className="h-4 w-1/2 rounded skeleton" /><div className="h-3 w-3/4 rounded skeleton" /></div>
                </div>
                <div className="h-10 rounded-[10px] skeleton" />
              </div>
            ))}
          </div>
        ) : patrocinios.length === 0 ? (
          <p className={`${BLOCK} text-center py-12 px-4 text-[15px] text-ink-soft`}>Todavía no recibiste propuestas de patrocinio.</p>
        ) : (
          <>
            {pendientes.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className={SECTION_TITLE}>Pendientes ({pendientes.length})</h2>
                {pendientes.map(p => {
                  const key = `${p.empresa_id}-${p.project_id}`;
                  const busy = decidingKey === key;
                  return (
                    <article key={key} className={`${BLOCK} p-4 flex flex-col gap-3`}>
                      <div className="flex items-center gap-3">
                        <Avatar src={p.empresa_logo} name={p.empresa_name ?? ''} kind="org" size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold truncate">{p.empresa_name}</p>
                          <p className="text-[13px] text-ink-soft break-words">quiere patrocinar "{p.project_title}"</p>
                        </div>
                      </div>
                      {p.mensaje && <p className="text-[15px] leading-[1.45] text-ink-soft bg-surface-soft rounded-xl px-3 py-2 break-words">{p.mensaje}</p>}
                      <Link to={`/ngo/patrocinios/${p.empresa_id}/${p.project_id}`} className="text-[13px] font-semibold text-ink underline self-start min-h-11 inline-flex items-center">
                        Ver acuerdo: puntos y charla
                      </Link>
                      <div className="flex gap-2">
                        <Button variant="primary" className="flex-1" busy={busy} busyLabel="Guardando…"
                          onClick={() => decide(p.empresa_id, p.project_id, 'aceptado')}>
                          Aceptar
                        </Button>
                        <Button variant="secondary" className="flex-1" disabled={busy}
                          onClick={() => decide(p.empresa_id, p.project_id, 'rechazado')}>
                          Rechazar
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            {decididas.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className={SECTION_TITLE}>Historial</h2>
                <ul className={`${BLOCK} divide-y divide-hairline`}>
                  {decididas.map(p => (
                    <li key={`${p.empresa_id}-${p.project_id}`} className="p-3 flex items-center gap-3">
                      <Avatar src={p.empresa_logo} name={p.empresa_name ?? ''} kind="org" size={36} />
                      <p className="min-w-0 flex-1 text-[15px] break-words">
                        <span className="font-semibold">{p.empresa_name}</span>
                        <span className="text-ink-soft"> · {p.project_title}</span>
                      </p>
                      <span className={`h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center flex-shrink-0 ${SPONSORSHIP_BADGE[p.estado]}`}>
                        {SPONSORSHIP_LABEL[p.estado]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
