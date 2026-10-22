// src/app/components/MomentsPage.tsx
//
// Publicaciones (ruta /momentos, dentro de Root). Antes se llamaba "Momentos". Es pública: un visitante puede
// mirar, y se le ofrece ingresar para dar "me gusta" y publicar. `?crear=1` (el botón "Crear" de la barra) abre
// el compositor. Una ONG tiene su propia pantalla (/ngo/momentos, dentro de su panel) y se la redirige ahí.
import { Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/AuthContext';
import { MomentsFeed } from './MomentsFeed';
import { Button } from '../ui/Button';

export function MomentsPage() {
  const { user, initializing, openAuthModal } = useAuth();
  const [params, setParams] = useSearchParams();
  const clearCompose = () => { const next = new URLSearchParams(params); next.delete('crear'); setParams(next, { replace: true }); };

  // Mientras se verifica el token guardado todavía no se sabe quién mira: no se muestra nada para no
  // parpadear (ni cargar el feed como anónimo, ni ofrecer ingresar a alguien que ya tiene sesión).
  if (initializing) return <div className="min-h-screen" />;

  if (user?.role === 'ngo') return <Navigate to="/ngo/momentos" replace />;

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-[520px] mx-auto px-3 md:px-0 md:pt-8 flex flex-col gap-3 md:gap-6">
        <h1 className="sr-only">Publicaciones</h1>

        {!user && (
          <div className="rounded-2xl bg-surface border border-hairline p-4 flex items-center justify-between gap-3">
            <p className="text-[15px] leading-snug">Ingresá para dar me gusta y publicar tus propias fotos.</p>
            <Button variant="primary" onClick={() => openAuthModal()} className="flex-shrink-0">Ingresar</Button>
          </div>
        )}

        <MomentsFeed autoCompose={params.get('crear') === '1'} onAutoComposed={clearCompose} />
      </div>
    </div>
  );
}
