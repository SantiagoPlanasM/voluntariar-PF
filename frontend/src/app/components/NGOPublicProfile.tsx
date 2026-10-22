import { useParams, useNavigate, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { api, NGO, Project } from '../../lib/api';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { LoadError, describeLoadError } from './LoadError';
import { useAuth } from '../../lib/AuthContext';
import { userMessage, FOLLOW_ERROR } from '../../lib/format';
import { ProfileHeader, ProfileTabs } from '../ui/ProfileHeader';
import { Button } from '../ui/Button';
import { VolunteeringTile } from '../volunteering/VolunteeringTile';
import { MomentsFeed } from './MomentsFeed';

export function NGOPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const [ngo, setNgo]         = useState<NGO | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [filter, setFilter]   = useState<'all' | 'active' | 'completed'>('all');
  const [tab, setTab]         = useState<'volunteering' | 'posts'>('volunteering');

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
    void fetchFollowStatus(id).then((status) => {
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
    <div role="status" aria-label="Cargando organización" className="p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4"><div className="w-[88px] h-[88px] rounded-[28%] skeleton" /><div className="flex-1 h-10 rounded skeleton" /></div>
      <div className="h-4 w-1/2 rounded skeleton" /><div className="h-16 rounded-xl skeleton" />
    </div>
  );
  if (loadError || !ngo) return (
    <LoadError message={loadError?.message ?? 'No encontramos esta organización'}
      onRetry={loadError?.retry ? load : undefined} home="/" />
  );

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);
  const active   = projects.filter(p => p.status === 'active').length;
  const totalVol = projects.reduce((s, p) => s + (p.current_volunteers || 0), 0);
  const aboutText = [ngo.description, ngo.mission ? `Misión: ${ngo.mission}` : ''].filter(Boolean).join('\n\n');

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline">
          <ProfileHeader
            name={ngo.name}
            avatar={ngo.logo}
            kind="org"
            subtitle={[ngo.category, ngo.location].filter(Boolean).join(' · ')}
            bio={aboutText}
            onBack={() => navigate(-1)}
            stats={[
              { n: projects.length, label: 'Voluntariados' },
              { n: totalVol, label: 'Voluntarios' },
              { n: followersCount, label: 'Seguidores' },
            ]}
            actions={(
              <>
                {(!user || user.role === 'volunteer') && !statusError && (
                  <Button variant={following ? 'secondary' : 'primary'} onClick={handleToggleFollow} disabled={togglingFollow} aria-pressed={following} className="flex-1">
                    {following ? <><Check size={16} strokeWidth={2.25} aria-hidden="true" />Siguiendo</> : 'Seguir'}
                  </Button>
                )}
                {user && user.id !== ngo.user_id && (
                  <Button variant="secondary" onClick={() => navigate(`/messages/${ngo.user_id}`)} className="flex-1">Mensaje</Button>
                )}
              </>
            )}
            notice={(
              <>
                {followError && <p role="alert" className="text-[13px] font-medium text-critical">{followError}</p>}
                {statusError && (
                  <div role="alert" className="flex items-center gap-2 text-[13px]">
                    <p className="font-medium text-critical">{statusError}</p>
                    <button type="button" onClick={retryFollowStatus} disabled={retryingStatus} className="font-semibold underline disabled:opacity-50 flex-shrink-0">Reintentar</button>
                  </div>
                )}
              </>
            )}
          />

          <ProfileTabs
            label="Contenido de la organización"
            value={tab}
            onChange={setTab}
            tabs={[{ key: 'volunteering', label: 'Voluntariados' }, { key: 'posts', label: 'Publicaciones' }]}
          />

          <div className="p-4 pb-6" role="tabpanel">
            {tab === 'posts' ? (
              <MomentsFeed filters={{ ngo_id: ngo.id }} showComposer={false} />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2" role="group" aria-label="Filtrar voluntariados">
                  {([['all', 'Todos'], ['active', 'Activos'], ['completed', 'Finalizados']] as const).map(([f, label]) => (
                    <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                      className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-colors ${filter === f ? 'bg-ink text-on-ink' : 'bg-surface-soft hover:bg-surface-pressed'}`}>
                      {label}{f === 'active' ? ` · ${active}` : ''}
                    </button>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <p className="text-[15px] text-ink-soft text-center py-8">Sin voluntariados en esta categoría</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-5">
                    {filtered.map(p => <VolunteeringTile key={p.id} project={p} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
