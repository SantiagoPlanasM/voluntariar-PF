// src/app/components/MomentsFeed.tsx
//
// Lista paginada de publicaciones de Momentos, con el botón para publicar. Sirve para el feed general
// (sin filtros) y, en la Etapa 3, para la galería de un proyecto (`project_id`) o la de una persona (`user_id`).
//
// Paginación (`limit/offset`, ver API_CONTEXT): el servidor ordena por fecha, así que si entran publicaciones
// nuevas mientras se pagina, las páginas se corren y una publicación puede REPETIRSE. Por eso:
//   - se deduplica por id al juntar páginas;
//   - el `offset` avanza por lo que el servidor DEVOLVIÓ (no por lo que se muestra: si no, se repetirían de nuevo);
//   - al borrar una publicación del feed (todo lo posterior se corre un lugar) el offset retrocede 1, y al
//     publicar una nueva (todo se corre un lugar hacia atrás) avanza 1.
//
// `liked_by_me` y `can_delete` los calcula el servidor según QUIÉN mira. Si el visitante inicia sesión desde el
// modal (por ejemplo al tocar "me gusta") sin salir de la pantalla, lo ya cargado quedó calculado para un
// anónimo: por eso el feed recarga cuando cambia el id del usuario (no cuando cambia su objeto).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImageOff, Loader2 } from 'lucide-react';
import { api, type Post } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';

interface Props {
  /** Filtros del servidor (galería de un proyecto / de una persona). */
  filters?: { project_id?: string; user_id?: string };
  /** Mostrar el botón para publicar (solo lo ven voluntarios y ONGs). Por defecto sí. */
  showComposer?: boolean;
  pageSize?: number;
}

function mergeById(current: Post[], incoming: Post[]): Post[] {
  const seen = new Set(current.map((p) => p.id));
  const fresh: Post[] = [];
  for (const p of incoming) {
    if (!seen.has(p.id)) { seen.add(p.id); fresh.push(p); }
  }
  return fresh.length ? [...current, ...fresh] : current;
}

export function MomentsFeed({ filters, showComposer = true, pageSize = 12 }: Props) {
  const { user } = useAuth();
  const projectId = filters?.project_id;
  const userId = filters?.user_id;
  const viewerId = user?.id ?? null;

  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [composing, setComposing] = useState(false);

  const offsetRef = useRef(0);          // posición en el servidor de la próxima página
  const generation = useRef(0);         // cambia con cada carga inicial: descarta respuestas viejas
  const moreInFlight = useRef(false);

  const filterParams = useCallback(() => {
    const params: { project_id?: string; user_id?: string } = {};
    if (projectId) params.project_id = projectId;
    if (userId) params.user_id = userId;
    return params;
  }, [projectId, userId]);

  const loadFirst = useCallback(async () => {
    const mine = ++generation.current;
    moreInFlight.current = false;
    setStatus('loading');
    setMoreFailed(false);
    setLoadingMore(false);
    try {
      const res = await api.posts.list({ ...filterParams(), limit: pageSize, offset: 0 });
      if (mine !== generation.current) return;
      setPosts(mergeById([], res.posts));
      offsetRef.current = res.posts.length;
      setHasMore(res.has_more);
      setStatus('ready');
    } catch {
      if (mine !== generation.current) return;
      setStatus('error');
    }
  }, [filterParams, pageSize]);

  // `viewerId` no se usa adentro de loadFirst: está solo para que un cambio de usuario dispare la recarga.
  useEffect(() => {
    loadFirst();
    return () => { generation.current++; };
  }, [loadFirst, viewerId]);

  async function loadMore() {
    if (moreInFlight.current || !hasMore) return;
    moreInFlight.current = true;
    const mine = generation.current;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const res = await api.posts.list({ ...filterParams(), limit: pageSize, offset: offsetRef.current });
      if (mine !== generation.current) return;
      offsetRef.current += res.posts.length;
      setPosts((prev) => mergeById(prev, res.posts));
      setHasMore(res.has_more);
    } catch {
      if (mine !== generation.current) return;
      setMoreFailed(true);
    } finally {
      if (mine === generation.current) {
        moreInFlight.current = false;
        setLoadingMore(false);
      }
    }
  }

  function handleDeleted(postId: string) {
    if (!posts.some((p) => p.id === postId)) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    offsetRef.current = Math.max(0, offsetRef.current - 1);
  }

  function handleCreated(post: Post) {
    setComposing(false);
    // Una publicación que no corresponde a esta vista (otro proyecto / otro autor) no se agrega.
    if (projectId && post.project.id !== projectId) return;
    if (userId && post.author.id !== userId) return;
    if (posts.some((p) => p.id === post.id)) return;
    setPosts((prev) => [post, ...prev]);
    offsetRef.current += 1;
  }

  const canPost = showComposer && (user?.role === 'volunteer' || user?.role === 'ngo');

  return (
    <div className="space-y-6">
      {canPost && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          Compartir un momento
        </button>
      )}

      {status === 'loading' && (
        <div role="status" aria-label="Cargando momentos" className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="bg-white rounded-3xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
              <div className="aspect-square bg-gray-200" />
              <div className="p-4"><div className="h-3 bg-gray-200 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-3">
          <p role="alert" className="text-sm text-red-600">
            No pudimos cargar los momentos. Revisá tu conexión y probá de nuevo.
          </p>
          <button type="button" onClick={loadFirst} className="text-sm font-semibold text-emerald-700 hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {status === 'ready' && posts.length === 0 && (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <ImageOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="font-bold text-gray-900">Todavía no hay momentos</p>
          <p className="text-sm text-gray-500">
            {canPost
              ? 'Compartí las primeras fotos de tu voluntariado.'
              : 'Cuando los voluntarios compartan fotos de sus jornadas, las vas a ver acá.'}
          </p>
        </div>
      )}

      {status === 'ready' && posts.length > 0 && (
        <>
          {posts.map((post) => <PostCard key={post.id} post={post} onDeleted={handleDeleted} />)}

          {moreFailed && (
            <p role="alert" className="text-center text-sm text-red-600">
              No pudimos cargar más momentos.
            </p>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loadingMore ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </>
      )}

      {composing && <PostComposer onClose={() => setComposing(false)} onCreated={handleCreated} />}
    </div>
  );
}
