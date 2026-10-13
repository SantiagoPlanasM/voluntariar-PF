// src/app/components/PostCard.tsx
//
// Una publicación de Momentos: autor, proyecto, carrusel de fotos, "me gusta" y texto.
//
// - El "me gusta" es OPTIMISTA: la pantalla cambia al instante y, si el servidor falla, se revierte.
//   Mientras hay un pedido en vuelo se ignoran los toques nuevos (evita pedidos cruzados con doble clic).
// - El botón de borrar depende SOLO de `post.can_delete`, que calcula el servidor (el autor, o la ONG dueña
//   del proyecto). El cliente no puede deducirlo: conoce el id del autor pero no quién es dueña del proyecto.
// - `post.author.id` es el id del USUARIO: el enlace al perfil solo existe para voluntarios (`/volunteer/:id`);
//   una ONG no tiene ese perfil, así que no se enlaza.
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Heart, Trash2, MapPin } from 'lucide-react';
import { api, type Post } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { timeAgo, truncateText, userMessage } from '../../lib/format';
import { PhotoCarousel } from './PhotoCarousel';

const CAPTION_PREVIEW_CHARS = 140;

interface Props {
  post: Post;
  /** Se llama con el id de la publicación cuando se borró en el servidor. */
  onDeleted?: (postId: string) => void;
}

export function PostCard({ post, onDeleted }: Props) {
  const { user, openAuthModal } = useAuth();

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const likePending = useRef(false);

  async function toggleLike() {
    if (!user) { openAuthModal('Ingresá para dar me gusta'); return; }
    if (likePending.current) return;
    likePending.current = true;

    const before = { liked, likes };
    const next = !before.liked;
    setLiked(next);
    setLikes(Math.max(0, before.likes + (next ? 1 : -1)));
    setError(null);
    try {
      const res = next ? await api.posts.like(post.id) : await api.posts.unlike(post.id);
      setLiked(res.liked);
      setLikes(res.likes_count);
    } catch {
      setLiked(before.liked);
      setLikes(before.likes);
      setError('No pudimos registrar tu me gusta. Probá de nuevo.');
    } finally {
      likePending.current = false;
    }
  }

  async function handleDelete() {
    if (deleting) return;
    const mine = user?.id === post.author.id;
    const question = mine
      ? '¿Borrar tu publicación? También se eliminan sus fotos y me gusta.'
      : `¿Eliminar esta publicación de ${post.author.name}? También se eliminan sus fotos y me gusta.`;
    if (!window.confirm(question)) return;

    setDeleting(true);
    setError(null);
    try {
      await api.posts.remove(post.id);
      // Queda deshabilitado: el padre saca la tarjeta de la lista.
      onDeleted?.(post.id);
    } catch (err) {
      setError(userMessage(err, 'No pudimos borrar la publicación. Revisá tu conexión y probá de nuevo.'));
      setDeleting(false);
    }
  }

  const author = post.author;
  const avatar = author.avatar
    ? <img src={author.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-200 flex-shrink-0" />
    : (
      <div aria-hidden="true" className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">
        {author.name.trim().charAt(0).toUpperCase()}
      </div>
    );
  const authorName = <span className="text-sm font-bold text-gray-900 truncate">{author.name}</span>;

  const caption = post.caption ? truncateText(post.caption, CAPTION_PREVIEW_CHARS) : null;

  return (
    <article className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
      <header className="flex items-center gap-3 px-4 py-3">
        {author.role === 'volunteer' ? (
          <Link to={`/volunteer/${author.id}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
            {avatar}
            {authorName}
          </Link>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            {avatar}
            {authorName}
            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold flex-shrink-0">ONG</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
          <span>{timeAgo(post.created_at)}</span>
          {post.can_delete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Borrar publicación"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pb-3">
        <Link
          to={`/project/${post.project.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {post.project.title}
        </Link>
      </div>

      <PhotoCarousel photos={post.photos} alt={post.project.title} />

      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLike}
            aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
            aria-pressed={liked}
            className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <Heart className={`w-6 h-6 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
          </button>
          {likes > 0 && <span className="text-sm font-semibold text-gray-800">{`${likes} me gusta`}</span>}
        </div>

        {caption && (
          <div>
            <p className="text-sm text-gray-800 whitespace-pre-line break-words">
              {expanded || !caption.truncated ? post.caption : caption.text}
            </p>
            {caption.truncated && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 mt-1"
              >
                {expanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    </article>
  );
}
