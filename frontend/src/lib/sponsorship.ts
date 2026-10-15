// src/lib/sponsorship.ts
//
// Etiquetas y colores de los 3 estados de un patrocinio (Patrocinio['estado']).
//
// Única fuente: la usan CompanyDashboard.tsx, CompanyOwnProfile.tsx y
// NGOPatrocinios.tsx (las dos últimas tenían copias idénticas hasta REVISION S7).
// Cualquier pantalla nueva importa de acá en vez de copiar los mapas.
import type { Patrocinio } from './api';

export type SponsorshipState = Patrocinio['estado'];

export const SPONSORSHIP_BADGE: Record<SponsorshipState, string> = {
  propuesto: 'bg-amber-50 text-amber-700',
  aceptado:  'bg-emerald-50 text-emerald-700',
  rechazado: 'bg-red-50 text-red-600',
};

export const SPONSORSHIP_LABEL: Record<SponsorshipState, string> = {
  propuesto: 'Pendiente',
  aceptado:  'Aceptado',
  rechazado: 'Rechazado',
};
