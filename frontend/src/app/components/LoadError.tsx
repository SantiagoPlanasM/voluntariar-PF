// src/app/components/LoadError.tsx
//
// Estado de error para pantallas que cargan un recurso por id (proyecto, ONG, empresa). Antes hacían
// `navigate(-1)` y `return null` ante cualquier error: abiertas desde un link compartido (sin historial)
// quedaban en blanco, sin mensaje (REVISION F7). Mismo estilo que el error de CompanyDashboard.
import { Link, useNavigate } from 'react-router';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';

/** Qué mostrar según el error: un 404 es "no existe" y un 403 es "no tenés permiso" (reintentar no lo
 *  arregla); un 5xx o la falta de red se pueden reintentar. */
export function describeLoadError(err: unknown, notFound: string): { message: string; retry: boolean } {
  if (err instanceof ApiError) {
    if (err.status === 404) return { message: notFound, retry: false };
    return { message: err.message, retry: err.status >= 500 };
  }
  return { message: 'No pudimos conectarnos con el servidor. Revisá tu conexión.', retry: true };
}

/** Error de carga DENTRO de una pantalla (un listado, una sección de un panel), con "Reintentar". Antes
 *  esos errores se tragaban y se mostraba el estado vacío ("Sin notificaciones", "Todavía no hay
 *  patrocinios"), como si no hubiera datos (REVISION F9).
 *
 *  `role="alert"` propio, en el contenedor (antes cada pantalla lo envolvía en un `<div role="alert">` y las
 *  demás no se anunciaban). En el contenedor y no en el `<p>`: el aviso aparece y desaparece entero, y así el
 *  "Reintentar" queda dentro de la región (el lector lee "…Revisá tu conexión. Reintentar"). Quien lo use no
 *  tiene que envolverlo en otro `alert` (quedarían dos anidados). */
export function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="bg-white rounded-2xl border border-gray-100 text-center py-10 px-4">
      <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>
  );
}

interface Props {
  message: string;
  onRetry?: () => void;
  /** A dónde ir si no hay página anterior (p. ej. el link se abrió en una pestaña nueva). */
  home: string;
}

export function LoadError({ message, onRetry, home }: Props) {
  const navigate = useNavigate();
  // React Router guarda en history.state el índice de la entrada: 0 = no hay a dónde volver.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

  // role="alert": la pantalla entera pasa de "cargando" a este error sin que cambie el foco; sin el rol, un
  // lector de pantalla no se entera de que la carga falló. Mismo criterio que InlineError (en la tarjeta).
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div role="alert" className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 px-6 max-w-sm w-full">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex items-center justify-center gap-2">
          {onRetry && (
            <button onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          )}
          {canGoBack ? (
            <button onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
          ) : (
            <Link to={home}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors">
              Ir al inicio
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
