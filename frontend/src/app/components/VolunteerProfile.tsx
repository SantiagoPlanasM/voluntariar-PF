import { useAuth } from '../../lib/AuthContext';
import { LogOut, CheckCircle, Clock, Heart } from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { api, EnrollmentWithProject } from '../../lib/api';

export function VolunteerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<EnrollmentWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.enrollments.my()
      .then(r => setEnrollments(r.enrollments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3">
      <p className="text-gray-500">No estás logueado</p>
      <Link to="/" className="text-emerald-600 font-semibold text-sm">Ir al inicio</Link>
    </div>
  );

  const approved = enrollments.filter(e => e.status === 'approved').length;
  const pending  = enrollments.filter(e => e.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-4 pt-14 pb-8 relative">
        <button onClick={() => { logout(); navigate('/'); }}
          className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          title="Cerrar sesión">
          <LogOut className="w-5 h-5 text-white" />
        </button>

        <div className="text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto mb-3 overflow-hidden shadow-xl">
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">
                  {user.name[0]}
                </div>
            }
          </div>
          <h1 className="text-2xl font-bold text-white mb-0.5">{user.name}</h1>
          <p className="text-white/70 text-sm">{user.email}</p>
          <span className="mt-2 inline-block px-3 py-1 bg-white/20 text-white text-xs rounded-full font-medium">
            {user.role === 'volunteer' ? '🙋 Voluntario' : user.role === 'ngo' ? '🏢 ONG' : '🏭 Empresa'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6 mb-5">
        <div className="bg-white rounded-2xl shadow-xl p-4 grid grid-cols-3 gap-4 border border-gray-100">
          {[
            { icon: CheckCircle, label: 'Aprobadas', val: approved, color: 'text-green-600', bg: 'bg-green-50' },
            { icon: Clock,       label: 'Pendientes', val: pending,  color: 'text-amber-500', bg: 'bg-amber-50' },
            { icon: Heart,       label: 'Total',      val: enrollments.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ icon: Icon, label, val, color, bg }) => (
            <div key={label} className="text-center">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{val}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent participations */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Últimas participaciones</h2>
          <Link to="/participation" className="text-xs text-emerald-600 font-semibold">Ver todas →</Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm text-gray-500">Aún no participaste en ningún proyecto</p>
            <Link to="/feed" className="text-sm text-emerald-600 font-semibold mt-2 inline-block">Explorar proyectos →</Link>
          </div>
        ) : (
          enrollments.slice(0, 3).map(e => (
            <Link to={`/project/${e.project_id}`} key={e.id}>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex gap-3 items-center hover:border-emerald-200 transition-colors">
                {e.image
                  ? <img src={e.image} alt={e.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-12 h-12 rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center text-xl">🌱</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{e.title}</p>
                  <p className="text-xs text-gray-500">{e.ngo_name}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                  e.status === 'approved' ? 'bg-green-50 text-green-600'
                  : e.status === 'pending' ? 'bg-amber-50 text-amber-500'
                  : 'bg-red-50 text-red-500'}`}>
                  {e.status === 'approved' ? '✓' : e.status === 'pending' ? '⏳' : '✕'}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
