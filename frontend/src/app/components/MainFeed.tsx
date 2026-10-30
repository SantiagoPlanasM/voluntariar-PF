// Inicio del voluntario. Un solo feed que mezcla, por fecha, los voluntariados de lo que sigue
// (`/api/follows/feed`) con las publicaciones de la gente (`/api/posts`). Así las dos cosas conviven y cada
// publicación muestra su vínculo al voluntariado (DESIGN.md → Publicación). Las cargas son independientes:
// si fallan las publicaciones se ve igual el feed de voluntariados, y al revés se muestra el error con reintento.
import { useState, useEffect, useMemo } from 'react';
import { Compass } from 'lucide-react';
import { api, Project, FeedProject, NGO, Post } from '../../lib/api';
import { FeedPostCard } from './FeedPostCard';
import { PostCard } from './PostCard';
import { FeedSidebar, FollowNgoError } from './FeedSidebar';
import { TeamInvites } from './TeamInvites';
import { useAuth } from '../../lib/AuthContext';
import { Link } from 'react-router';
import { InlineError } from './LoadError';
import { userMessage, FOLLOW_ERROR, parseBackendDate } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button, ButtonLink } from '../ui/Button';

type FeedItem =
  | { kind: 'project'; id: string; at: number; project: FeedProject }
  | { kind: 'post'; id: string; at: number; post: Post };

const POSTS_PAGE = 12;

export function MainFeed() {
  const { user } = useAuth();

  const isVolunteer = user?.role === 'volunteer';

  const [followingProjects, setFollowingProjects] = useState<FeedProject[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [projectIndex, setProjectIndex] = useState<Record<string, Project>>({});

  const [suggestedNgos, setSuggestedNgos] = useState<NGO[]>([]);
  const [followingNgoIds, setFollowingNgoIds] = useState<Set<string>>(new Set());
  const [urgentProjects, setUrgentProjects] = useState<Project[]>([]);

  // Errores de carga (REVISION S1): antes un fallo se veía como el estado vacío.
  const [feedError, setFeedError] = useState('');
  const [suggestionsError, setSuggestionsError] = useState('');

  const loadFollowingFeed = async () => {
    if (!isVolunteer) return;
    setLoadingFollowing(true);
    setFeedError('');
    try {
      const res = await api.follows.feed(30, 0);
      setFollowingProjects(res.projects || []);
    } catch (err) {
      setFeedError(userMessage(err, 'No pudimos cargar tu feed. Revisá tu conexión.'));
    } finally {
      setLoadingFollowing(false);
    }
  };

  // Publicaciones: son un complemento del feed. Si fallan, no se muestra un error que tape lo demás.
  const loadPosts = async () => {
    try {
      const res = await api.posts.list({ limit: POSTS_PAGE, offset: 0 });
      setPosts(res.posts);
      setPostsHasMore(res.has_more);
    } catch { /* el feed de voluntariados sigue funcionando */ }
  };

  const loadMorePosts = async () => {
    if (loadingMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const res = await api.posts.list({ limit: POSTS_PAGE, offset: posts.length });
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...res.posts.filter(p => !seen.has(p.id))];
      });
      setPostsHasMore(res.has_more);
    } catch { /* se puede volver a tocar */ } finally {
      setLoadingMorePosts(false);
    }
  };

  const loadSidebarData = async () => {
    if (!isVolunteer) return;
    setSuggestionsError('');
    // Las sugerencias necesitan las dos listas: sin "mis ONGs" sugeriría las que ya sigo.
    const [ngosRes, followedRes] = await Promise.allSettled([api.ngos.list(), api.follows.myNgos()]);
    if (ngosRes.status === 'rejected' || followedRes.status === 'rejected') {
      const err = ngosRes.status === 'rejected' ? ngosRes.reason : (followedRes as PromiseRejectedResult).reason;
      setSuggestionsError(userMessage(err, 'No pudimos cargar las sugerencias. Revisá tu conexión.'));
    } else {
      const followedIds = new Set((followedRes.value.ngos || []).map(n => n.id));
      setFollowingNgoIds(followedIds);
      setSuggestedNgos((ngosRes.value.ngos || []).filter(n => !followedIds.has(n.id)).slice(0, 5));
    }
  };

  // Voluntariados activos: alimentan "Próximas actividades" y el vínculo de cada publicación (foto y avance).
  // Si falla, esas partes no se muestran (no tienen texto de "vacío").
  const loadActiveProjects = () => {
    api.projects.list({ status: 'active' })
      .then(r => {
        const list = r.projects || [];
        setUrgentProjects(list.slice(0, 3));
        setProjectIndex(Object.fromEntries(list.map(p => [p.id, p])));
      })
      .catch(() => {});
  };
  const retrySidebar = () => { void loadSidebarData(); loadActiveProjects(); };

  const [followError, setFollowError] = useState<FollowNgoError | null>(null);
  // ONGs con un "Seguir" en vuelo: su botón queda bloqueado hasta la respuesta (antes un doble clic mandaba dos pedidos).
  const [sendingNgoIds, setSendingNgoIds] = useState<Set<string>>(new Set());

  const handleFollowSuggestedNgo = async (ngoId: string) => {
    setFollowError(null);
    setSendingNgoIds(prev => new Set(prev).add(ngoId));
    try {
      await api.follows.followNgo(ngoId);
      setFollowingNgoIds(prev => new Set([...prev, ngoId]));
      setSuggestedNgos(prev => prev.filter(n => n.id !== ngoId));
      void loadFollowingFeed();
    } catch (err) {
      setFollowError({ ngoId, message: userMessage(err, FOLLOW_ERROR) });
    } finally {
      setSendingNgoIds(prev => { const next = new Set(prev); next.delete(ngoId); return next; });
    }
  };

  useEffect(() => {
    if (isVolunteer) {
      void loadSidebarData();
      loadActiveProjects();
      void loadFollowingFeed();
      void loadPosts();
    }
  }, [isVolunteer]);

  const items = useMemo<FeedItem[]>(() => {
    const a: FeedItem[] = followingProjects.map(p => ({ kind: 'project', id: `p-${p.id}`, at: p.created_at ? parseBackendDate(p.created_at) : 0, project: p }));
    const b: FeedItem[] = posts.map(p => ({ kind: 'post', id: `m-${p.id}`, at: parseBackendDate(p.created_at), post: p }));
    return [...a, ...b].sort((x, y) => (Number.isNaN(y.at) ? 0 : y.at) - (Number.isNaN(x.at) ? 0 : x.at));
  }, [followingProjects, posts]);

  const nothingFollowed = !loadingFollowing && !feedError && followingProjects.length === 0;
  const firstName = user?.name?.split(' ')[0] || 'Voluntario';

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-[900px] xl:max-w-[1000px] mx-auto md:px-6 md:pt-6 flex justify-center gap-8 items-start">
        <div className="w-full max-w-[520px] flex-1 min-w-0 flex flex-col gap-3 md:gap-6 px-3 md:px-0 pt-1 md:pt-0">
          <h1 className="sr-only">Inicio</h1>

          {isVolunteer && <TeamInvites />}

          {nothingFollowed && (
            <section className="rounded-2xl bg-surface border border-hairline p-5 flex flex-col gap-4" aria-labelledby="empezar">
              <div className="flex flex-col gap-1">
                <h2 id="empezar" className="text-[22px] font-bold tracking-[-0.3px]">Hola, {firstName}. Empezá por una causa</h2>
                <p className="text-[15px] leading-[1.45] text-ink-soft">
                  Seguí voluntariados y organizaciones y acá vas a ver sus novedades.
                </p>
              </div>

              {suggestedNgos.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {suggestedNgos.slice(0, 3).map(ngo => (
                    <li key={ngo.id}>
                      <div className="flex items-center gap-3">
                        <Link to={`/ngo/${ngo.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar src={ngo.logo} name={ngo.name} kind="org" size={44} />
                          <span className="min-w-0 flex flex-col">
                            <span className="text-[15px] font-semibold truncate">{ngo.name}</span>
                            <span className="text-[13px] text-ink-muted">{ngo.followers || 0} seguidores</span>
                          </span>
                        </Link>
                        <Button variant="primary" onClick={() => handleFollowSuggestedNgo(ngo.id)} disabled={sendingNgoIds.has(ngo.id)} className="!h-8 !px-3.5 !text-[13px]">
                          Seguir
                        </Button>
                      </div>
                      {followError?.ngoId === ngo.id && <p role="alert" className="mt-1 text-[13px] font-medium text-critical">{followError.message}</p>}
                    </li>
                  ))}
                </ul>
              )}

              <ButtonLink to="/explore" variant="primary" block>
                <Compass size={18} strokeWidth={1.75} aria-hidden="true" />Ver voluntariados
              </ButtonLink>
            </section>
          )}

          {loadingFollowing ? (
            <div role="status" aria-label="Cargando tu feed" className="flex flex-col gap-3 md:gap-6">
              {[1, 2].map(i => (
                <div key={i} aria-hidden="true" className="bg-surface border border-hairline rounded-2xl overflow-hidden">
                  <div className="aspect-[16/10] skeleton" />
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-[28%] skeleton" /><div className="h-4 w-1/3 rounded skeleton" /></div>
                    <div className="h-5 w-3/4 rounded skeleton" />
                    <div className="h-3 rounded skeleton" />
                    <div className="h-12 rounded-xl skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : feedError ? (
            <InlineError message={feedError} onRetry={loadFollowingFeed} />
          ) : (
            <>
              {items.map(it => it.kind === 'project'
                ? <FeedPostCard key={it.id} project={it.project} onRefresh={loadFollowingFeed} />
                : <PostCard key={it.id} post={it.post} project={projectIndex[it.post.project.id]}
                    onDeleted={id => setPosts(prev => prev.filter(p => p.id !== id))} />)}
              {postsHasMore && (
                <Button variant="secondary" block onClick={loadMorePosts} busy={loadingMorePosts} busyLabel="Cargando…">
                  Ver más publicaciones
                </Button>
              )}
            </>
          )}
        </div>

        {/* Columna derecha: aparece desde 1160 px */}
        <aside className="hidden min-[1160px]:block w-80 flex-shrink-0 sticky top-6">
          <FeedSidebar
            user={user}
            suggestedNgos={suggestedNgos}
            followingNgoIds={followingNgoIds}
            onFollowNgo={handleFollowSuggestedNgo}
            urgentProjects={urgentProjects}
            suggestionsError={suggestionsError}
            onRetrySuggestions={retrySidebar}
            followError={followError}
            sendingNgoIds={sendingNgoIds}
          />
        </aside>
      </div>
    </div>
  );
}
