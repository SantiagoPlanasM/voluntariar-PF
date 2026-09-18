import { Link } from 'react-router';
import { Sparkles, Users, Check, ArrowRight, Zap, MapPin } from 'lucide-react';
import { User, NGO, Project } from '../../lib/api';

interface FeedSidebarProps {
  user: User | null;
  suggestedNgos: NGO[];
  followingNgoIds: Set<string>;
  onFollowNgo: (ngoId: string) => Promise<void>;
  urgentProjects?: Project[];
}

export function FeedSidebar({
  user,
  suggestedNgos,
  followingNgoIds,
  onFollowNgo,
  urgentProjects = [],
}: FeedSidebarProps) {
  return (
    <div className="space-y-4 w-full">
      {/* ── 1. Mini Perfil de Usuario ────────────────────────────────────── */}
      {user && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-100 flex-shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm ring-2 ring-emerald-100 flex-shrink-0">
                {user.name?.[0] || 'V'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 truncate leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-emerald-600 font-semibold truncate mt-0.5">
                Voluntario activo
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0"
          >
            Mi perfil
          </Link>
        </div>
      )}

      {/* ── 2. Sugerencias de ONGs para vos ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black text-gray-900 tracking-wide uppercase">
              Sugerencias para vos
            </h3>
          </div>
          <Link
            to="/explore"
            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
          >
            Ver todas
          </Link>
        </div>

        {suggestedNgos.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">¡Ya seguís a todas las organizaciones recomendadas!</p>
        ) : (
          <div className="space-y-3">
            {suggestedNgos.map(ngo => {
              const isFollowing = followingNgoIds.has(ngo.id);
              return (
                <div key={ngo.id} className="flex items-center justify-between gap-2.5">
                  <Link
                    to={`/ngo/${ngo.id}`}
                    className="flex items-center gap-2.5 min-w-0 group flex-1"
                  >
                    {ngo.logo ? (
                      <img
                        src={ngo.logo}
                        alt={ngo.name}
                        className="w-9 h-9 rounded-full object-cover border border-gray-100 flex-shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs border border-emerald-100 flex-shrink-0 group-hover:scale-105 transition-transform">
                        {ngo.name[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-600 truncate transition-colors">
                        {ngo.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {ngo.category ? `${ngo.category} • ` : ''}
                        {ngo.followers || 0} seguidores
                      </p>
                    </div>
                  </Link>

                  <button
                    onClick={() => onFollowNgo(ngo.id)}
                    disabled={isFollowing}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0 ${
                      isFollowing
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Siguiendo</span>
                      </>
                    ) : (
                      <span>+ Seguir</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Convocatorias Destacadas / Próximas ───────────────────────── */}
      {urgentProjects.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h3 className="text-xs font-black text-gray-900 tracking-wide uppercase">
                Próximas actividades
              </h3>
            </div>
            <Link
              to="/explore"
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
            >
              Explorar
            </Link>
          </div>

          <div className="space-y-2.5">
            {urgentProjects.slice(0, 3).map(p => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    🌿
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-600 truncate transition-colors leading-snug">
                    {p.title}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {p.ngo_name || 'Organización'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                      {p.type === 'fugaz' ? '⚡ Fugaz' : '🌱 Sostenido'}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                      {p.location?.split(',')[0] || 'Córdoba'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Mini Footer Institucional ─────────────────────────────────── */}
      <footer className="px-2 pt-2 text-[11px] text-gray-400 space-y-2 leading-relaxed">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <Link to="/explore" className="hover:text-gray-600 transition-colors">Descubrir</Link>
          <span>•</span>
          <Link to="/profile" className="hover:text-gray-600 transition-colors">Mi Perfil</Link>
          <span>•</span>
          <Link to="/notifications" className="hover:text-gray-600 transition-colors">Notificaciones</Link>
          <span>•</span>
          <a href="#ayuda" className="hover:text-gray-600 transition-colors">Ayuda</a>
        </div>
        <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
          © 2026 Voluntariar
        </p>
      </footer>
    </div>
  );
}
