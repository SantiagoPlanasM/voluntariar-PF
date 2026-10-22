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
import { Camera, ImageOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { api, type Post, type PostFilters } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';

interface Props {
  /** Filtros del servidor (galería de un proyecto / de una persona / de los proyectos de una ONG). */
  filters?: PostFilters;
  /** Mostrar el botón para publicar (solo lo ven voluntarios y ONGs). Por defecto sí. */
  showComposer?: boolean;
  pageSize?: number;
  /** Abrir el compositor al montar (el botón "Crear" de la barra llega a /momentos?crear=1). */
  autoCompose?: boolean;
  /** Se avisa cuando el compositor se abrió por `autoCompose`, para que quien lo pidió limpie el pedido. */
  onAutoComposed?: () => void;
}

function mergeById(current: Post[], incoming: Post[]): Post[] {
  const seen = new Set(current.map((p) => p.id));
  const fresh: Post[] = [];
  for (const p of incoming) {
    if (!seen.has(p.id)) { seen.add(p.id); fresh.push(p); }
  }
  return fresh.length ? [...current, ...fresh] : current;
}

export function MomentsFeed({ filters, showComposer = true, pageSize = 12, autoCompose = false, onAutoComposed }: Props) {
  const { user } = useAuth();
  const projectId = filters?.project_id;
  const userId = filters?.user_id;
  const ngoId = filters?.ngo_id;
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
    const params: PostFilters = {};
    if (projectId) params.project_id = projectId;
    if (userId) params.user_id = userId;
    if (ngoId) params.ngo_id = ngoId;
    return params;
  }, [projectId, userId, ngoId]);

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
    // Una publicación que no corresponde a esta vista (otro proyecto / otro autor) no se agrega. Con `ngo_id` no
    // se puede comprobar (el post no trae la ONG del proyecto): hoy ese filtro solo lo usa NGOMoments, y ahí la
    // ONG solo puede publicar en sus propios proyectos (eligible-projects), así que se agrega.
    if (projectId && post.project.id !== projectId) return;
    if (userId && post.author.id !== userId) return;
    if (posts.some((p) => p.id === post.id)) return;
    setPosts((prev) => [post, ...prev]);
    offsetRef.current += 1;
  }

  const canPost = showComposer && (user?.role === 'volunteer' || user?.role === 'ngo');

  useEffect(() => {
    if (autoCompose && canPost) {
      setComposing(true);
      onAutoComposed?.();
    }
  }, [autoCompose, canPost]);

  return (
    <div className="flex flex-col gap-3 md:gap-6">
      {canPost && (
        <Button variant="primary" onClick={() => setComposing(true)} block className="!h-12">
          <Camera size={18} strokeWidth={1.75} aria-hidden="true" />
          Nueva publicación
        </Button>
      )}

      {status === 'loading' && (
        <div role="status" aria-label="Cargando publicaciones" className="flex flex-col gap-3 md:gap-6">
          {[1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="bg-surface md:rounded-2xl md:border md:border-hairline overflow-hidden">
              <div className="flex items-center gap-2.5 h-14 px-3">
                <div className="w-8 h-8 rounded-full skeleton" />
                <div className="h-4 w-1/3 rounded skeleton" />
              </div>
              <div className="aspect-[4/5] skeleton" />
              <div className="p-3"><div className="h-3 w-1/2 rounded skeleton" /></div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-2xl bg-surface border border-hairline p-8 text-center flex flex-col items-center gap-3">
          <p role="alert" className="text-[15px] text-ink-soft">
            No pudimos cargar las publicaciones. Revisá tu conexión y probá de nuevo.
          </p>
          <Button variant="primary" onClick={loadFirst}>Reintentar</Button>
        </div>
      )}

      {status === 'ready' && posts.length === 0 && (
        <div className="rounded-2xl bg-surface border border-hairline p-8 text-center flex flex-col items-center gap-2">
          <ImageOff size={28} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
          <p className="text-[15px] font-semibold">Todavía no hay publicaciones</p>
          <p className="text-[13px] text-ink-muted max-w-xs">
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
            <p role="alert" className="text-center text-[13px] font-medium text-critical">
              No pudimos cargar más publicaciones.
            </p>
          )}
          {hasMore && (
            <Button variant="secondary" onClick={loadMore} busy={loadingMore} busyLabel="Cargando…" block>
              Ver más
            </Button>
          )}
        </>
      )}

      {composing && <PostComposer onClose={() => setComposing(false)} onCreated={handleCreated} />}
    </div>
  );
}
