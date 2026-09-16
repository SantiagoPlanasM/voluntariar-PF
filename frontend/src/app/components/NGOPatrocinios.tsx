import { useEffect, useState } from 'react';
import { Loader2, Check, X as XIcon, Handshake } from 'lucide-react';
import { api, Patrocinio } from '../../lib/api';

const ESTADO_BADGE: Record<Patrocinio['estado'], string> = {
  propuesto: 'bg-amber-50 text-amber-700',
  aceptado:  'bg-emerald-50 text-emerald-700',
  rechazado: 'bg-red-50 text-red-600',
};
const ESTADO_LABEL: Record<Patrocinio['estado'], string> = {
  propuesto: 'Pendiente', aceptado: 'Aceptado', rechazado: 'Rechazado',
};

export function NGOPatrocinios() {
  const [patrocinios, setPatrocinios] = useState<Patrocinio[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingKey, setDecidingKey] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { const { patrocinios: p } = await api.ngos.patrocinios.list(); setPatrocinios(p); }
    catch { /* la lista simplemente queda vacía */ }
    finally { setLoading(false); }
  };

  const decide = async (empresaId: string, projectId: string, estado: 'aceptado' | 'rechazado') => {
    const key = `${empresaId}-${projectId}`;
    setDecidingKey(key);
    try { await api.ngos.patrocinios.decide(empresaId, projectId, estado); await load(); }
    catch { /* si falla, el usuario puede reintentar desde la lista */ }
    finally { setDecidingKey(null); }
  };

  const pendientes = patrocinios.filter(p => p.estado === 'propuesto');
  const decididas  = patrocinios.filter(p => p.estado !== 'propuesto');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Handshake className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-black text-gray-900">Propuestas de patrocinio</h1>
      </div>

      {patrocinios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12">
          <p className="text-gray-400 text-sm">Todavía no recibiste propuestas de patrocinio.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Pendientes ({pendientes.length})</h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {pendientes.map(p => {
                  const key = `${p.empresa_id}-${p.project_id}`;
                  return (
                    <div key={key} className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {p.empresa_logo
                          ? <img src={p.empresa_logo} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 flex-shrink-0">{p.empresa_name?.[0]}</div>
                        }
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.empresa_name}</p>
                          <p className="text-xs text-gray-400 truncate">quiere patrocinar "{p.project_title}"</p>
                        </div>
                      </div>
                      {p.mensaje && <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-3">{p.mensaje}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => decide(p.empresa_id, p.project_id, 'aceptado')} disabled={decidingKey === key}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-60 transition-colors">
                          {decidingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Aceptar
                        </button>
                        <button onClick={() => decide(p.empresa_id, p.project_id, 'rechazado')} disabled={decidingKey === key}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold disabled:opacity-60 transition-colors">
                          <XIcon className="w-3.5 h-3.5" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {decididas.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Historial</h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {decididas.map(p => (
                  <div key={`${p.empresa_id}-${p.project_id}`} className="p-4 flex items-center gap-3">
                    {p.empresa_logo
                      ? <img src={p.empresa_logo} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.empresa_name} — {p.project_title}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${ESTADO_BADGE[p.estado]}`}>
                      {ESTADO_LABEL[p.estado]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
