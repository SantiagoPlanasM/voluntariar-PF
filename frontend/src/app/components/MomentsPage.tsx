// src/app/components/MomentsPage.tsx
//
// Pestaña "Momentos" del feed (ruta /momentos, dentro de Root: con la barra lateral / inferior del voluntario).
// Es pública: un visitante puede mirar, y se le ofrece ingresar para dar "me gusta" y compartir.
// Una ONG tiene su propia pantalla (/ngo/momentos, dentro de su panel) y se la redirige ahí.
import { Navigate } from 'react-router';
import { useAuth } from '../../lib/AuthContext';
import { FeedTabs } from './FeedTabs';
import { MomentsFeed } from './MomentsFeed';

export function MomentsPage() {
  const { user, initializing, openAuthModal } = useAuth();

  // Mientras se verifica el token guardado todavía no se sabe quién mira: no se muestra nada para no
  // parpadear (ni cargar el feed como anónimo, ni ofrecer ingresar a alguien que ya tiene sesión).
  if (initializing) return <div className="min-h-screen bg-gray-50 md:ml-60" />;

  if (user?.role === 'ngo') return <Navigate to="/ngo/momentos" replace />;

  // "Proyectos" apunta a la pantalla de proyectos de cada rol: el visitante a "/", el voluntario a su feed y la
  // empresa a Explorar (el feed personalizado de /feed es de un voluntario).
  const projectsHref = !user ? '/' : user.role === 'company' ? '/explore' : '/feed';

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60 pb-16">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <h1 className="text-base sm:text-lg font-black text-gray-900">Momentos</h1>
          <p className="text-xs text-gray-400">Fotos de las jornadas de voluntariado</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <FeedTabs active="moments" projectsHref={projectsHref} momentsHref="/momentos" />

        {!user && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-emerald-900">Ingresá para dar me gusta y compartir tus propios momentos.</p>
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex-shrink-0"
            >
              Ingresar
            </button>
          </div>
        )}

        <MomentsFeed />
      </div>
    </div>
  );
}
