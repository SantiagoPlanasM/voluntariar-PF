// src/app/components/RequireRole.tsx
//
// Guarda de rol para los paneles (/ngo/* y /company/*). Deuda conocida resuelta con OK del usuario
// (PROJECT_ANALYSIS.md §97): antes cualquiera podía abrirlos y veía un panel vacío (el backend rechazaba los datos).
// Es solo experiencia de uso: la autorización real está en el backend (AI_RULES regla 15).
import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

type Role = 'volunteer' | 'ngo' | 'company';

/** A dónde va cada rol cuando entra (lo mismo que hace el login en AuthModal). */
export function homeFor(role: string): string {
  if (role === 'ngo') return '/ngo/dashboard';
  if (role === 'company') return '/company/profile';
  return '/feed';
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, initializing, openAuthModal } = useAuth();

  // Sin sesión: se abre el login (el modal vive en el contexto, así que sigue abierto en el inicio). Pero NO si
  // en este panel ya había sesión: eso es un "cerrar sesión" (logout + navigate('/')), no alguien que quiere entrar.
  const hadUser = useRef(false);
  if (user) hadUser.current = true;
  useEffect(() => {
    if (!initializing && !user && !hadUser.current) openAuthModal('Iniciá sesión para entrar a tu panel', 'login');
    // Solo cuando cambia la sesión: no reabrir el modal en cada render.
  }, [initializing, user]);

  if (initializing) return (
    <div role="status" aria-label="Verificando sesión" className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
