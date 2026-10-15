// src/app/components/NGOMoments.tsx
//
// Momentos dentro del panel de la ONG (ruta /ngo/momentos). La ONG puede publicar fotos de sus propios
// voluntariados, y el botón de borrar le aparece en CUALQUIER publicación de sus proyectos (moderación): lo
// decide el servidor con `can_delete`. Sin pestañas: la navegación de la ONG es su barra lateral / inferior.
//
// Solo las publicaciones de los proyectos de ESTA ONG (REVISION S2: antes mostraba el feed de toda la
// plataforma bajo "Fotos de tus voluntariados"). El id de la ONG (tabla `ngos`, distinto del id del usuario)
// sale de `api.ngos.me()`, el mismo pedido que usan NGODashboard y NGOOwnProfile. Hasta tenerlo NO se
// renderiza MomentsFeed: sin filtro pediría el feed general.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { userMessage } from '../../lib/format';
import { MomentsFeed } from './MomentsFeed';
import { InlineError } from './LoadError';

export function NGOMoments() {
  const [ngoId, setNgoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sin descarte de respuestas viejas: el id de la ONG de quien está logueado no cambia entre pedidos, y
  // "Reintentar" solo aparece cuando el pedido anterior ya terminó. Si llega el id, manda sobre un error.
  const loadNgo = useCallback(async () => {
    setError(null);
    try {
      const { ngo } = await api.ngos.me();
      setNgoId(ngo.id);
    } catch (err) {
      setError(userMessage(err, 'No pudimos cargar los momentos de tu organización. Revisá tu conexión.'));
    }
  }, []);

  useEffect(() => { loadNgo(); }, [loadNgo]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-base sm:text-lg font-bold text-gray-900">Momentos</h1>
          <p className="text-xs text-gray-400">Fotos de tus voluntariados. Podés borrar cualquier publicación de tus proyectos.</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6">
        {ngoId ? (
          <MomentsFeed filters={{ ngo_id: ngoId }} />
        ) : error ? (
          <InlineError message={error} onRetry={loadNgo} />
        ) : (
          <div role="status" aria-label="Cargando momentos" className="flex justify-center py-12">
            <div aria-hidden="true" className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
