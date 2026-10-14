// src/app/components/MomentsGrid.tsx
//
// Grilla de miniaturas de Momentos para la galería de un proyecto o el perfil de una persona (filtros
// `project_id` / `user_id`). Al tocar una miniatura se abre la publicación completa (PostCard) en un modal,
// con me gusta y borrar según `can_delete`. Paginación y recarga con las mismas reglas que MomentsFeed:
// offset = lo que devolvió el servidor, deduplicar por id, recargar si cambia el id del usuario.
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api, type Post } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { PostCard } from './PostCard';
import { Modal } from './Modal';

interface Props {
  filters: { project_id?: string; user_id?: string };
  pageSize?: number;
}

export function MomentsGrid({ filters, pageSize = 9 }: Props) {
  const { user } = useAuth();
  const projectId = filters.project_id;
  const userId = filters.user_id;
  const viewerId = user?.id ?? null;

  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [open, setOpen] = useState<Post | null>(null);
  const offset = useRef(0);
  const generation = useRef(0);
  const moreInFlight = useRef(false);

  const params = useCallback(() => {
    const p: { project_id?: string; user_id?: string } = {};
    if (projectId) p.project_id = projectId;
    if (userId) p.user_id = userId;
    return p;
  }, [projectId, userId]);

  const loadFirst = useCallback(async () => {
    const mine = ++generation.current;
    moreInFlight.current = false;
    setStatus('loading');
    setMoreFailed(false);
    setOpen(null);
    try {
      const res = await api.posts.list({ ...params(), limit: pageSize, offset: 0 });
      if (mine !== generation.current) return;
      setPosts(res.posts);
      offset.current = res.posts.length;
      setHasMore(res.has_more);
      setStatus('ready');
    } catch {
      if (mine === generation.current) setStatus('error');
    }
  }, [params, pageSize]);

  useEffect(() => {
    loadFirst();
    return () => { generation.current++; };
  }, [loadFirst, viewerId]);

  async function loadMore() {
    if (moreInFlight.current) return;
    moreInFlight.current = true;
    const mine = generation.current;
    setMoreFailed(false);
    try {
      const res = await api.posts.list({ ...params(), limit: pageSize, offset: offset.current });
      if (mine !== generation.current) return;
      offset.current += res.posts.length;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
      });
      setHasMore(res.has_more);
    } catch {
      if (mine === generation.current) setMoreFailed(true);
    } finally {
      if (mine === generation.current) moreInFlight.current = false;
    }
  }

  function handleDeleted(id: string) {
    setOpen(null);
    if (!posts.some((p) => p.id === id)) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    offset.current = Math.max(0, offset.current - 1);
  }

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Cargando momentos" className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((i) => <div key={i} aria-hidden="true" className="aspect-square bg-gray-200 rounded-lg animate-pulse" />)}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="text-sm space-y-1">
        <p role="alert" className="text-red-600">No pudimos cargar los momentos.</p>
        <button type="button" onClick={loadFirst} className="font-semibold text-emerald-700 hover:underline">Reintentar</button>
      </div>
    );
  }
  if (posts.length === 0) return <p className="text-sm text-gray-400">Todavía no hay momentos.</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            aria-label={`Ver momento de ${p.author.name}`}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
          >
            {p.photos[0] && <img src={p.photos[0].thumb_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
            {p.photos.length > 1 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold">
                {`${p.photos.length} fotos`}
              </span>
            )}
          </button>
        ))}
      </div>

      {moreFailed && <p role="alert" className="text-sm text-red-600">No pudimos cargar más momentos.</p>}
      {hasMore && (
        <button type="button" onClick={loadMore} className="w-full py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Ver más
        </button>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)} label="Momento" closeOnOverlay={false}
          overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl"
        >
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Cerrar"
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
            <PostCard post={open} onDeleted={handleDeleted} />
        </Modal>
      )}
    </div>
  );
}
