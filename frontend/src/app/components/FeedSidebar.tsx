// Columna derecha del Inicio en escritorio (DESIGN.md → Tablet y desktop): quién sos, voluntariados cerca y
// ONGs para seguir. Puramente presentacional: recibe todo por props.
import { Link } from 'react-router';
import { Check, RefreshCw } from 'lucide-react';
import { User, NGO, Project } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface FeedSidebarProps {
  user: User | null;
  suggestedNgos: NGO[];
  followingNgoIds: Set<string>;
  onFollowNgo: (ngoId: string) => Promise<void>;
  urgentProjects?: Project[];
  /** Si no se pudieron cargar las sugerencias: se muestra esto (con "Reintentar") en vez de
   *  "¡Ya seguís a todas…!", que se leería como un dato (REVISION S1). */
  suggestionsError?: string;
  onRetrySuggestions?: () => void;
  /** Error al seguir una ONG: se muestra debajo de esa ONG (REVISION S6). */
  followError?: FollowNgoError | null;
  /** ONGs con un "Seguir" en vuelo: su botón queda bloqueado (antes un doble clic mandaba dos pedidos). */
  sendingNgoIds?: ReadonlySet<string>;
}

export interface FollowNgoError { ngoId: string; message: string }

const NO_IDS: ReadonlySet<string> = new Set();

export function FeedSidebar({
  user,
  suggestedNgos,
  followingNgoIds,
  onFollowNgo,
  urgentProjects = [],
  suggestionsError = '',
  onRetrySuggestions,
  followError = null,
  sendingNgoIds = NO_IDS,
}: FeedSidebarProps) {
  return (
    <div className="flex flex-col gap-6 w-full">
      {user && (
        <Link to="/profile" className="flex items-center gap-3 min-w-0">
          <Avatar src={user.avatar} name={user.name} size={44} />
          <span className="min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">{user.name}</span>
            <span className="text-[13px] text-ink-muted truncate">Ver mi perfil</span>
          </span>
        </Link>
      )}

      {urgentProjects.length > 0 && (
        <section aria-labelledby="side-cerca" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3 id="side-cerca" className="text-[15px] font-bold">Próximas actividades</h3>
            <Link to="/explore" className="text-[13px] font-semibold">Ver todo</Link>
          </div>
          {urgentProjects.slice(0, 3).map(p => (
            <Link key={p.id} to={`/project/${p.id}`} className="flex items-center gap-3 group">
              {p.image
                ? <img src={p.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-surface-soft" />
                : <span className="w-14 h-14 rounded-xl bg-surface-soft flex-shrink-0" aria-hidden="true" />}
              <span className="min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold leading-tight line-clamp-2 group-hover:underline underline-offset-2">{p.title}</span>
                <span className="text-[13px] text-ink-muted truncate">{p.location?.split(',')[0] || p.ngo_name}</span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <section aria-labelledby="side-ongs" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 id="side-ongs" className="text-[15px] font-bold">ONGs para seguir</h3>
        </div>

        {suggestionsError ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-soft">{suggestionsError}</p>
            {onRetrySuggestions && (
              <button type="button" onClick={onRetrySuggestions} className="self-start inline-flex items-center gap-1.5 h-10 text-[13px] font-semibold">
                <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" /> Reintentar
              </button>
            )}
          </div>
        ) : suggestedNgos.length === 0 ? (
          <p className="text-[13px] text-ink-muted">¡Ya seguís a todas las organizaciones recomendadas!</p>
        ) : (
          suggestedNgos.map(ngo => {
            const isFollowing = followingNgoIds.has(ngo.id);
            return (
              <div key={ngo.id}>
                <div className="flex items-center gap-3">
                  <Link to={`/ngo/${ngo.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar src={ngo.logo} name={ngo.name} kind="org" size={44} />
                    <span className="min-w-0 flex flex-col">
                      <span className="text-[15px] font-semibold truncate">{ngo.name}</span>
                      <span className="text-[13px] text-ink-muted truncate">{ngo.followers || 0} seguidores</span>
                    </span>
                  </Link>
                  {isFollowing ? (
                    <span className="h-8 px-3 rounded-[10px] bg-surface-soft text-[13px] font-bold inline-flex items-center gap-1 flex-shrink-0">
                      <Check size={14} strokeWidth={2.25} aria-hidden="true" />Siguiendo
                    </span>
                  ) : (
                    <Button variant="primary" onClick={() => onFollowNgo(ngo.id)} disabled={sendingNgoIds.has(ngo.id)}
                      className="!h-8 !px-3.5 !text-[13px] flex-shrink-0">
                      Seguir
                    </Button>
                  )}
                </div>
                {followError?.ngoId === ngo.id && (
                  <p role="alert" className="mt-1 text-[13px] font-medium text-critical">{followError.message}</p>
                )}
              </div>
            );
          })
        )}
      </section>

      <footer className="text-xs text-ink-muted leading-relaxed flex flex-col gap-1">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link to="/explore" className="hover:text-ink">Explorar</Link>
          <Link to="/profile" className="hover:text-ink">Mi perfil</Link>
          <Link to="/notifications" className="hover:text-ink">Notificaciones</Link>
          <Link to="/privacidad" className="hover:text-ink">Privacidad y términos</Link>
        </div>
        <p>© 2026 VoluntariAR</p>
      </footer>
    </div>
  );
}
