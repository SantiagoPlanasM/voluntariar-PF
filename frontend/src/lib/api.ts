// src/lib/api.ts
export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const getToken = () => localStorage.getItem('v_token');
export const setToken = (t: string) => localStorage.setItem('v_token', t);
export const removeToken = () => localStorage.removeItem('v_token');
export const getUser = (): User | null => {
  try { return JSON.parse(localStorage.getItem('v_user') || 'null'); } catch { return null; }
};
export const setUser = (u: User) => localStorage.setItem('v_user', JSON.stringify(u));
export const removeUser = () => localStorage.removeItem('v_user');

/** Error de la API con el código HTTP. AuthContext lo usa para cerrar la sesión SOLO si el token no vale
 *  (401/404) y no ante un 502 de Render "dormido" o un 500 (REVISION F4). Un fallo de red no es ApiError:
 *  sigue siendo el TypeError de fetch (lo maneja userMessage en format.ts). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Lee el cuerpo como JSON y lanza ApiError si la respuesta no es OK o si no es JSON. Un proxy puede
 *  devolver una página HTML (502/503/504): antes `await res.json()` reventaba y el usuario veía
 *  "Unexpected token '<' ..." (REVISION F5). */
async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const fallback = [502, 503, 504].includes(res.status)
      ? 'El servidor no está disponible en este momento. Probá de nuevo en un rato.'
      : 'Error del servidor';
    throw new ApiError(data?.error || fallback, res.status);
  }
  if (data === undefined) throw new ApiError('Respuesta inesperada del servidor', res.status);
  return data as T;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  return readJson<T>(res);
}

// Subida multipart (fotos). NO fija Content-Type a propósito: el navegador lo pone él, con el "boundary"
// del multipart. `req()` fuerza application/json, y con eso el servidor nunca vería los archivos.
async function upload<T>(path: string, form: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return readJson<T>(res);
}

export const api = {
  auth: {
    register: (b: { name: string; email: string; password: string; role: string }) =>
      req<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(b) }),
    login: (b: { email: string; password: string }) =>
      req<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(b) }),
    // `profile` es la fila del rol; del voluntario solo se lee `has_cv` (§165). Puede ser null.
    me: () => req<{ user: User; profile?: { has_cv?: boolean } | null }>('/auth/me'),
    updateMe: (b: { name?: string; bio?: string; location?: string; avatar?: string }) =>
      req<{ user: User }>('/auth/me', { method: 'PUT', body: JSON.stringify(b) }),
    // Foto de perfil (multipart, campo `photo`): va a users.avatar y, para ONG y empresa, también al logo (§162).
    uploadPhoto: (form: FormData) => upload<{ user: User }>('/auth/me/photo', form, 'PUT'),
    // Borrar la propia cuenta (§177–§178): el pedido manda un email con un link; el link lleva a /cuenta/borrar.
    requestDeletion: () => req<{ sent: boolean }>('/auth/me/delete-request', { method: 'POST' }),
    deleteAccount: (token: string) =>
      req<{ deleted: boolean }>('/auth/delete-account', { method: 'POST', body: JSON.stringify({ token }) }),
  },
  projects: {
    list: (p?: Record<string, string>) => {
      const qs = p ? '?' + new URLSearchParams(p).toString() : '';
      return req<{ projects: Project[] }>(`/projects${qs}`);
    },
    recommended: (limit = 10) =>
      req<{ recommendations: Project[]; based_on_history: boolean }>(`/projects/recommended?limit=${limit}`),
    get: (id: string) => req<{ project: ProjectDetail }>(`/projects/${id}`),
    create: (b: Partial<Project>) =>
      req<{ project: Project }>('/projects', { method: 'POST', body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Project>) =>
      req<{ project: Project }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete: (id: string) =>
      req<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }),
    comment: (id: string, comment: string) =>
      req<{ comment: AppComment }>(`/projects/${id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) }),
    rate: (id: string, rating: number, comment?: string) =>
      req<{ message: string }>(`/projects/${id}/ratings`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
    kpis: {
      list: (projectId: string) => req<{ kpis: KPI[] }>(`/projects/${projectId}/kpis`),
      create: (projectId: string, b: Partial<KPI>) =>
        req<{ kpi: KPI }>(`/projects/${projectId}/kpis`, { method: 'POST', body: JSON.stringify(b) }),
      update: (projectId: string, kpiId: string, b: Partial<KPI>) =>
        req<{ kpi: KPI }>(`/projects/${projectId}/kpis/${kpiId}`, { method: 'PUT', body: JSON.stringify(b) }),
      delete: (projectId: string, kpiId: string) =>
        req<{ message: string }>(`/projects/${projectId}/kpis/${kpiId}`, { method: 'DELETE' }),
    },
  },
  enrollments: {
    enroll: (project_id: string, message?: string) =>
      req<{ enrollment: Enrollment; message: string }>('/enrollments', { method: 'POST', body: JSON.stringify({ project_id, message }) }),
    my: () => req<{ enrollments: EnrollmentWithProject[] }>('/enrollments/my'),
    byProject: (id: string) => req<{ enrollments: EnrollmentWithVolunteer[] }>(`/enrollments/project/${id}`),
    updateStatus: (id: string, status: 'approved' | 'rejected') =>
      req<{ message: string }>(`/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    cancel: (id: string) => req<{ message: string }>(`/enrollments/${id}`, { method: 'DELETE' }),
    logHours: (id: string, horas: number) =>
      req<{ message: string; horas: number }>(`/enrollments/${id}/horas`, { method: 'PATCH', body: JSON.stringify({ horas }) }),
  },
  ngos: {
    list: () => req<{ ngos: NGO[] }>('/ngos'),
    me: () => req<{ ngo: NGO; projects: Project[]; stats: NGOStats; pending_enrollments: PendingEnrollment[] }>('/ngos/me'),
    get: (id: string) => req<{ ngo: NGO; projects: Project[] }>(`/ngos/${id}`),
    update: (b: Partial<NGO>) => req<{ ngo: NGO }>('/ngos/me', { method: 'PUT', body: JSON.stringify(b) }),
    // Equipo de la ONG (antes NGOEmpleados hacía fetch directo: AI_RULES regla 4, PROJECT_ANALYSIS.md §98).
    empleados: {
      list: (ngoId: string) => req<{ empleados: Empleado[] }>(`/ngos/${ngoId}/empleados`),
      create: (ngoId: string, b: { nombre: string; apellido: string; email: string; rol: string }) =>
        req<{ empleado: Empleado }>(`/ngos/${ngoId}/empleados`, { method: 'POST', body: JSON.stringify(b) }),
    },
    // Cuenta de Mercado Pago de la ONG (Marketplace, §216/§218). `connect` devuelve la URL de Mercado Pago; `callback`
    // lo llama la pantalla /ngo/mercadopago/vuelta con lo que trae la URL.
    mercadopago: {
      get: () => req<MpAccountState>('/ngos/me/mercadopago'),
      connect: () => req<{ authorization_url: string }>('/ngos/me/mercadopago/connect', { method: 'POST' }),
      callback: (code: string, state: string) =>
        req<{ account: MpAccount }>('/ngos/me/mercadopago/callback', { method: 'POST', body: JSON.stringify({ code, state }) }),
      disconnect: () => req<{ disconnected: boolean }>('/ngos/me/mercadopago', { method: 'DELETE' }),
    },
    patrocinios: {
      list: () => req<{ patrocinios: Patrocinio[] }>('/ngos/me/patrocinios'),
      decide: (empresaId: string, projectId: string, estado: 'aceptado' | 'rechazado') =>
        req<{ message: string }>(`/ngos/me/patrocinios/${empresaId}/${projectId}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
    },
  },
  empresas: {
    me: () => req<{ empresa: Empresa }>('/empresas/me'),
    get: (id: string) => req<{ empresa: Empresa }>(`/empresas/${id}`),
    update: (b: Partial<Empresa>) => req<{ empresa: Empresa }>('/empresas/me', { method: 'PUT', body: JSON.stringify(b) }),
    dashboard: () => req<CompanyDashboard>('/empresas/me/dashboard'),
    patrocinios: {
      list: () => req<{ patrocinios: Patrocinio[] }>('/empresas/me/patrocinios'),
      propose: (project_id: string, mensaje?: string) =>
        req<{ message: string }>('/empresas/me/patrocinios', { method: 'POST', body: JSON.stringify({ project_id, mensaje }) }),
      withdraw: (projectId: string) =>
        req<{ message: string }>(`/empresas/me/patrocinios/${projectId}`, { method: 'DELETE' }),
    },
  },
  // Donaciones con Mercado Pago (§170–§172). `get` con `paymentId` concilia con Mercado Pago (lo que trae la URL de vuelta).
  donaciones: {
    create: (b: { project_id: string; amount: number }) =>
      req<{ donation_id: string; checkout_url: string }>('/donaciones', { method: 'POST', body: JSON.stringify(b) }),
    get: (id: string, paymentId?: string) =>
      req<{ donation: Donation }>(`/donaciones/${encodeURIComponent(id)}${paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : ''}`),
  },
  voluntarios: {
    // CV (§165–§166): PDF privado; `link` devuelve un link firmado que vence a los 10 minutos (pedirlo cada vez).
    cv: {
      upload: (form: FormData) => upload<{ has_cv: boolean }>('/voluntarios/me/cv', form, 'PUT'),
      remove: () => req<{ has_cv: boolean }>('/voluntarios/me/cv', { method: 'DELETE' }),
      link: (userId: string) => req<{ url: string; expires_at: string }>(`/voluntarios/${encodeURIComponent(userId)}/cv`),
    },
    habilidades: {
      list: () => req<{ habilidades: VolunteerSkill[] }>('/voluntarios/me/habilidades'),
      update: (habilidades: { habilidad_id: string; nivel?: string }[]) =>
        req<{ habilidades: VolunteerSkill[] }>('/voluntarios/me/habilidades', {
          method: 'PUT', body: JSON.stringify({ habilidades }),
        }),
    },
    getProfile: (userId: string) =>
      req<VolunteerProfileData>(`/voluntarios/${userId}`),
  },
  catalog: {
    habilidades: () => req<{ habilidades: SkillCatalogItem[] }>('/habilidades'),
  },
  // Números de la portada (GET /api/stats, público; §129).
  stats: () => req<PublicStats>('/stats'),
  messages: {
    conversations: () => req<{ conversations: Conversation[] }>('/messages/conversations'),
    thread: (userId: string) => req<{ messages: ChatMessage[]; other: Conversation['user'] }>(`/messages/thread/${userId}`),
    send: (to: string, body: string) =>
      req<{ message: ChatMessage }>('/messages', { method: 'POST', body: JSON.stringify({ to, body }) }),
    markRead: (userId: string) => req(`/messages/thread/${userId}/read`, { method: 'PATCH' }),
  },
  notifications: {
    list: () => req<{ notifications: AppNotification[]; unread: number }>('/notifications'),
    markAllRead: () => req('/notifications/read-all', { method: 'PATCH' }),
    markRead: (id: string) => req(`/notifications/${id}/read`, { method: 'PATCH' }),
  },
  faqs: {
    list: (categoria?: string) => req<{ faqs: Faq[] }>(`/faqs${categoria ? `?categoria=${categoria}` : ''}`),
    ask: (question: string, categoria?: string) =>
      req<AskFaqResponse>('/faqs/ask', { method: 'POST', body: JSON.stringify({ question, categoria }) }),
  },
  // Momentos: publicaciones con fotos de voluntariados (backend: routes/posts.js, PROJECT_ANALYSIS §43)
  posts: {
    list: (p: PostFilters & { limit?: number; offset?: number } = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      const qs = q.toString();
      return req<PostsPage>(`/posts${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => req<{ post: Post }>(`/posts/${id}`),
    eligibleProjects: () => req<{ projects: EligibleProject[] }>('/posts/eligible-projects'),
    create: (form: FormData) => upload<{ post: Post }>('/posts', form),
    like: (id: string) => req<{ liked: boolean; likes_count: number }>(`/posts/${id}/like`, { method: 'POST' }),
    unlike: (id: string) => req<{ liked: boolean; likes_count: number }>(`/posts/${id}/like`, { method: 'DELETE' }),
    remove: (id: string) => req<{ message: string }>(`/posts/${id}`, { method: 'DELETE' }),
  },

  follows: {
    followNgo: (ngoId: string) =>
      req<{ following: boolean; followers: number; message: string }>(`/follows/ngo/${ngoId}`, { method: 'POST' }),
    unfollowNgo: (ngoId: string) =>
      req<{ following: boolean; followers: number; message: string }>(`/follows/ngo/${ngoId}`, { method: 'DELETE' }),
    myNgos: () => req<{ ngos: NGO[] }>('/follows/ngo'),
    ngoStatus: (ngoId: string) => req<{ following: boolean }>(`/follows/ngo/${ngoId}/status`),

    followProject: (projectId: string) =>
      req<{ following: boolean; followers: number; message: string }>(`/follows/project/${projectId}`, { method: 'POST' }),
    unfollowProject: (projectId: string) =>
      req<{ following: boolean; followers: number; message: string }>(`/follows/project/${projectId}`, { method: 'DELETE' }),
    myProjects: () => req<{ projects: Project[] }>('/follows/project'),
    projectStatus: (projectId: string) => req<{ following: boolean }>(`/follows/project/${projectId}/status`),

    feed: (limit?: number, offset?: number) =>
      req<{ projects: FeedProject[]; total: number }>(`/follows/feed?limit=${limit || 20}&offset=${offset || 0}`),

    followVolunteer: (userId: string) =>
      req<{ following: boolean; followers: number; message: string }>(`/follows/volunteer/${userId}`, { method: 'POST' }),
    unfollowVolunteer: (userId: string) =>
      req<{ following: boolean; followers: number; message: string }>(`/follows/volunteer/${userId}`, { method: 'DELETE' }),
    myFollowing: () => req<{ volunteers: VolunteerPublic[] }>('/follows/volunteer/following'),
    myFollowers: () => req<{ volunteers: VolunteerPublic[] }>('/follows/volunteer/followers'),
    volunteerFollowStatus: (userId: string) => req<{ following: boolean }>(`/follows/volunteer/${userId}/status`),
    volunteerFollowers: (userId: string) => req<{ volunteers: VolunteerPublic[] }>(`/follows/volunteer/${userId}/followers`),
    volunteerFollowing: (userId: string) => req<{ volunteers: VolunteerPublic[] }>(`/follows/volunteer/${userId}/following`),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────
export type UserRole = 'volunteer' | 'ngo' | 'company';

export interface User {
  id: string; name: string; email: string;
  role: UserRole; avatar?: string; bio?: string; location?: string;
}
export interface Project {
  id: string; ngo_id: string; title: string; description: string;
  full_description?: string; image?: string; category: string;
  location: string; duration?: string; type: 'fugaz' | 'sostenido';
  status: 'active' | 'completed'; volunteers_needed: number;
  current_volunteers: number; funding_goal: number; current_funding: number;
  cost_per_person: number; hours_per_week?: number;
  roles_needed: string[]; requirements?: string[];
  followers: number; ngo_name?: string; ngo_logo?: string; ngo_followers?: number; created_at?: string;
  latitude?: number | null; longitude?: number | null;
  modality?: 'presencial' | 'remoto' | 'hibrido';
  recommendation_score?: number; recommendation_reasons?: string[];
  avg_rating?: number | null; ratings_count?: number;
}
export interface FeedProject extends Project {
  avg_rating?: number | null;
  ratings_count?: number;
  ratings?: Rating[];
  comments_count?: number;
  recent_comments?: AppComment[];
  my_enrollment_status?: 'pending' | 'approved' | 'rejected' | null;
  follow_source?: 'ngo_follow' | 'project_follow' | 'both';
  follow_label?: string;
}
export interface KPI {
  id: string; project_id: string; nombre: string;
  descripcion?: string; valor?: number;
  tipo_valor: string; unidad?: string; fecha?: string;
  created_at: string;
}

export interface PublicStats {
  active_projects: number; volunteers: number; ngos: number;
}

export interface SkillCatalogItem {
  id: string; nombre: string; descripcion?: string;
}
export interface VolunteerSkill {
  id: string; nombre: string; descripcion?: string;
  nivel: 'basico' | 'intermedio' | 'avanzado';
}

export interface ChatMessage {
  id: string; sender_id: string; receiver_id: string; body: string;
  read: boolean | 0 | 1; created_at: string;
  sender_name?: string; sender_avatar?: string;
}
export interface Conversation {
  user: { id: string; name: string; avatar?: string; role: string };
  last_message: string; last_at: string | null; last_from_me: boolean; unread: number;
}

/** GET /ngos/me/mercadopago (§216). Nunca trae tokens. `origin: 'manual'` = cargada con el script, sin vencimiento. */
export interface MpAccount {
  mp_user_id: string; status: 'active' | 'needs_reconnect'; origin: 'oauth' | 'manual'; expires_at: string | null;
}
export interface MpAccountState { account: MpAccount | null; oauth_available: boolean }
export interface ProjectDetail extends Project {
  comments: AppComment[]; ratings: Rating[]; kpis: KPI[];
  avg_rating: number; my_enrollment?: Enrollment | null;
  /** true solo si quien pide es la ONG dueña (lo calcula GET /projects/:id). */
  can_manage?: boolean;
  /** §217: true solo si la ONG tiene su cuenta de Mercado Pago vinculada y activa (si no, no recibe donaciones). */
  accepts_donations?: boolean;
}
export interface Enrollment {
  id: string; user_id: string; project_id: string;
  status: 'pending' | 'approved' | 'rejected'; message?: string;
  hours_logged?: number; created_at: string;
}
export interface EnrollmentWithProject extends Enrollment {
  title: string; image?: string; category: string; type: string;
  location: string; project_status: string; ngo_name: string; ngo_logo?: string;
}
/** GET /donaciones/:id (§171). `status` lo decide el backend tras consultar a Mercado Pago. */
export interface Donation {
  id: string; status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number; currency: string; project_id: string | null; project_title: string | null;
}
export interface EnrollmentWithVolunteer extends Enrollment {
  volunteer_name: string; volunteer_email: string;
  volunteer_avatar?: string; volunteer_bio?: string;
  /** GET /enrollments/project/:id (§168): true si la ONG puede abrir el CV (inscripción pendiente o aprobada y hay CV). */
  has_cv?: boolean;
}
/** Solicitud pendiente del panel de la ONG (GET /ngos/me): trae además el título del proyecto. */
export interface PendingEnrollment extends EnrollmentWithVolunteer {
  project_title: string;
}
export interface Empleado {
  id: string; nombre: string; apellido: string;
  email: string; rol: string; foto_perfil?: string;
}
export interface NGO {
  id: string; user_id: string; name: string; logo?: string;
  cover_image?: string; category?: string; description?: string;
  mission?: string; founded?: string; location?: string; followers: number;
}
export interface Empresa {
  id: string; user_id: string; name: string; logo?: string;
  cover_image?: string; category?: string; description?: string;
  mission?: string; industry?: string; location?: string; followers: number;
}
export interface Faq {
  id: string; categoria?: string; pregunta: string; respuesta: string;
}
export interface AskFaqResponse {
  matched: boolean;
  best?: Faq;
  alternatives?: Faq[];
  suggestions?: { id: string; pregunta: string }[];
}
export interface Patrocinio {
  empresa_id: string; project_id: string;
  estado: 'propuesto' | 'aceptado' | 'rechazado';
  mensaje?: string; aporte: number; created_at: string; updated_at: string;
  project_title: string; project_image?: string; project_status?: string;
  // Presentes cuando lo devuelve GET /api/empresas/me/patrocinios (vista empresa)
  ngo_id?: string; ngo_name?: string; ngo_logo?: string;
  // Presentes cuando lo devuelve GET /api/ngos/me/patrocinios (vista ONG)
  empresa_name?: string; empresa_logo?: string; empresa_industry?: string;
}
// Momentos (publicaciones con fotos). `created_at` es siempre ISO 8601 UTC; `can_delete` lo calcula el
// servidor según quién mira (el autor, o la ONG dueña del proyecto).
export interface PostPhoto { id: string; url: string; thumb_url: string; width: number | null; height: number | null }
export interface Post {
  id: string; caption: string | null; created_at: string;
  author: { id: string; name: string; avatar: string | null; role: 'volunteer' | 'ngo' };
  project: { id: string; title: string };
  photos: PostPhoto[]; likes_count: number; liked_by_me: boolean; can_delete: boolean;
}
export interface PostsPage { posts: Post[]; has_more: boolean }
/** Filtros de GET /api/posts. `ngo_id` es el id de la tabla `ngos` (el de `NGO.id`, no el del usuario de la ONG):
 *  trae las publicaciones de los proyectos de esa ONG, sea quien sea el autor. */
export interface PostFilters { project_id?: string; user_id?: string; ngo_id?: string }
export interface EligibleProject { id: string; title: string }

// GET /api/empresas/me/dashboard — KPIs de patrocinio de la empresa (backend: routes/empresas.js).
// `impact` mide el impacto de los PROYECTOS con patrocinio aceptado, no de personas de la empresa.
export interface CompanyDashboardProject {
  project_id: string; title: string; image: string | null; project_status: string;
  volunteers_needed: number; current_volunteers: number;
  ngo_id: string; ngo_name: string; ngo_logo: string | null;
  // Mismos valores que Patrocinio['estado']
  sponsorship_status: Patrocinio['estado'];
  decided_at: string;
  // Horas verificadas y voluntarios aprobados del proyecto (se muestran solo si está aceptado)
  hours_logged: number; volunteers_count: number;
}
export interface CompanyDashboard {
  stats: { sponsored_projects: number; pending_proposals: number; rejected_proposals: number };
  impact: { total_hours: number; volunteers_reached: number };
  projects: CompanyDashboardProject[];
}
export interface NGOStats {
  total_projects: number; active_projects: number;
  completed_projects: number; total_volunteers: number;
  total_funding: number; pending_enrollments: number;
}
export interface AppComment {
  id: string; user_id: string; user_name: string;
  user_avatar?: string; comment: string; created_at: string;
  is_participant?: boolean | number;
}
export interface Rating {
  id: string; user_id: string; user_name: string;
  user_avatar?: string | null; // §133: lo mandan el detalle y el feed (null si no tiene foto)
  rating: number; comment?: string; created_at: string;
}
export interface AppNotification {
  id: string; type: string; title: string;
  body?: string; read: boolean | number; created_at: string;
  /** JSON con los ids de lo que la originó (`project_id`, `follower_id`…). Llega como texto en SQLite y Postgres. */
  data?: string | Record<string, unknown> | null;
}

export interface VolunteerPublic {
  user_id: string; name: string; avatar?: string; bio?: string;
  location?: string; nombre?: string; apellido?: string;
  foto_perfil?: string; ubicacion?: string; followers: number;
}

export interface VolunteerProfileVolunteer {
  id: string; name: string; avatar?: string; bio?: string;
  location?: string; nombre?: string; apellido?: string;
  foto_perfil?: string; banner?: string; descripcion?: string;
  followers: number; following_count: number; created_at?: string;
}

export interface VolunteerParticipation {
  enrollment_id: string; status: string; horas_realizadas: number;
  project_id: string; titulo: string; project_image?: string;
  project_status: string; ubicacion: string; tipo: string;
  ngo_name: string; ngo_logo?: string;
}

export interface VolunteerProfileData {
  volunteer: VolunteerProfileVolunteer;
  habilidades: VolunteerSkill[];
  stats: { total_enrollments: number; approved_enrollments: number; total_horas: number };
  participaciones: VolunteerParticipation[];
}

/** Una dirección encontrada por el buscador del alta de voluntariados. */
export interface GeocodeResult { label: string; lat: number; lng: number }

export const GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
const GEOCODE_ERROR = 'No pudimos buscar la dirección. Marcá el lugar tocando el mapa.';

/** Busca una dirección en Nominatim (OpenStreetMap) para marcarla en el mapa. Es un servicio externo: no pasa por
 *  `req()` (ni BASE ni el token de la sesión, que no se le manda a un tercero). Su política pide como máximo un pedido
 *  por segundo y nada de autocompletar: se llama solo al tocar "Buscar en el mapa" (LocationPicker lo espacia). */
export async function geocodeAddress(q: string): Promise<GeocodeResult[]> {
  const qs = new URLSearchParams({ q: q.trim(), format: 'jsonv2', countrycodes: 'ar', limit: '5', 'accept-language': 'es' });
  let data: unknown;
  try {
    const res = await fetch(`${GEOCODER_URL}?${qs}`);
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch {
    throw new Error(GEOCODE_ERROR);
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((d: { display_name?: string; lat?: string; lon?: string }) =>
      ({ label: String(d.display_name ?? ''), lat: Number(d.lat), lng: Number(d.lon) }))
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
