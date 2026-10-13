// src/lib/sponsorship.ts
//
// Etiquetas y colores de los 3 estados de un patrocinio (Patrocinio['estado']).
//
// Estos dos mapas ya existen copiados, idénticos, en NGOPatrocinios.tsx y
// CompanyOwnProfile.tsx. Se dejan ahí sin tocar (no era parte de la tarea del
// Dashboard de Empresa), pero cualquier pantalla nueva debe importar de acá en
// vez de sumar una tercera copia; migrar esas dos es un cambio trivial.
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
