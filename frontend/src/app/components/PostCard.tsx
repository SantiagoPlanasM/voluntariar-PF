// src/app/components/PostCard.tsx
//
// Una publicación (DESIGN.md → Publicación): encabezado con "en <voluntariado>", foto de borde a borde, acciones,
// texto y el vínculo al voluntariado. Antes se llamaba "Momento".
//
// - El "me gusta" es OPTIMISTA: la pantalla cambia al instante y, si el servidor falla, se revierte.
//   Mientras hay un pedido en vuelo se ignoran los toques nuevos (evita pedidos cruzados con doble clic).
// - El botón de borrar depende SOLO de `post.can_delete`, que calcula el servidor (el autor, o la ONG dueña
//   del proyecto). El cliente no puede deducirlo: conoce el id del autor pero no quién es dueña del proyecto.
// - `post.author.id` es el id del USUARIO: el enlace al perfil solo existe para voluntarios (`/volunteer/:id`);
//   una ONG no tiene ese perfil, así que no se enlaza.
// - El vínculo muestra la foto, la ONG y el avance de voluntarios cuando la pantalla le pasa el proyecto
//   completo (`project`); si no, solo el título (la publicación trae únicamente `project.id` y `project.title`).
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Heart, MoreHorizontal, Trash2 } from 'lucide-react';
import { api, type Post, type Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { timeAgo, truncateText, userMessage } from '../../lib/format';
import { PhotoCarousel } from './PhotoCarousel';
import { Avatar } from '../ui/Avatar';
import { Meter, pct } from '../ui/Meter';
import { useConfirm } from '../ui/UiProvider';

const CAPTION_PREVIEW_CHARS = 140;

interface Props {
  post: Post;
  /** El voluntariado completo, si la pantalla ya lo tiene: enriquece el vínculo. */
  project?: Project | null;
  /** Se llama con el id de la publicación cuando se borró en el servidor. */
  onDeleted?: (postId: string) => void;
}

export function PostCard({ post, project, onDeleted }: Props) {
  const { user, openAuthModal } = useAuth();
  const confirm = useConfirm();

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    setMenuOpen(false);
    if (deleting) return;
    const mine = user?.id === post.author.id;
    const ok = await confirm({
      title: mine ? '¿Borrar tu publicación?' : `¿Eliminar la publicación de ${post.author.name}?`,
      body: 'También se eliminan sus fotos y me gusta.',
      confirmLabel: mine ? 'Borrar' : 'Eliminar',
      danger: true,
    });
    if (!ok) return;

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
  const kind = author.role === 'volunteer' ? 'person' : 'org';
  const caption = post.caption ? truncateText(post.caption, CAPTION_PREVIEW_CHARS) : null;

  const nameEl = <span className="text-[15px] font-semibold truncate">{author.name}</span>;
  const thumb = project?.image || post.photos[0]?.thumb_url || post.photos[0]?.url;
  const open = project ? project.status === 'active' && project.current_volunteers < project.volunteers_needed : false;

  return (
    <article className="bg-surface md:rounded-2xl md:border md:border-hairline overflow-hidden">
      <header className="h-14 pl-3 pr-1 flex items-center gap-2.5">
        {author.role === 'volunteer' ? (
          <Link to={`/volunteer/${author.id}`} className="flex-shrink-0"><Avatar src={author.avatar} name={author.name} kind={kind} size={32} /></Link>
        ) : (
          <Avatar src={author.avatar} name={author.name} kind={kind} size={32} />
        )}
        <div className="flex-1 min-w-0 flex flex-col leading-[1.3]">
          {author.role === 'volunteer'
            ? <Link to={`/volunteer/${author.id}`} className="min-w-0 flex">{nameEl}</Link>
            : nameEl}
          <span className="text-[13px] text-ink-muted truncate">
            en <Link to={`/project/${post.project.id}`} className="font-semibold text-ink">{post.project.title}</Link> · <span>{timeAgo(post.created_at)}</span>
          </span>
        </div>
        {post.can_delete && (
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="Más opciones" aria-haspopup="menu" aria-expanded={menuOpen}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-surface-soft">
              <MoreHorizontal size={24} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-1 top-11 z-10 w-52 p-1.5 rounded-xl bg-surface shadow-[var(--elev-popover)] border border-hairline">
                <button type="button" role="menuitem" onClick={handleDelete} disabled={deleting}
                  className="w-full h-11 px-3 rounded-lg text-left text-[15px] font-semibold text-critical hover:bg-surface-soft disabled:opacity-50 inline-flex items-center gap-2">
                  <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />Borrar publicación
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <PhotoCarousel photos={post.photos} alt={post.project.title} />

      <div className="h-12 pl-1 pr-2 flex items-center">
        <button type="button" onClick={toggleLike} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'} aria-pressed={liked}
          className="h-11 px-2.5 inline-flex items-center gap-1.5 text-[15px] font-bold active:scale-95 transition-transform">
          <Heart size={24} strokeWidth={1.75} className={`transition-colors ${liked ? 'fill-like text-like' : 'text-ink'}`} aria-hidden="true" />
          {likes > 0 && <span aria-label={`${likes} me gusta`}>{likes}</span>}
        </button>
      </div>

      {caption && (
        <p className="px-3 text-[15px] leading-[1.45] whitespace-pre-line break-words">
          <span className="font-semibold">{author.name}</span>{' '}
          {expanded || !caption.truncated ? post.caption : caption.text}
          {caption.truncated && (
            <>
              {' '}
              <button type="button" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Ver menos' : 'Ver más'} className="text-ink-muted font-normal">
                {expanded ? 'menos' : 'más'}
              </button>
            </>
          )}
        </p>
      )}

      {error && <p role="alert" className="px-3 pt-1 text-[13px] font-medium text-critical">{error}</p>}

      {/* El vínculo: cada publicación apunta al voluntariado al que pertenece. */}
      <Link to={`/project/${post.project.id}`}
        className="mx-3 mt-3 mb-3 h-[60px] p-2 box-border rounded-xl bg-surface-soft flex items-center gap-2.5 hover:bg-surface-pressed transition-colors">
        {thumb && <img src={thumb} alt="" className="w-11 h-11 rounded-md object-cover flex-shrink-0" />}
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold truncate leading-tight">{post.project.title}</span>
          {project ? (
            <>
              <span className="text-[13px] text-ink-muted truncate leading-tight">
                {project.ngo_name} · {project.current_volunteers} de {project.volunteers_needed} voluntarios
              </span>
              <Meter value={pct(project.current_volunteers, project.volunteers_needed)} tone="people" thin label="Voluntarios" />
            </>
          ) : (
            <span className="text-[13px] text-ink-muted leading-tight">Ver el voluntariado</span>
          )}
        </span>
        {open
          ? <span className="h-8 px-3 rounded-[10px] bg-people text-white text-[13px] font-bold inline-flex items-center flex-shrink-0">Sumarme</span>
          : <ChevronRight size={20} strokeWidth={1.75} className="text-ink-muted flex-shrink-0" aria-hidden="true" />}
      </Link>
    </article>
  );
}
