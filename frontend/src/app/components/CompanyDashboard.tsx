import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, LayoutDashboard, Handshake, Hourglass, Clock, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { api, CompanyDashboard as CompanyDashboardData } from '../../lib/api';
import { SPONSORSHIP_BADGE, SPONSORSHIP_LABEL } from '../../lib/sponsorship';

// Estados de proyecto (projects.status). 'active' no se rotula: es el caso normal.
const PROJECT_STATUS_LABEL: Record<string, string> = { completed: 'Finalizado', cancelled: 'Cancelado' };

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
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  if (error || !data) return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 px-4">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-4">{error || 'No pudimos cargar el panel'}</p>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    </div>
  );

  const { stats, impact, projects } = data;

  const kpis = [
    { label: 'Proyectos patrocinados', value: String(stats.sponsored_projects), icon: Handshake, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    {
      label: 'Propuestas pendientes', value: String(stats.pending_proposals), icon: Hourglass, color: 'text-amber-500', bg: 'bg-amber-50',
      caption: stats.rejected_proposals > 0
        ? `${stats.rejected_proposals} ${stats.rejected_proposals === 1 ? 'rechazada' : 'rechazadas'}`
        : undefined,
    },
    { label: 'Horas de voluntariado', value: formatHours(impact.total_hours), icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Voluntarios alcanzados', value: String(impact.volunteers_reached), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard className="w-5 h-5 text-violet-600" />
        <h1 className="text-xl font-black text-gray-900">Panel de impacto</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, bg, caption }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <Icon className={`w-4 h-4 ${color} mb-2`} />
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-gray-600 font-medium mt-0.5">{label}</p>
            {caption && <p className="text-[11px] text-gray-400 mt-0.5">{caption}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Las horas y los voluntarios corresponden a los proyectos con patrocinio aceptado (todo el proyecto, no solo tu equipo).
      </p>

      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-8 mb-2">Tus proyectos</h2>

      {projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 px-4">
          <p className="text-gray-500 text-sm mb-1">Todavía no tenés patrocinios.</p>
          <p className="text-gray-400 text-xs mb-4">Explorá proyectos y proponé tu primer patrocinio desde el perfil de tu empresa.</p>
          <div className="flex items-center justify-center gap-2">
            <Link to="/explore" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors">
              Explorar proyectos
            </Link>
            <Link to="/company/profile" className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-bold transition-colors">
              Ir a mi empresa
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {projects.map((p) => (
            <Link key={p.project_id} to={`/project/${p.project_id}`}
              className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              {p.image
                ? <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 flex-shrink-0">{p.title[0]}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                  {PROJECT_STATUS_LABEL[p.project_status] && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${SPONSORSHIP_BADGE[p.sponsorship_status]}`}>
                {SPONSORSHIP_LABEL[p.sponsorship_status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
