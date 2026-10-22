import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Check } from 'lucide-react';
import { api, VolunteerProfileData, VolunteerSkill } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { MomentsGrid } from './MomentsGrid';
import { FollowListModal, FollowListMode } from './FollowListModal';
import { userMessage, FOLLOW_ERROR } from '../../lib/format';
import { ProfileHeader, ProfileTabs } from '../ui/ProfileHeader';
import { Button, ButtonLink } from '../ui/Button';

const NIVEL_LABELS: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export function VolunteerPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<VolunteerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'volunteering' | 'posts'>('volunteering');

  // Modal de seguidores/seguidos
  const [listMode, setListMode] = useState<FollowListMode | null>(null);

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (id && user && id === user.id) {
      navigate('/profile', { replace: true });
    }
  }, [id, user, navigate]);

  useEffect(() => {
    if (!id || (user && id === user.id)) return;
    // Al saltar a otro perfil (p. ej. desde la lista de seguidores), la respuesta del anterior se descarta:
    // si llegaba última, mostraba el perfil viejo bajo la URL nueva (REVISION F15).
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api.voluntarios.getProfile(id),
      user ? api.follows.volunteerFollowStatus(id) : Promise.resolve({ following: false }),
    ])
      .then(([profileData, statusData]) => {
        if (cancelled) return;
        setData(profileData);
        setFollowing(statusData.following);
        setFollowerCount(profileData.volunteer.followers || 0);
        setFollowingCount(profileData.volunteer.following_count || 0);
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Error al cargar perfil'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user]);

  const handleFollow = async () => {
    if (!user || !id) return;
    setFollowLoading(true);
    setFollowError('');
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
    } catch (e) {
      // Antes `catch { }`: el botón volvía a su estado sin ningún aviso (REVISION S6).
      setFollowError(userMessage(e, FOLLOW_ERROR));
    }
    setFollowLoading(false);
  };

  if (loading) return (
    <div role="status" aria-label="Cargando perfil" className="p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4"><div className="w-[88px] h-[88px] rounded-full skeleton" /><div className="flex-1 h-10 rounded skeleton" /></div>
      <div className="h-4 w-1/2 rounded skeleton" /><div className="h-16 rounded-xl skeleton" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[15px] text-ink-soft">{error || 'Voluntario no encontrado'}</p>
      <Button variant="secondary" onClick={() => navigate(-1)}>Volver</Button>
    </div>
  );

  const v = data.volunteer;
  const displayName = v.nombre && v.apellido ? `${v.nombre} ${v.apellido}` : v.name;
  // users.avatar es la foto del voluntario; voluntarios.foto_perfil es la copia del registro, que nada actualiza (F2, §163).
  const avatarUrl = v.avatar;
  const hours = Math.round(data.stats.total_horas || 0);

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline">
          <ProfileHeader
            name={displayName}
            avatar={avatarUrl}
            kind="person"
            subtitle={[v.location, hours > 0 ? `${hours} h verificadas` : ''].filter(Boolean).join(' · ')}
            bio={v.bio || v.descripcion}
            onBack={() => navigate(-1)}
            stats={[
              { n: data.stats.approved_enrollments, label: 'Voluntariados' },
              { n: followerCount, label: 'Seguidores', onClick: () => setListMode('followers') },
              { n: followingCount, label: 'Siguiendo', onClick: () => setListMode('following') },
            ]}
            actions={(
              <>
                {user && user.role === 'volunteer' && user.id !== id && (
                  <Button variant={following ? 'secondary' : 'primary'} onClick={handleFollow} busy={followLoading} aria-pressed={following} className="flex-1">
                    {following ? <><Check size={16} strokeWidth={2.25} aria-hidden="true" />Siguiendo</> : 'Seguir'}
                  </Button>
                )}
                {user && user.id !== id && (
                  <ButtonLink to={`/messages/${id}`} variant="secondary" aria-label={`Enviar mensaje a ${v.name}`} className="flex-1">Mensaje</ButtonLink>
                )}
              </>
            )}
            notice={followError ? <p role="alert" className="text-[13px] font-medium text-critical">{followError}</p> : undefined}
          />

          {data.habilidades.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-1.5" aria-label="Habilidades">
              {data.habilidades.map((s: VolunteerSkill) => (
                <span key={s.id} className="h-8 px-3 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center">
                  {s.nombre} · {NIVEL_LABELS[s.nivel]}
                </span>
              ))}
            </div>
          )}

          <ProfileTabs
            label="Contenido del perfil"
            value={tab}
            onChange={setTab}
            tabs={[{ key: 'volunteering', label: 'Voluntariados' }, { key: 'posts', label: 'Publicaciones' }]}
          />

          <div className="p-4 pb-6" role="tabpanel">
            {tab === 'posts' ? (
              id && <MomentsGrid filters={{ user_id: id }} />
            ) : data.participaciones.length === 0 ? (
              <p className="text-[15px] text-ink-soft text-center py-8">Aún no participó en ningún voluntariado.</p>
            ) : (
              <ul className="flex flex-col">
                {data.participaciones.map(p => (
                  <li key={p.enrollment_id}>
                    <Link to={`/project/${p.project_id}`} className="flex items-center gap-3 min-h-[72px]">
                      {p.project_image
                        ? <img src={p.project_image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-surface-soft" />
                        : <span className="w-14 h-14 rounded-xl bg-surface-soft flex-shrink-0" aria-hidden="true" />}
                      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold leading-snug line-clamp-2">{p.titulo}</span>
                        <span className="text-[13px] text-ink-muted truncate">{p.ngo_name}</span>
                      </span>
                      <span className="text-[13px] text-ink-muted flex-shrink-0">{p.project_status === 'active' ? 'Activo' : 'Finalizado'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {listMode && id && (
        <FollowListModal mode={listMode} meId={user?.id} onClose={() => setListMode(null)}
          load={m => m === 'followers' ? api.follows.volunteerFollowers(id) : api.follows.volunteerFollowing(id)}
          emptyText={{ followers: 'Todavía no tiene seguidores.', following: 'Todavía no sigue a nadie.' }} />
      )}
    </div>
  );
}
