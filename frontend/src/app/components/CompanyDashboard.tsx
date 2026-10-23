import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { api, CompanyDashboard as CompanyDashboardData } from '../../lib/api';
import { SPONSORSHIP_BADGE, SPONSORSHIP_LABEL } from '../../lib/sponsorship';
// Estados de proyecto (projects.status). 'active' no se rotula: es el caso normal.
import { PROJECT_STATUS_LABEL } from '../volunteering/status';

// Las horas pueden ser decimales (la ONG las carga con parseFloat): 12 → "12", 7.5 → "7,5".
const formatHours = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function CompanyDashboard() {
  const [data, setData]       = useState<CompanyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await api.empresas.dashboard()); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos cargar el panel'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div role="status" aria-label="Cargando el panel" className="p-6 md:p-10 max-w-[900px] mx-auto flex flex-col gap-4">
      <div className="h-8 w-48 rounded skeleton" /><div className="h-24 rounded-xl skeleton" /><div className="h-48 rounded-xl skeleton" />
    </div>
  );

  if (error || !data) return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div role="alert" className="bg-surface rounded-xl border border-hairline text-center py-12 px-4">
        <AlertCircle className="w-8 h-8 text-ink-muted mx-auto mb-3" strokeWidth={1.75} />
        <p className="text-[15px] text-ink-soft mb-4">{error || 'No pudimos cargar el panel'}</p>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 h-10 px-4 bg-ink text-on-ink rounded-[10px] text-[15px] font-bold">
          <RefreshCw className="w-4 h-4" strokeWidth={1.75} /> Reintentar
        </button>
      </div>
    </div>
  );

  const { stats, impact, projects } = data;

  const kpis = [
    { label: 'Proyectos patrocinados', value: String(stats.sponsored_projects) },
    {
      label: 'Propuestas pendientes', value: String(stats.pending_proposals),
      caption: stats.rejected_proposals > 0
        ? `${stats.rejected_proposals} ${stats.rejected_proposals === 1 ? 'rechazada' : 'rechazadas'}`
        : undefined,
    },
    { label: 'Horas de voluntariado', value: formatHours(impact.total_hours) },
    { label: 'Voluntarios alcanzados', value: String(impact.volunteers_reached) },
  ];

  return (
    <div className="p-4 md:p-10 max-w-[900px] mx-auto">
      <h1 className="text-[22px] font-bold tracking-[-0.3px] mb-5">Panel de impacto</h1>

      <dl className="grid grid-cols-2 md:grid-cols-4 rounded-xl bg-surface border border-hairline overflow-hidden">
        {kpis.map(({ label, value, caption }, i) => (
          <div key={label} className={`px-5 py-4 flex flex-col gap-1 border-hairline ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b md:border-b-0' : ''} md:border-r md:last:border-r-0`}>
            <dt className="order-2 text-xs font-semibold text-ink-soft">{label}</dt>
            <dd className="order-1 text-[28px] font-extrabold tracking-[-0.5px] leading-tight">{value}</dd>
            {caption && <dd className="order-3 text-xs text-ink-muted">{caption}</dd>}
          </div>
        ))}
      </dl>
      <p className="text-[13px] text-ink-muted mt-3">
        Las horas y los voluntarios corresponden a los proyectos con patrocinio aceptado (todo el proyecto, no solo tu equipo).
      </p>

      <h2 className="text-lg font-bold tracking-[-0.2px] mt-8 mb-3">Tus proyectos</h2>

      {projects.length === 0 ? (
        <div className="bg-surface rounded-xl border border-hairline text-center py-12 px-4">
          <p className="text-[15px] font-semibold mb-1">Todavía no tenés patrocinios.</p>
          <p className="text-[13px] text-ink-muted mb-4">Explorá proyectos y proponé tu primer patrocinio desde el perfil de tu empresa.</p>
          <div className="flex items-center justify-center gap-2">
            <Link to="/explore" className="h-10 px-4 inline-flex items-center bg-ink text-on-ink rounded-[10px] text-[15px] font-bold">
              Explorar proyectos
            </Link>
            <Link to="/company/profile" className="h-10 px-4 inline-flex items-center bg-surface-soft hover:bg-surface-pressed rounded-[10px] text-[15px] font-bold transition-colors">
              Ir a mi empresa
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-hairline divide-y divide-hairline overflow-hidden">
          {projects.map((p) => (
            <Link key={p.project_id} to={`/project/${p.project_id}`}
              className="flex items-center gap-3 p-4 hover:bg-surface-soft transition-colors">
              {p.image
                ? <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-surface-soft flex items-center justify-center text-sm font-extrabold flex-shrink-0">{p.title[0]}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                  {PROJECT_STATUS_LABEL[p.project_status] && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {PROJECT_STATUS_LABEL[p.project_status]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{p.ngo_name}</p>
                {p.sponsorship_status === 'aceptado' ? (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatHours(p.hours_logged)} h verificadas · {p.volunteers_count} {p.volunteers_count === 1 ? 'voluntario' : 'voluntarios'} · {p.current_volunteers}/{p.volunteers_needed} cupos
                  </p>
                ) : p.sponsorship_status === 'propuesto' ? (
                  <p className="text-xs text-gray-400 mt-1">Esperando respuesta de la ONG</p>
                ) : null}
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${SPONSORSHIP_BADGE[p.sponsorship_status]}`}>
                {SPONSORSHIP_LABEL[p.sponsorship_status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
