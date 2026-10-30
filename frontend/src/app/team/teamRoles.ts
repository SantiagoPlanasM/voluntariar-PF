// Los roles del equipo de la ONG (§294) como se muestran: una sola fuente para la pantalla del dueño, la de
// Configuración del voluntario y el panel del miembro. Qué puede cada uno lo decide el backend (lib/ngoAccess).
import type { TeamRole } from '../../lib/api';

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  coordinator: 'Coordinación',
  communicator: 'Comunicación',
};

export const TEAM_ROLE_HINT: Record<TeamRole, string> = {
  coordinator: 'Ve y responde postulaciones, abre CV, agenda entrevistas y carga horas.',
  communicator: 'Publica Momentos de los voluntariados.',
};

export const TEAM_ROLES: TeamRole[] = ['coordinator', 'communicator'];
