import { useState, useEffect } from 'react';
import { LogOut, Bell, Users, Compass, ArrowRight } from 'lucide-react';
import { api, Project, FeedProject, NGO } from '../../lib/api';
import { FeedPostCard } from './FeedPostCard';
import { FeedSidebar } from './FeedSidebar';
import { useAuth } from '../../lib/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router';

export function MainFeed() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isVolunteer = user?.role === 'volunteer';

  const [unread, setUnread] = useState(0);
  const [followingProjects, setFollowingProjects] = useState<FeedProject[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  const [suggestedNgos, setSuggestedNgos] = useState<NGO[]>([]);
  const [followingNgoIds, setFollowingNgoIds] = useState<Set<string>>(new Set());
  const [urgentProjects, setUrgentProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    api.notifications.list().then(r => setUnread(r.unread)).catch(() => {});
  }, [user, pathname]);

  // Cargar feed de seguidos
  const loadFollowingFeed = async () => {
    if (!isVolunteer) return;
    setLoadingFollowing(true);
    try {
      const res = await api.follows.feed(30, 0);
      setFollowingProjects(res.projects || []);
    } catch (err) {
      console.error('Error loading following feed:', err);
      setFollowingProjects([]);
    } finally {
      setLoadingFollowing(false);
    }
  };

  // Cargar datos para la barra lateral derecha (Sugerencias, Próximas actividades, ONGs seguidas)
  const loadSidebarData = async () => {
    if (!isVolunteer) return;
    try {
      const [allNgosRes, myFollowedRes, activeProjectsRes] = await Promise.all([
        api.ngos.list().catch(() => ({ ngos: [] })),
        api.follows.myNgos().catch(() => ({ ngos: [] })),
        api.projects.list({ status: 'active' }).catch(() => ({ projects: [] })),
      ]);

      const followedIds = new Set((myFollowedRes.ngos || []).map(n => n.id));
      setFollowingNgoIds(followedIds);

      // Sugerencias: ONGs que aún no sigue
      const suggestions = (allNgosRes.ngos || []).filter(n => !followedIds.has(n.id));
      setSuggestedNgos(suggestions.slice(0, 5));

      // Actividades destacadas o urgentes
      setUrgentProjects((activeProjectsRes.projects || []).slice(0, 3));
    } catch (err) {
      console.error('Error loading sidebar data:', err);
    }
  };

  const handleFollowSuggestedNgo = async (ngoId: string) => {
    try {
      await api.follows.followNgo(ngoId);
      setFollowingNgoIds(prev => new Set([...prev, ngoId]));
      setSuggestedNgos(prev => prev.filter(n => n.id !== ngoId));
      loadFollowingFeed();
    } catch (err) {
      console.error('Error following NGO:', err);
    }
  };

  useEffect(() => {
    if (isVolunteer) {
      loadSidebarData();
      loadFollowingFeed();
    }
  }, [isVolunteer]);

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60 pb-16">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base sm:text-lg font-black text-gray-900">Inicio</h1>
              <p className="text-xs text-gray-400">Hola, {user?.name?.split(' ')[0] || 'Voluntario'}</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0 relative"
                title="Notificaciones"
              >
                <Bell className="w-4 h-4 text-gray-600" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Feed Principal ────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex justify-center gap-8 items-start">
        {/* Columna Principal: Feed de Posts */}
        <div className="w-full max-w-xl flex-1 min-w-0">
          {loadingFollowing ? (
            <div className="space-y-6">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-3xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-64 bg-gray-200" />
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3" />
                        <div className="h-3 bg-gray-200 rounded w-1/4" />
                      </div>
                    </div>
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded" />
                    <div className="h-10 bg-gray-200 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : followingProjects.length === 0 ? (
            /* Estado Vacío de Seguidos */
            <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-6 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-black text-gray-900">Tu feed personalizado está listo</h2>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Seguí a organizaciones o voluntariados específicos para ver sus publicaciones y novedades acá en formato post.
                </p>
              </div>

              {/* Sugerencias de ONGs para empezar a seguir */}
              {suggestedNgos.length > 0 && (
                <div className="pt-2 text-left border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
                    ONGs recomendadas para vos
                  </p>
                  <div className="space-y-3">
                    {suggestedNgos.map(ngo => (
                      <div
                        key={ngo.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 hover:bg-gray-100/80 transition-colors border border-gray-100"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {ngo.logo ? (
                            <img src={ngo.logo} alt={ngo.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                              {ngo.name[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link to={`/ngo/${ngo.id}`} className="font-bold text-xs text-gray-900 hover:underline block truncate">
                              {ngo.name}
                            </Link>
                            <span className="text-[11px] text-gray-500">{ngo.followers || 0} seguidores</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleFollowSuggestedNgo(ngo.id)}
                          disabled={followingNgoIds.has(ngo.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            followingNgoIds.has(ngo.id)
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          }`}
                        >
                          {followingNgoIds.has(ngo.id) ? 'Siguiendo' : 'Seguir'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/explore"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Compass className="w-4 h-4" />
                  <span>Explorar todos los voluntariados</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Lista de Posts tipo Instagram */
            <div className="space-y-4">
              {followingProjects.map(p => (
                <FeedPostCard
                  key={p.id}
                  project={p}
                  onRefresh={loadFollowingFeed}
                />
              ))}
            </div>
          )}
        </div>

        {/* Columna Lateral Derecha para Escritorio */}
        <aside className="hidden lg:block w-80 flex-shrink-0 sticky top-24">
          <FeedSidebar
            user={user}
            suggestedNgos={suggestedNgos}
            followingNgoIds={followingNgoIds}
            onFollowNgo={handleFollowSuggestedNgo}
            urgentProjects={urgentProjects}
          />
        </aside>
      </div>
    </div>
  );
}
