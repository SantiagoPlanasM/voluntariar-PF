import { Heart, MapPin, Users, DollarSign, Zap, Calendar, Clock, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Project, api } from '../../lib/api';
import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';

interface Props { project: Project; onRefresh?: () => void; }

function safePct(a: any, b: any) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!nb || isNaN(na) || isNaN(nb)) return 0;
  return Math.min(100, Math.round((na / nb) * 100));
}
function safeMoney(val: any) {
  const n = parseFloat(val);
  return isNaN(n) ? '$0' : '$' + n.toLocaleString('es-AR');
}

export function ProjectCard({ project, onRefresh }: Props) {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled]   = useState(false);
  const [msg, setMsg]             = useState('');

  const fundPct   = safePct(project.current_funding, project.funding_goal);
  const volPct    = safePct(project.current_volunteers, project.volunteers_needed);
  const spotsLeft = (project.volunteers_needed || 0) - (project.current_volunteers || 0);
  const hasFunding = (project.funding_goal || 0) > 0;

  const goToProject = () => navigate(`/project/${project.id}`);
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToProject(); }
  };

  const handleEnroll = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { openAuthModal('Iniciá sesión para inscribirte como voluntario'); return; }
    if (enrolled || enrolling) return;
    setEnrolling(true);
    try {
      await api.enrollments.enroll(project.id);
      setEnrolled(true); setMsg('¡Inscripción enviada!');
      onRefresh?.();
    } catch (err: any) { setMsg(err.message); }
    finally { setEnrolling(false); }
  };

  return (
    <div onClick={goToProject} onKeyDown={handleCardKeyDown} role="link" tabIndex={0}
      className="cursor-pointer">
      <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-emerald-200 hover:shadow-lg transition-all">
        <div className="relative h-44 overflow-hidden bg-gray-100">
          {project.image
            ? <img src={project.image} alt={project.title} className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Heart className="w-10 h-10 text-emerald-300" />
              </div>
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 bg-white/95 rounded-full text-xs font-bold text-gray-800 shadow-sm">{project.category}</span>
          </div>
          <div className="absolute top-3 right-3">
            {project.type === 'fugaz'
              ? <span className="px-2.5 py-1 bg-blue-600/90 rounded-full text-xs font-bold text-white flex items-center gap-1"><Zap className="w-3 h-3" />Fugaz</span>
              : <span className="px-2.5 py-1 bg-emerald-600/90 rounded-full text-xs font-bold text-white flex items-center gap-1"><Calendar className="w-3 h-3" />Sostenido</span>
            }
          </div>
          {spotsLeft > 0 && spotsLeft <= 10 && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-amber-500 rounded-full text-[11px] font-bold text-white">
              ¡Solo {spotsLeft} lugares!
            </div>
          )}
        </div>

        <div className="p-4">
          <Link to={project.ngo_id ? `/ngo/${project.ngo_id}` : '#'}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity">
            {project.ngo_logo
              ? <img src={project.ngo_logo} alt={project.ngo_name} className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200" />
              : <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">{project.ngo_name?.[0]}</div>
            }
            <span className="text-xs font-semibold text-gray-500 hover:text-emerald-600 transition-colors">{project.ngo_name}</span>
          </Link>

          <h3 className="font-bold text-base text-gray-900 leading-snug mb-1">{project.title}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600">
              <MapPin className="w-3 h-3 text-gray-400" />{project.location}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-600">
              <Clock className="w-3 h-3 text-gray-400" />
              {project.type === 'fugaz'
                ? (project.duration || 'Sin especificar')
                : (project.hours_per_week ? `${project.hours_per_week}h/sem` : 'Sin especificar')
              }
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${(project.cost_per_person || 0) === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}>
              <DollarSign className="w-3 h-3" />
              {(project.cost_per_person || 0) === 0 ? 'Gratis' : safeMoney(project.cost_per_person)}
            </span>
          </div>

          {project.roles_needed?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {project.roles_needed.slice(0, 3).map((r, i) => (
                <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">{r}</span>
              ))}
              {project.roles_needed.length > 3 && (
                <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">+{project.roles_needed.length - 3}</span>
              )}
            </div>
          )}

          <div className="space-y-2 mb-3">
            {hasFunding && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" />Financiamiento</span>
                  <span className="font-bold text-blue-600">{fundPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: `${fundPct}%` }} />
                </div>
              </div>
            )}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />Voluntarios</span>
                <span className="font-bold text-emerald-600">{project.current_volunteers || 0}/{project.volunteers_needed || 0}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" style={{ width: `${volPct}%` }} />
              </div>
            </div>
          </div>

          {msg && (
            <p className={`text-xs px-3 py-1.5 rounded-lg mb-2 font-medium ${enrolled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>
          )}

          {/* Sin botón Donar — fuera del MVP */}
          <button onClick={handleEnroll} disabled={enrolling || enrolled}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]
              ${enrolled ? 'bg-gray-100 text-gray-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'}
              disabled:opacity-60`}>
            {enrolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {enrolled ? 'Inscripto ✓' : 'Inscribirme'}
          </button>
        </div>
      </article>
    </div>
  );
}
