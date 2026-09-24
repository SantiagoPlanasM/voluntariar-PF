import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  User, MapPin, Clock, CheckCircle, Heart, Sparkles, Loader2,
  UserPlus, UserCheck, Users, X, Sprout, ArrowLeft, MessageSquare
} from 'lucide-react';
import { api, VolunteerProfileData, VolunteerPublic, VolunteerSkill } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

const NIVEL_LABELS: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

type ListMode = 'followers' | 'following' | null;

export function VolunteerPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<VolunteerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [error, setError] = useState('');

  // Modal de seguidores/seguidos
  const [listMode, setListMode] = useState<ListMode>(null);
  const [listData, setListData] = useState<VolunteerPublic[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (id && user && id === user.id) {
      navigate('/profile', { replace: true });
    }
  }, [id, user, navigate]);

  useEffect(() => {
    if (!id || (user && id === user.id)) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.voluntarios.getProfile(id),
      user ? api.follows.volunteerFollowStatus(id) : Promise.resolve({ following: false }),
    ])
      .then(([profileData, statusData]) => {
        setData(profileData);
        setFollowing(statusData.following);
        setFollowerCount(profileData.volunteer.followers || 0);
        setFollowingCount(profileData.volunteer.following_count || 0);
      })
      .catch(e => setError(e.message || 'Error al cargar perfil'))
      .finally(() => setLoading(false));
  }, [id, user]);

  const handleFollow = async () => {
    if (!user || !id) return;
    setFollowLoading(true);
    try {
      if (following) {
        const r = await api.follows.unfollowVolunteer(id);
        setFollowing(false);
        setFollowerCount(r.followers);
      } else {
        const r = await api.follows.followVolunteer(id);
        setFollowing(true);
        setFollowerCount(r.followers);
      }
    } catch { }
    setFollowLoading(false);
  };

  const openList = async (mode: 'followers' | 'following') => {
    if (!id) return;
    setListMode(mode);
    setListLoading(true);
    try {
      const r = mode === 'followers'
        ? await api.follows.volunteerFollowers(id)
        : await api.follows.volunteerFollowing(id);
      setListData(r.volunteers);
    } catch { setListData([]); }
    setListLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 md:ml-60 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 md:ml-60 flex flex-col items-center justify-center gap-3">
      <User className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 text-sm">{error || 'Voluntario no encontrado'}</p>
      <button onClick={() => navigate(-1)} className="text-emerald-600 text-sm font-semibold">← Volver</button>
    </div>
  );

  const v = data.volunteer;
  const displayName = v.nombre && v.apellido ? `${v.nombre} ${v.apellido}` : v.name;
  const avatarUrl = v.foto_perfil || v.avatar;

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-4 pt-14 pb-10 relative z-0">
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {user && user.id !== id && (
          <Link to={`/messages/${id}`}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <MessageSquare className="w-5 h-5 text-white" />
          </Link>
        )}

        <div className="text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto mb-3 overflow-hidden shadow-xl">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">{displayName[0]}</div>
            }
          </div>
          <h1 className="text-2xl font-bold text-white mb-0.5">{displayName}</h1>
          {v.location && (
            <p className="text-white/60 text-xs mt-1 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{v.location}</span>
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-white/20 text-white text-xs rounded-full font-medium">
            <User className="w-3 h-3" />
            <span>Voluntario</span>
          </span>
        </div>
      </div>

      {/* Stats: Seguidos, Seguidores, Participaciones */}
      <div className="px-4 -mt-6 mb-5 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <button onClick={() => openList('followers')} className="text-center group cursor-pointer">
              <p className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{followerCount}</p>
              <p className="text-xs text-gray-500">Seguidores</p>
            </button>
            <button onClick={() => openList('following')} className="text-center group cursor-pointer">
              <p className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{followingCount}</p>
              <p className="text-xs text-gray-500">Siguiendo</p>
            </button>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{data.stats.approved_enrollments}</p>
              <p className="text-xs text-gray-500">Voluntariados</p>
            </div>
          </div>

          {/* Follow button */}
          {user && user.role === 'volunteer' && user.id !== id && (
            <button onClick={handleFollow} disabled={followLoading}
              className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                following
                  ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              } disabled:opacity-60`}>
              {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                following ? <><UserCheck className="w-4 h-4" /> Siguiendo</> :
                  <><UserPlus className="w-4 h-4" /> Seguir</>
              }
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4 pb-8 relative z-10">
        {/* Bio */}
        {(v.bio || v.descripcion) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Sobre {v.nombre || displayName.split(' ')[0]}</p>
            <p className="text-sm text-gray-700">{v.bio || v.descripcion}</p>
          </div>
        )}

        {/* Stats card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 grid grid-cols-3 gap-4">
          {[
            { icon: CheckCircle, label: 'Aprobadas', val: data.stats.approved_enrollments, color: 'text-green-600', bg: 'bg-green-50' },
            { icon: Clock, label: 'Horas', val: Math.round(data.stats.total_horas || 0), color: 'text-amber-500', bg: 'bg-amber-50' },
            { icon: Heart, label: 'Total', val: data.stats.total_enrollments, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

        {/* Habilidades */}
        {data.habilidades.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />Habilidades
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.habilidades.map((s: VolunteerSkill) => (
                <span key={s.id} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                  {s.nombre} · {NIVEL_LABELS[s.nivel]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Participaciones */}
        <div>
          <h2 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-emerald-600" />
            Voluntariados ({data.participaciones.length})
          </h2>
          {data.participaciones.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center p-4">
              <Sprout className="w-8 h-8 text-gray-300 mb-1.5" />
              <p className="text-xs text-gray-500">Aún no participó en ningún voluntariado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.participaciones.map(p => (
                <Link to={`/project/${p.project_id}`} key={p.enrollment_id}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex gap-3 items-center hover:border-emerald-200 transition-colors">
                    {p.project_image
                      ? <img src={p.project_image} alt={p.titulo} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center">
                          <Sprout className="w-5 h-5 text-emerald-600" />
                        </div>
                      )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.titulo}</p>
                      <p className="text-xs text-gray-500">{p.ngo_name}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                      p.project_status === 'active' ? 'bg-green-50 text-green-600'
                        : 'bg-gray-100 text-gray-500'}`}>
                      {p.project_status === 'active' ? 'Activo' : 'Completado'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de seguidores/seguidos (Instagram style) */}
      {listMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setListMode(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {listMode === 'followers' ? 'Seguidores' : 'Siguiendo'}
              </h3>
              <button onClick={() => setListMode(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {listLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
              ) : listData.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {listMode === 'followers' ? 'Todavía no tiene seguidores.' : 'Todavía no sigue a nadie.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {listData.map(vol => (
                    <Link
                      key={vol.user_id}
                      to={vol.user_id === user?.id ? '/profile' : `/volunteer/${vol.user_id}`}
                      onClick={() => setListMode(null)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {(vol.foto_perfil || vol.avatar) ? (
                        <img src={vol.foto_perfil || vol.avatar} alt={vol.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm ring-2 ring-gray-100">
                          {vol.name[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{vol.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {vol.ubicacion || vol.location || 'Argentina'} · {vol.followers || 0} seguidores
                        </p>
                      </div>
                      {vol.user_id === user?.id && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Tú</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
