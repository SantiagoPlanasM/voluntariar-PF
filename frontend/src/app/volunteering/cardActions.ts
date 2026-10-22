// Qué botones se muestran en una tarjeta o en la barra fija del voluntariado (DESIGN.md → Estados de los
// botones). Antes estas reglas estaban repartidas dentro del JSX de cada pantalla; acá son una función pura
// que se prueba sin dibujar nada.
import type { Project, UserRole } from '../../lib/api';

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type JoinAction =
  | { kind: 'join' }
  | { kind: 'pending' }
  | { kind: 'accepted' }
  | { kind: 'rejected' }
  | { kind: 'full' }
  | { kind: 'past' }
  | { kind: 'hidden' };

export type DonateAction =
  | { kind: 'donate' }
  | { kind: 'goal-met' }
  | { kind: 'hidden' };

type ProjectLike = Pick<Project, 'status' | 'volunteers_needed' | 'current_volunteers' | 'funding_goal' | 'current_funding'>
  & { accepts_donations?: boolean };

export function cardActions(
  p: ProjectLike,
  enrollment: EnrollmentStatus | null | undefined,
  viewer: UserRole | null,
): { join: JoinAction; donate: DonateAction } {
  const past = p.status === 'completed';
  const full = p.volunteers_needed > 0 && p.current_volunteers >= p.volunteers_needed;

  let join: JoinAction;
  if (viewer === 'ngo' || viewer === 'company') join = { kind: 'hidden' };
  else if (enrollment === 'pending') join = { kind: 'pending' };
  else if (enrollment === 'approved') join = { kind: 'accepted' };
  else if (enrollment === 'rejected') join = { kind: 'rejected' };
  else if (past) join = { kind: 'past' };
  else if (full) join = { kind: 'full' };
  else join = { kind: 'join' };

  // Una ONG que no vinculó Mercado Pago no recibe donaciones (§218). El listado todavía no trae el dato:
  // `accepts_donations === false` solo llega en el detalle, y ahí se decide. Sin meta de dinero no se ofrece.
  let donate: DonateAction;
  const hasMoneyGoal = (p.funding_goal || 0) > 0 || (p.current_funding || 0) > 0;
  if (viewer === 'ngo' || past || p.accepts_donations === false || !hasMoneyGoal) donate = { kind: 'hidden' };
  else if ((p.funding_goal || 0) > 0 && p.current_funding >= p.funding_goal) donate = { kind: 'goal-met' };
  else donate = { kind: 'donate' };

  return { join, donate };
}
