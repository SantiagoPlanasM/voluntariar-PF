// src/app/components/NotFoundPage.tsx
//
// Página para una URL que no existe. Antes React Router mostraba su pantalla de desarrollador ("Unexpected
// Application Error! 404 … Hey developer"): no había ruta `*` (D28, §247). Mismo estado que un proyecto o una ONG
// que no existen (LoadError): "Volver" si hay a dónde, si no "Ir al inicio".
import { LoadError } from './LoadError';

export function NotFoundPage() {
  return <LoadError message="No encontramos esta página" home="/" />;
}
