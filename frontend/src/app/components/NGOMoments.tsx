// src/app/components/NGOMoments.tsx
//
// Momentos dentro del panel de la ONG (ruta /ngo/momentos). La ONG puede publicar fotos de sus propios
// voluntariados, y el botón de borrar le aparece en CUALQUIER publicación de sus proyectos (moderación): lo
// decide el servidor con `can_delete`. Sin pestañas: la navegación de la ONG es su barra lateral / inferior.
import { MomentsFeed } from './MomentsFeed';

export function NGOMoments() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-base sm:text-lg font-bold text-gray-900">Momentos</h1>
          <p className="text-xs text-gray-400">Fotos de tus voluntariados. Podés borrar cualquier publicación de tus proyectos.</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6">
        <MomentsFeed />
      </div>
    </div>
  );
}
