// Los datos que muestra el detalle de un voluntariado (ProjectDetails.tsx), sin la pantalla. Sacados en §299 para
// bajar la complejidad del componente (PLAN_CIERRE §2) y probarlos aislados; el comportamiento es el mismo.
import type { ProjectDetail, User } from '../../lib/api';
import { hasBadWord } from '../../lib/badWords';

export function projectFacts(project: ProjectDetail, role: User['role'] | null | undefined) {
  const hasFunding = (project.funding_goal || 0) > 0;
  const active = project.status === 'active';
  const fugaz = project.type === 'fugaz';
  const weekly = project.hours_per_week ? `${project.hours_per_week} h por semana` : 'No especificado';
  return {
    hasFunding,
    active,
    hoursLabel: fugaz ? (project.duration || 'Sin especificar') : weekly,
    avg: project.avg_rating ? Number(project.avg_rating).toFixed(1).replace('.', ',') : null,
    spotsLeft: Math.max(0, (project.volunteers_needed || 0) - (project.current_volunteers || 0)),
    goalMet: hasFunding && project.current_funding >= project.funding_goal,
    canDonate: active && role !== 'ngo' && !!project.accepts_donations,
    mapsHref: project.latitude != null && project.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}` : null,
  };
}

/** El error de un comentario ('' si se puede mandar): como el backend, mínimo 3 caracteres y sin palabras no permitidas. */
export function commentError(text: string): string {
  const c = text.trim();
  if (c.length < 3) return 'Muy corto';
  if (hasBadWord(c)) return 'Contiene palabras no permitidas';
  return '';
}
