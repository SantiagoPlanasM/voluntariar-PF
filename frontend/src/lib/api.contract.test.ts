// src/lib/api.contract.test.ts — contrato del cliente HTTP: cada método de `api` le pega al endpoint correcto.
//
// TP de Calidad (cobertura del frontend, §209) y AI_RULES regla 10 ("el nombre del campo que manda el frontend
// coincide con el que lee el backend"). Criterio de aceptación (antes de escribir los casos): para cada método,
// `fetch` recibe exactamente BASE + ruta, el método HTTP, el cuerpo JSON con los nombres de campo que lee el backend
// (en español donde corresponde: horas, estado, mensaje, nombre…) y el token si hay sesión. Las subidas (multipart)
// mandan el FormData tal cual y NO fijan Content-Type (si lo fijaran, el servidor no vería los archivos).
// Los tests de pantallas reemplazan `api` por dobles: sin este archivo, ningún test miraba lo que sale por la red.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, BASE } from './api';

type Case = [nombre: string, llamar: () => Promise<unknown>, metodo: string, ruta: string, cuerpo?: unknown];

const CASES: Case[] = [
  // auth
  ['auth.register', () => api.auth.register({ name: 'Ana', email: 'a@b.com', password: 'Password1', role: 'volunteer' }), 'POST', '/auth/register',
    { name: 'Ana', email: 'a@b.com', password: 'Password1', role: 'volunteer' }],
  ['auth.login', () => api.auth.login({ email: 'a@b.com', password: 'x' }), 'POST', '/auth/login', { email: 'a@b.com', password: 'x' }],
  ['auth.me', () => api.auth.me(), 'GET', '/auth/me'],
  ['auth.updateMe', () => api.auth.updateMe({ bio: 'hola' }), 'PUT', '/auth/me', { bio: 'hola' }],
  ['auth.requestDeletion', () => api.auth.requestDeletion(), 'POST', '/auth/me/delete-request'],
  ['auth.deleteAccount', () => api.auth.deleteAccount('tok'), 'POST', '/auth/delete-account', { token: 'tok' }],
  // projects
  ['projects.list sin filtros', () => api.projects.list(), 'GET', '/projects'],
  ['projects.list con filtros', () => api.projects.list({ category: 'Salud', limit: '5' }), 'GET', '/projects?category=Salud&limit=5'],
  ['projects.recommended (por defecto 10)', () => api.projects.recommended(), 'GET', '/projects/recommended?limit=10'],
  ['projects.recommended(8)', () => api.projects.recommended(8), 'GET', '/projects/recommended?limit=8'],
  ['projects.get', () => api.projects.get('p1'), 'GET', '/projects/p1'],
  ['projects.create', () => api.projects.create({ title: 'T' }), 'POST', '/projects', { title: 'T' }],
  ['projects.update', () => api.projects.update('p1', { title: 'T2' }), 'PUT', '/projects/p1', { title: 'T2' }],
  ['projects.delete', () => api.projects.delete('p1'), 'DELETE', '/projects/p1'],
  ['projects.comment', () => api.projects.comment('p1', 'Buenísimo'), 'POST', '/projects/p1/comments', { comment: 'Buenísimo' }],
  ['projects.rate', () => api.projects.rate('p1', 4, 'Bien'), 'POST', '/projects/p1/ratings', { rating: 4, comment: 'Bien' }],
  ['projects.kpis.list', () => api.projects.kpis.list('p1'), 'GET', '/projects/p1/kpis'],
  ['projects.kpis.create', () => api.projects.kpis.create('p1', { nombre: 'Árboles' } as never), 'POST', '/projects/p1/kpis', { nombre: 'Árboles' }],
  ['projects.kpis.update', () => api.projects.kpis.update('p1', 'k1', { valor: 3 } as never), 'PUT', '/projects/p1/kpis/k1', { valor: 3 }],
  ['projects.kpis.delete', () => api.projects.kpis.delete('p1', 'k1'), 'DELETE', '/projects/p1/kpis/k1'],
  // enrollments
  ['enrollments.enroll', () => api.enrollments.enroll('p1', 'Quiero ayudar'), 'POST', '/enrollments', { project_id: 'p1', message: 'Quiero ayudar' }],
  ['enrollments.my', () => api.enrollments.my(), 'GET', '/enrollments/my'],
  ['enrollments.byProject', () => api.enrollments.byProject('p1'), 'GET', '/enrollments/project/p1'],
  ['enrollments.updateStatus', () => api.enrollments.updateStatus('e1', 'approved'), 'PATCH', '/enrollments/e1', { status: 'approved' }],
  ['enrollments.cancel', () => api.enrollments.cancel('e1'), 'DELETE', '/enrollments/e1'],
  ['enrollments.logHours (campo "horas")', () => api.enrollments.logHours('e1', 6), 'PATCH', '/enrollments/e1/horas', { horas: 6 }],
  ['enrollments.scheduleInterview (§261)', () => api.enrollments.scheduleInterview('e1', { date: '2030-03-10', time: '18:00', place: 'Sede' }), 'POST', '/enrollments/e1/entrevista', { date: '2030-03-10', time: '18:00', place: 'Sede' }],
  ['enrollments.updateInterview (§261)', () => api.enrollments.updateInterview('e1', { status: 'cancelled' }), 'PATCH', '/enrollments/e1/entrevista', { status: 'cancelled' }],
  // ngos
  ['ngos.list', () => api.ngos.list(), 'GET', '/ngos'],
  ['ngos.me', () => api.ngos.me(), 'GET', '/ngos/me'],
  ['ngos.get', () => api.ngos.get('n1'), 'GET', '/ngos/n1'],
  ['ngos.update', () => api.ngos.update({ name: 'ONG' }), 'PUT', '/ngos/me', { name: 'ONG' }],
  ['ngos.empleados.list', () => api.ngos.empleados.list('n1'), 'GET', '/ngos/n1/empleados'],
  ['ngos.empleados.create (campos en español)', () => api.ngos.empleados.create('n1', { nombre: 'Ana', apellido: 'Paz', email: 'a@b.com', rol: 'Coordinador' }),
    'POST', '/ngos/n1/empleados', { nombre: 'Ana', apellido: 'Paz', email: 'a@b.com', rol: 'Coordinador' }],
  ['ngos.patrocinios.list', () => api.ngos.patrocinios.list(), 'GET', '/ngos/me/patrocinios'],
  ['ngos.patrocinios.decide (campo "estado")', () => api.ngos.patrocinios.decide('emp1', 'p1', 'aceptado'), 'PATCH', '/ngos/me/patrocinios/emp1/p1', { estado: 'aceptado' }],
  // empresas
  ['empresas.me', () => api.empresas.me(), 'GET', '/empresas/me'],
  ['empresas.get', () => api.empresas.get('emp1'), 'GET', '/empresas/emp1'],
  ['empresas.update', () => api.empresas.update({ name: 'E' }), 'PUT', '/empresas/me', { name: 'E' }],
  ['empresas.dashboard', () => api.empresas.dashboard(), 'GET', '/empresas/me/dashboard'],
  ['empresas.patrocinios.list', () => api.empresas.patrocinios.list(), 'GET', '/empresas/me/patrocinios'],
  ['empresas.patrocinios.propose (campo "mensaje")', () => api.empresas.patrocinios.propose('p1', 'Hola'), 'POST', '/empresas/me/patrocinios', { project_id: 'p1', mensaje: 'Hola' }],
  ['empresas.patrocinios.withdraw', () => api.empresas.patrocinios.withdraw('p1'), 'DELETE', '/empresas/me/patrocinios/p1'],
  // cuenta de Mercado Pago de la ONG (Marketplace, §218): body { code, state } como lo lee routes/mercadopago.js
  ['ngos.mercadopago.get', () => api.ngos.mercadopago.get(), 'GET', '/ngos/me/mercadopago'],
  ['ngos.mercadopago.connect', () => api.ngos.mercadopago.connect(), 'POST', '/ngos/me/mercadopago/connect'],
  ['ngos.mercadopago.callback', () => api.ngos.mercadopago.callback('TG-c', 'st-1'), 'POST', '/ngos/me/mercadopago/callback', { code: 'TG-c', state: 'st-1' }],
  ['ngos.mercadopago.disconnect', () => api.ngos.mercadopago.disconnect(), 'DELETE', '/ngos/me/mercadopago'],
  // donaciones
  ['donaciones.create', () => api.donaciones.create({ project_id: 'p1', amount: 500 }), 'POST', '/donaciones', { project_id: 'p1', amount: 500 }],
  ['donaciones.get sin pago', () => api.donaciones.get('d 1'), 'GET', '/donaciones/d%201'],
  ['donaciones.get con payment_id (concilia)', () => api.donaciones.get('d1', '123'), 'GET', '/donaciones/d1?payment_id=123'],
  // voluntarios
  ['voluntarios.cv.remove', () => api.voluntarios.cv.remove(), 'DELETE', '/voluntarios/me/cv'],
  ['voluntarios.cv.link', () => api.voluntarios.cv.link('u/1'), 'GET', '/voluntarios/u%2F1/cv'],
  ['voluntarios.habilidades.list', () => api.voluntarios.habilidades.list(), 'GET', '/voluntarios/me/habilidades'],
  ['voluntarios.habilidades.update', () => api.voluntarios.habilidades.update([{ habilidad_id: 'h1', nivel: 'alto' }]), 'PUT', '/voluntarios/me/habilidades',
    { habilidades: [{ habilidad_id: 'h1', nivel: 'alto' }] }],
  ['voluntarios.getProfile', () => api.voluntarios.getProfile('u1'), 'GET', '/voluntarios/u1'],
  // catálogo y portada
  ['catalog.habilidades', () => api.catalog.habilidades(), 'GET', '/habilidades'],
  ['stats', () => api.stats(), 'GET', '/stats'],
  // mensajes, notificaciones y FAQs
  ['messages.conversations', () => api.messages.conversations(), 'GET', '/messages/conversations'],
  ['messages.thread', () => api.messages.thread('u1'), 'GET', '/messages/thread/u1'],
  ['messages.send', () => api.messages.send('u1', 'hola'), 'POST', '/messages', { to: 'u1', body: 'hola' }],
  ['messages.markRead', () => api.messages.markRead('u1'), 'PATCH', '/messages/thread/u1/read'],
  ['notifications.list', () => api.notifications.list(), 'GET', '/notifications'],
  ['notifications.markAllRead', () => api.notifications.markAllRead(), 'PATCH', '/notifications/read-all'],
  ['notifications.markRead', () => api.notifications.markRead('n1'), 'PATCH', '/notifications/n1/read'],
  ['faqs.list sin categoría', () => api.faqs.list(), 'GET', '/faqs'],
  ['faqs.list con categoría', () => api.faqs.list('donaciones'), 'GET', '/faqs?categoria=donaciones'],
  ['faqs.ask', () => api.faqs.ask('¿Cómo dono?', 'donaciones'), 'POST', '/faqs/ask', { question: '¿Cómo dono?', categoria: 'donaciones' }],
  // posts (Momentos)
  ['posts.list sin filtros', () => api.posts.list(), 'GET', '/posts'],
  ['posts.list descarta vacíos', () => api.posts.list({ project_id: 'p1', limit: 10, offset: 0, ngo_id: '' } as never), 'GET', '/posts?project_id=p1&limit=10&offset=0'],
  ['posts.get', () => api.posts.get('m1'), 'GET', '/posts/m1'],
  ['posts.eligibleProjects', () => api.posts.eligibleProjects(), 'GET', '/posts/eligible-projects'],
  ['posts.like', () => api.posts.like('m1'), 'POST', '/posts/m1/like'],
  ['posts.unlike', () => api.posts.unlike('m1'), 'DELETE', '/posts/m1/like'],
  ['posts.remove', () => api.posts.remove('m1'), 'DELETE', '/posts/m1'],
  // follows
  ['follows.followNgo', () => api.follows.followNgo('n1'), 'POST', '/follows/ngo/n1'],
  ['follows.unfollowNgo', () => api.follows.unfollowNgo('n1'), 'DELETE', '/follows/ngo/n1'],
  ['follows.myNgos', () => api.follows.myNgos(), 'GET', '/follows/ngo'],
  ['follows.ngoStatus', () => api.follows.ngoStatus('n1'), 'GET', '/follows/ngo/n1/status'],
  ['follows.followProject', () => api.follows.followProject('p1'), 'POST', '/follows/project/p1'],
  ['follows.unfollowProject', () => api.follows.unfollowProject('p1'), 'DELETE', '/follows/project/p1'],
  ['follows.myProjects', () => api.follows.myProjects(), 'GET', '/follows/project'],
  ['follows.projectStatus', () => api.follows.projectStatus('p1'), 'GET', '/follows/project/p1/status'],
  ['follows.feed (por defecto 20 y 0)', () => api.follows.feed(), 'GET', '/follows/feed?limit=20&offset=0'],
  ['follows.feed(30, 60)', () => api.follows.feed(30, 60), 'GET', '/follows/feed?limit=30&offset=60'],
  ['follows.followVolunteer', () => api.follows.followVolunteer('u1'), 'POST', '/follows/volunteer/u1'],
  ['follows.unfollowVolunteer', () => api.follows.unfollowVolunteer('u1'), 'DELETE', '/follows/volunteer/u1'],
  ['follows.myFollowing', () => api.follows.myFollowing(), 'GET', '/follows/volunteer/following'],
  ['follows.myFollowers', () => api.follows.myFollowers(), 'GET', '/follows/volunteer/followers'],
  ['follows.volunteerFollowStatus', () => api.follows.volunteerFollowStatus('u1'), 'GET', '/follows/volunteer/u1/status'],
  ['follows.volunteerFollowers', () => api.follows.volunteerFollowers('u1'), 'GET', '/follows/volunteer/u1/followers'],
  ['follows.volunteerFollowing', () => api.follows.volunteerFollowing('u1'), 'GET', '/follows/volunteer/u1/following'],
];

const UPLOADS: [nombre: string, llamar: (f: FormData) => Promise<unknown>, metodo: string, ruta: string][] = [
  ['auth.uploadPhoto', (f) => api.auth.uploadPhoto(f), 'PUT', '/auth/me/photo'],
  ['voluntarios.cv.upload', (f) => api.voluntarios.cv.upload(f), 'PUT', '/voluntarios/me/cv'],
  ['posts.create', (f) => api.posts.create(f), 'POST', '/posts'],
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('v_token', 'tok-123');
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('api: cada método le pega al endpoint correcto (contrato con el backend)', () => {
  test.each(CASES)('%s', async (_nombre, llamar, metodo, ruta, cuerpo) => {
    // Arrange: fetch devuelve 200 {} y hay sesión (token en localStorage). Act:
    await llamar();
    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}${ruta}`);
    expect(init.method ?? 'GET').toBe(metodo);
    expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(cuerpo);
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-123' });
  });

  test.each(UPLOADS)('%s (multipart): manda el FormData y NO fija Content-Type', async (_nombre, llamar, metodo, ruta) => {
    const form = new FormData();
    form.append('photo', new Blob(['x']), 'x.jpg');
    await llamar(form);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}${ruta}`);
    expect(init.method).toBe(metodo);
    expect(init.body).toBe(form);
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-123' });
  });

  test('sin sesión no manda Authorization (ni en JSON ni en multipart)', async () => {
    localStorage.clear();
    await api.projects.list();
    await api.posts.create(new FormData());
    const [, jsonInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, formInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(jsonInit.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(formInit.headers).toEqual({});
  });

  test('cubre todos los métodos de api (si se agrega uno, hay que sumarlo acá)', () => {
    // Cuenta las funciones hoja del objeto api y las compara con los casos de esta tabla.
    const hojas: string[] = [];
    const recorrer = (o: Record<string, unknown>, pre: string) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'function') hojas.push(pre + k);
        else if (v && typeof v === 'object') recorrer(v as Record<string, unknown>, `${pre}${k}.`);
      }
    };
    recorrer(api as unknown as Record<string, unknown>, '');
    const probados = new Set([...CASES, ...UPLOADS].map(([n]) => n.split(' ')[0]));
    expect(hojas.filter((h) => !probados.has(h))).toEqual([]);
  });
});
