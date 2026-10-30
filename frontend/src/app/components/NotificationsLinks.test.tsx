// A dónde lleva cada notificación (lo que guarda el backend en `data` según el tipo).
import { describe, it, expect } from 'vitest';
import { notificationHref } from './NotificationsScreen';

const n = (type: string, data?: unknown) => ({ type, data: data === undefined ? null : (typeof data === 'string' ? data : JSON.stringify(data)) });

describe('notificationHref', () => {
  it('una solicitud de inscripción lleva al voluntariado en el panel de la ONG', () => {
    expect(notificationHref(n('new_enrollment', { project_id: 'p1', user_id: 'u1' }))).toBe('/ngo/dashboard/project/p1');
  });
  it('una donación recibida lleva al voluntariado que la recibió', () => {
    expect(notificationHref(n('donation_received', { project_id: 'p2', donation_id: 'd1' }))).toBe('/ngo/dashboard/project/p2');
  });
  it('una propuesta de patrocinio lleva a Patrocinios', () => {
    expect(notificationHref(n('sponsor_proposal', { project_id: 'p1', empresa_id: 'e1' }))).toBe('/ngo/patrocinios');
  });
  it('vincular Mercado Pago de nuevo lleva a esa sección del perfil', () => {
    expect(notificationHref(n('mp_reconnect_needed', { ngo_id: 'n1' }))).toBe('/ngo/profile#mercadopago');
  });
  it('la respuesta a una postulación lleva a Mis voluntariados', () => {
    expect(notificationHref(n('enrollment_approved', { project_id: 'p1' }))).toBe('/participation');
    expect(notificationHref(n('enrollment_rejected', { project_id: 'p1' }))).toBe('/participation');
  });
  it('un seguidor nuevo lleva a su perfil', () => {
    expect(notificationHref(n('new_follower', { follower_id: 'u9' }))).toBe('/volunteer/u9');
  });
  it('un patrocinio aceptado lleva al voluntariado; uno rechazado, al perfil de la empresa', () => {
    expect(notificationHref(n('sponsor_accepted', { project_id: 'p1' }))).toBe('/project/p1');
    expect(notificationHref(n('sponsor_rejected', { project_id: 'p1' }))).toBe('/company/profile');
  });
  it('sin ids o con datos rotos no inventa un destino', () => {
    expect(notificationHref(n('new_follower', {}))).toBeNull();
    expect(notificationHref(n('new_enrollment', 'no es json'))).toBe('/ngo/dashboard');
    expect(notificationHref(n('algo_nuevo', { project_id: 'p1' }))).toBeNull();
    // §296: la invitación al equipo se acepta en Configuración; al dueño, quien se sumó lo lleva a su equipo.
    expect(notificationHref(n('team_invite', { ngo_id: 'ngo-1' }))).toBe('/settings');
    expect(notificationHref(n('team_joined', { ngo_id: 'ngo-1', user_id: 'u1' }))).toBe('/ngo/equipo');
    expect(notificationHref({ type: 'new_project', data: undefined })).toBeNull();
  });
  it('escapa el id para que no rompa la ruta', () => {
    expect(notificationHref(n('new_enrollment', { project_id: 'a/b' }))).toBe('/ngo/dashboard/project/a%2Fb');
  });
  it('acepta `data` ya parseado (objeto)', () => {
    expect(notificationHref({ type: 'new_follower', data: { follower_id: 'u3' } })).toBe('/volunteer/u3');
  });
});

// §270: los avisos de entrevistas (§261) y del acuerdo de patrocinio (§264) no llevaban a ningún lado.
describe('notificationHref: entrevistas y acuerdo de patrocinio', () => {
  it('las entrevistas llevan a Mis voluntariados', () => {
    for (const t of ['interview_scheduled', 'interview_rescheduled', 'interview_cancelled'])
      expect(notificationHref(n(t, { project_id: 'p1', enrollment_id: 'e1' }))).toBe('/participation');
  });
  it('los del acuerdo llevan a la pantalla del acuerdo, la de la ONG o la de la empresa según quién lo recibe', () => {
    for (const t of ['sponsorship_message', 'sponsorship_accepted_by_other', 'sponsorship_closed', 'sponsorship_rejected']) {
      const data = { project_id: 'p1', empresa_id: 'e/1' };
      expect(notificationHref(n(t, data), 'ngo')).toBe('/ngo/patrocinios/e%2F1/p1');
      expect(notificationHref(n(t, data), 'company')).toBe('/company/patrocinios/e%2F1/p1');
    }
  });
  it('sin los ids o sin el rol, a la lista de patrocinios de cada uno (o a ningún lado)', () => {
    expect(notificationHref(n('sponsorship_message', { project_id: 'p1' }), 'ngo')).toBe('/ngo/patrocinios');
    expect(notificationHref(n('sponsorship_message', { project_id: 'p1' }), 'company')).toBe('/company/profile');
    expect(notificationHref(n('sponsorship_message', { project_id: 'p1', empresa_id: 'e1' }))).toBeNull();
  });
});
