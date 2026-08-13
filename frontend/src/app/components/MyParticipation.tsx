import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle, Clock, XCircle, MapPin, Tag, Loader2, Star, Lock, Sprout } from 'lucide-react';
import { api, EnrollmentWithProject } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ReviewModal } from './ReviewModal';

const STATUS = {
  pending:   { label: 'Pendiente', icon: Clock,        color: 'text-amber-500', bg: 'bg-amber-50' },
  approved:  { label: 'Aprobado',  icon: CheckCircle,  color: 'text-green-600', bg: 'bg-green-50' },
  rejected:  { label: 'Rechazado', icon: XCircle,      color: 'text-red-500',   bg: 'bg-red-50'   },
  cancelled: { label: 'Cancelado', icon: XCircle,      color: 'text-gray-400',  bg: 'bg-gray-100' },
};

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected';

export function MyParticipation() {
  const { user, openAuthModal } = useAuth();
  const [items, setItems]       = useState<EnrollmentWithProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterKey>('all');
  const [reviewTarget, setReviewTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.enrollments.my()
      .then(r => setItems(r.enrollments))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar tu inscripción a este proyecto?')) return;
    try { await api.enrollments.cancel(id); setItems(items.filter(i => i.id !== id)); }
    catch (e: any) { alert(e.message); }
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 bg-gray-50 md:ml-60">
      <Lock className="w-10 h-10 text-gray-300" />
      <p className="text-gray-500 font-medium">Iniciá sesión para ver tus participaciones</p>
      <button onClick={() => openAuthModal()}
        className="text-sm text-white bg-emerald-600 px-5 py-2.5 rounded-xl font-bold">
        Iniciar sesión
      </button>
    </div>
  );

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const counts = {
    all:      items.length,
    pending:  items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Mis Participaciones</h1>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {(['all','pending','approved','rejected'] as FilterKey[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === f ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobadas' : 'Rechazadas'}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === f ? 'bg-white/30 text-white' : 'bg-white text-gray-600'
                }`}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
            <div className="mb-3">
              {filter === 'all' && <Sprout className="w-10 h-10 text-emerald-500" />}
              {filter === 'pending' && <Clock className="w-10 h-10 text-amber-500" />}
              {filter === 'approved' && <CheckCircle className="w-10 h-10 text-green-600" />}
              {filter === 'rejected' && <XCircle className="w-10 h-10 text-red-500" />}
            </div>
            <p className="text-gray-400 font-medium">
              {filter === 'all' ? 'No participaste en ningún proyecto aún'
                : `Sin participaciones ${filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : 'rechazadas'}`}
            </p>
            {filter === 'all' && (
              <Link to="/feed" className="text-sm text-emerald-600 font-semibold mt-2 inline-block">
                Explorar proyectos →
              </Link>
            )}
          </div>
        ) : filtered.map(item => {
          const s = STATUS[item.status as keyof typeof STATUS] || STATUS.rejected;
          const Icon = s.icon;
          return (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex gap-3 p-4">
                {item.image
                  ? <img src={item.image} alt={item.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  : (
                    <div className="w-16 h-16 rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center">
                      <Sprout className="w-7 h-7 text-emerald-600" />
                    </div>
                  )
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-gray-900 leading-tight">{item.title}</h3>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${s.bg} ${s.color}`}>
                      <Icon className="w-3 h-3" />{s.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.ngo_name}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{item.category}</span>
                  </div>
                  {item.status === 'approved' && !!item.hours_logged && (
                    <p className="flex items-center gap-1 text-xs text-blue-600 font-semibold mt-1.5">
                      <Clock className="w-3 h-3" />{item.hours_logged} {item.hours_logged === 1 ? 'hora verificada' : 'horas verificadas'} por la ONG
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 px-4 pb-4">
                <Link to={`/project/${item.project_id}`}
                  className="flex-1 py-2 border border-emerald-300 text-emerald-700 rounded-xl text-xs font-bold text-center hover:bg-emerald-50 transition-colors">
                  Ver proyecto
                </Link>

                {item.status === 'approved' && (
                  <button
                    onClick={() => setReviewTarget({ id: item.project_id, title: item.title })}
                    className="flex-1 py-2 border border-yellow-300 text-yellow-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-yellow-50 transition-colors">
                    <Star className="w-3.5 h-3.5" />Reseña
                  </button>
                )}

                {item.status === 'pending' && (
                  <button onClick={() => handleCancel(item.id)}
                    className="flex-1 py-2 border border-red-300 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de reseña */}
      {reviewTarget && (
        <ReviewModal
          projectId={reviewTarget.id}
          projectTitle={reviewTarget.title}
          onClose={() => setReviewTarget(null)}
          onSaved={() => { setReviewTarget(null); }}
        />
      )}
    </div>
  );
}
