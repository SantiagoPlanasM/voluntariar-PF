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
    expect(notificationHref({ type: 'new_project', data: undefined })).toBeNull();
  });
  it('escapa el id para que no rompa la ruta', () => {
    expect(notificationHref(n('new_enrollment', { project_id: 'a/b' }))).toBe('/ngo/dashboard/project/a%2Fb');
  });
  it('acepta `data` ya parseado (objeto)', () => {
    expect(notificationHref({ type: 'new_follower', data: { follower_id: 'u3' } })).toBe('/volunteer/u3');
  });
});
