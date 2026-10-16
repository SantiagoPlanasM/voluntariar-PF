import { useParams, useNavigate, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Users, Sprout, Loader2, Calendar, MessageCircle, UserPlus, Check } from 'lucide-react';
import { api, NGO, Project } from '../../lib/api';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { LoadError, describeLoadError } from './LoadError';
import { useAuth } from '../../lib/AuthContext';
import { userMessage, FOLLOW_ERROR } from '../../lib/format';

function safePct(a: any, b: any) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!nb || isNaN(na) || isNaN(nb)) return 0;
  return Math.min(100, Math.round((na / nb) * 100));
}

export function NGOPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const [ngo, setNgo]         = useState<NGO | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [filter, setFilter]   = useState<'all' | 'active' | 'completed'>('all');

  const [following, setFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followersCount, setFollowersCount] = useState(0);
  // Error al consultar si ya la sigo. Antes se tragaba (`following: false`) y el botón decía "Seguir"
  // aunque ya la siguieras; ahora el botón no se muestra y hay un aviso con "Reintentar".
  const [statusError, setStatusError] = useState('');
  const [retryingStatus, setRetryingStatus] = useState(false);
  // Solo un voluntario puede seguir: sin sesión (o con otro rol) no hay nada que consultar.
  const canFollow = user?.role === 'volunteer';

  // Solo vale la respuesta del último pedido (al cambiar de :id o reintentar): REVISION F15, §89.
  const latest = useLatestRequest();
  // También al cambiar la sesión (login desde el modal o logout sin salir del perfil): si no, "¿ya la sigo?"
  // quedaba con la respuesta de antes y el botón decía "Seguir" aunque ya la siguieras (§132). Se recarga el
  // perfil entero y no solo el estado: comparten `latest`, y recargar solo el estado descartaría una carga en curso.
  useEffect(() => { load(); }, [id, user?.id]);

  /** "¿Ya la sigo?" sin rechazar nunca: un error vuelve como mensaje, así no tumba el resto del perfil. */
  const fetchFollowStatus = (ngoId: string): Promise<{ following: boolean; error: string }> =>
    !canFollow
      ? Promise.resolve({ following: false, error: '' })
      : api.follows.ngoStatus(ngoId).then(
          (r) => ({ following: r.following, error: '' }),
          (err) => ({ following: false, error: userMessage(err, 'No pudimos saber si ya seguís a esta organización. Revisá tu conexión.') }),
        );

  const load = () => {
    if (!id) return;
    const req = latest.start();
    setLoading(true);
    setLoadError(null);
    setRetryingStatus(false); // un "Reintentar" de la ONG anterior que quedó en vuelo ya no cuenta
    Promise.all([api.ngos.get(id), fetchFollowStatus(id)])
      .then(([{ ngo: n, projects: p }, status]) => {
        if (!latest.isLatest(req)) return;
        setNgo(n);
        setProjects(p);
        setFollowersCount(n.followers || 0);
        setFollowing(status.following);
        setStatusError(status.error);
      })
      .catch((e) => { if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos esta organización')); })
      .finally(() => { if (latest.isLatest(req)) setLoading(false); });
  };

  /** "Reintentar" del aviso: solo vuelve a preguntar si la sigo (no recarga el perfil). */
  const retryFollowStatus = () => {
    if (!id) return;
    const req = latest.start();
    setRetryingStatus(true);
    fetchFollowStatus(id).then((status) => {
      if (!latest.isLatest(req)) return;
      setFollowing(status.following);
      setStatusError(status.error);
      setRetryingStatus(false);
    });
  };

  const handleToggleFollow = async () => {
    if (!user) {
      openAuthModal('Iniciá sesión para seguir a esta ONG');
      return;
    }
    if (user.role !== 'volunteer' || !ngo || togglingFollow) return;

    setTogglingFollow(true);
    setFollowError('');
    try {
      if (following) {
        const res = await api.follows.unfollowNgo(ngo.id);
        setFollowing(false);
        setFollowersCount(res.followers);
      } else {
        const res = await api.follows.followNgo(ngo.id);
        setFollowing(true);
        setFollowersCount(res.followers);
      }
    } catch (err) {
      // Antes solo se logueaba (REVISION S6).
      setFollowError(userMessage(err, FOLLOW_ERROR));
    } finally {
      setTogglingFollow(false);
    }
  };

  if (loading) return (
    <div role="status" aria-label="Cargando organización" className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );
  if (loadError || !ngo) return (
    <LoadError message={loadError?.message ?? 'No encontramos esta organización'}
      onRetry={loadError?.retry ? load : undefined} home="/" />
  );

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);
  const active   = projects.filter(p => p.status === 'active').length;
  const totalVol = projects.reduce((s, p) => s + (p.current_volunteers || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      {/* Header */}
      <div className="relative h-32 sm:h-44 bg-gradient-to-br from-emerald-600 to-teal-700 flex-shrink-0">
        {ngo.cover_image && (
          <img src={ngo.cover_image} alt="" className="w-full h-full object-cover opacity-40" />
        )}
        <button onClick={() => navigate(-1)} aria-label="Volver"
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4">
        {/* Avatar + info. `relative` para que se pinte sobre el banner (que es `relative`; antes lo tapaba
            arriba) y el texto arranca 44 px abajo (pt-11): siempre debajo del banner, aunque el nombre ocupe
            dos líneas; solo el logo se superpone (§128). */}
        <div className="relative flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3 -mt-10 mb-4">
          <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden flex-shrink-0">
            {ngo.logo
              ? <img src={ngo.logo} alt={ngo.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-2xl font-black text-emerald-700">{ngo.name[0]}</div>
            }
          </div>
          <div className="pt-11 min-w-0 flex-1">
            <h1 className="text-xl font-black text-gray-900 leading-tight break-words">{ngo.name}</h1>
            {ngo.location && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />{ngo.location}
              </p>
            )}
          </div>
          {/* En el celular los botones van en su propia línea, debajo (en la misma fila tapaban el nombre). */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:pt-11">
            {(!user || user.role === 'volunteer') && !statusError && (
              <button
                onClick={handleToggleFollow}
                disabled={togglingFollow}
                className={`mb-1 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 shadow-sm ${
                  following
                    ? 'bg-emerald-100 hover:bg-red-50 text-emerald-800 hover:text-red-700 border border-emerald-200 hover:border-red-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {following ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Siguiendo</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Seguir</span>
                  </>
                )}
              </button>
            )}

            {user && user.id !== ngo.user_id && (
              <button onClick={() => navigate(`/messages/${ngo.user_id}`)}
                className="mb-1 flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors flex-shrink-0">
                <MessageCircle className="w-3.5 h-3.5" />Mensaje
              </button>
            )}
          </div>
        </div>
        {followError && <p role="alert" className="-mt-2 mb-3 text-xs font-medium text-red-600 text-right">{followError}</p>}
        {statusError && (
          <div role="alert" className="-mt-2 mb-3 flex items-center justify-end gap-2 text-xs">
            <p className="font-medium text-red-600">{statusError}</p>
            <button onClick={retryFollowStatus} disabled={retryingStatus}
              className="font-semibold text-emerald-700 hover:underline disabled:opacity-50 flex-shrink-0">
              Reintentar
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
          {[
            { val: followersCount,  label: 'Seguidores', color: 'text-amber-600',   bg: 'bg-amber-50'   },
            { val: projects.length, label: 'Proyectos',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { val: active,          label: 'Activos',    color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { val: totalVol,        label: 'Voluntarios',color: 'text-violet-600',  bg: 'bg-violet-50'  },
          ].map(({ val, label, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
              <p className={`text-xl sm:text-2xl font-black ${color}`}>{val}</p>
              <p className="text-[11px] sm:text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Descripción y misión */}
        {(ngo.description || ngo.mission) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
            {ngo.description && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                <p className="text-sm text-gray-700 leading-relaxed">{ngo.description}</p>
              </div>
            )}
            {ngo.mission && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Misión</p>
                <p className="text-sm text-gray-700 leading-relaxed">{ngo.mission}</p>
              </div>
            )}
          </div>
        )}

        {/* Proyectos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-gray-900">Proyectos</h2>
            </div>
            <div className="flex gap-1">
              {(['all','active','completed'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === f ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Completados'}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin proyectos en esta categoría</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(p => {
                const volPct = safePct(p.current_volunteers, p.volunteers_needed);
                return (
                  <Link key={p.id} to={`/project/${p.id}`}>
                    <div className="p-4 flex gap-3 hover:bg-gray-50 transition-colors">
                      {p.image
                        ? <img src={p.image} alt={p.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        : (
                          <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Sprout className="w-6 h-6 text-emerald-600" />
                          </div>
                        )
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm text-gray-900 truncate">{p.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                            p.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {p.status === 'active' ? 'Activo' : 'Completado'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          {p.type === 'fugaz'
                            ? <><Calendar className="w-3 h-3" />{p.duration || 'Fugaz'}</>
                            : <><Calendar className="w-3 h-3" />{p.hours_per_week}h/semana</>
                          }
                        </p>
                        <div className="mt-1.5">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />Voluntarios</span>
                            <span className="font-bold text-emerald-600">{p.current_volunteers}/{p.volunteers_needed}</span>
                          </div>
                          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${volPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
