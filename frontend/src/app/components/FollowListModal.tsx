// Lista "Seguidores"/"Siguiendo" de un voluntario, en un <Modal>. La usan el perfil propio (VolunteerProfile)
// y el público (VolunteerPublicProfile): antes cada uno tenía su copia del mismo JSX (PROJECT_ANALYSIS §105).
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Users, X } from 'lucide-react';
import { VolunteerPublic } from '../../lib/api';
import { userMessage } from '../../lib/format';
import { Modal } from './Modal';
import { InlineError } from './LoadError';

export type FollowListMode = 'followers' | 'following';

interface Props {
  mode: FollowListMode;
  /** Pide la lista al abrir. Se lee una sola vez por modo (el padre puede pasar una función nueva en cada render). */
  load: (mode: FollowListMode) => Promise<{ volunteers: VolunteerPublic[] }>;
  /** Texto de la lista vacía para cada modo ("Todavía no tenés…" en el propio, "Todavía no tiene…" en el público). */
  emptyText: Record<FollowListMode, string>;
  /** Id del usuario logueado: su fila lleva a /profile y dice "Tú". */
  meId?: string;
  onClose: () => void;
}

export function FollowListModal({ mode, load, emptyText, meId, onClose }: Props) {
  const titleId = useId();
  const [list, setList] = useState<VolunteerPublic[]>([]);
  const [loading, setLoading] = useState(true);
  // Un error de carga se muestra como error con "Reintentar", no como lista vacía (REVISION S1).
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Si se cierra antes de que llegue la respuesta, se descarta.
    let cancelled = false;
    setLoading(true);
    setError('');
    load(mode)
      .then(r => { if (!cancelled) setList(r.volunteers); })
      .catch((e) => { if (!cancelled) setError(userMessage(e, 'No pudimos cargar la lista. Revisá tu conexión.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, attempt]); // sin `load`: ver su comentario en Props

  return (
    <Modal onClose={onClose} labelledBy={titleId}
      overlayClassName="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 id={titleId} className="font-bold text-gray-900">
            {mode === 'followers' ? 'Seguidores' : 'Siguiendo'}
          </h3>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          ) : error ? (
            <InlineError message={error} onRetry={() => setAttempt(a => a + 1)} />
          ) : list.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{emptyText[mode]}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {list.map(vol => (
                <Link
                  key={vol.user_id}
                  to={vol.user_id === meId ? '/profile' : `/volunteer/${vol.user_id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {(vol.foto_perfil || vol.avatar) ? (
                    <img src={vol.foto_perfil || vol.avatar} alt={vol.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm ring-2 ring-gray-100">
                      {vol.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{vol.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {vol.ubicacion || vol.location || 'Argentina'} · {vol.followers || 0} seguidores
                    </p>
                  </div>
                  {vol.user_id === meId && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Tú</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
    </Modal>
  );
}
