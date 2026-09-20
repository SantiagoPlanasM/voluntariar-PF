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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data as T;
}

export const api = {
  auth: {
    register: (b: { name: string; email: string; password: string; role: string }) =>
      req<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(b) }),
    login: (b: { email: string; password: string }) =>
      req<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(b) }),
    me: () => req<{ user: User }>('/auth/me'),
    updateMe: (b: { name?: string; bio?: string; location?: string; avatar?: string }) =>
      req<{ user: User }>('/auth/me', { method: 'PUT', body: JSON.stringify(b) }),
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
      req<{ comment: Comment }>(`/projects/${id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) }),
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
    me: () => req<{ ngo: NGO; projects: Project[]; stats: NGOStats; pending_enrollments: EnrollmentWithVolunteer[] }>('/ngos/me'),
    get: (id: string) => req<{ ngo: NGO; projects: Project[] }>(`/ngos/${id}`),
    update: (b: Partial<NGO>) => req<{ ngo: NGO }>('/ngos/me', { method: 'PUT', body: JSON.stringify(b) }),
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
    patrocinios: {
      list: () => req<{ patrocinios: Patrocinio[] }>('/empresas/me/patrocinios'),
      propose: (project_id: string, mensaje?: string) =>
        req<{ message: string }>('/empresas/me/patrocinios', { method: 'POST', body: JSON.stringify({ project_id, mensaje }) }),
      withdraw: (projectId: string) =>
        req<{ message: string }>(`/empresas/me/patrocinios/${projectId}`, { method: 'DELETE' }),
    },
  },
  voluntarios: {
    habilidades: {
      list: () => req<{ habilidades: VolunteerSkill[] }>('/voluntarios/me/habilidades'),
      update: (habilidades: { habilidad_id: string; nivel?: string }[]) =>
        req<{ habilidades: VolunteerSkill[] }>('/voluntarios/me/habilidades', {
          method: 'PUT', body: JSON.stringify({ habilidades }),
        }),
    },
  },
  catalog: {
    habilidades: () => req<{ habilidades: SkillCatalogItem[] }>('/habilidades'),
  },
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
  },
  faqs: {
    list: (categoria?: string) => req<{ faqs: Faq[] }>(`/faqs${categoria ? `?categoria=${categoria}` : ''}`),
    ask: (question: string, categoria?: string) =>
      req<AskFaqResponse>('/faqs/ask', { method: 'POST', body: JSON.stringify({ question, categoria }) }),
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
  followers: number; ngo_name?: string; ngo_logo?: string; created_at?: string;
  latitude?: number | null; longitude?: number | null;
  modality?: 'presencial' | 'remoto' | 'hibrido';
  recommendation_score?: number; recommendation_reasons?: string[];
}
export interface FeedProject extends Project {
  avg_rating?: number;
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

export interface ProjectDetail extends Project {
  comments: AppComment[]; ratings: Rating[]; kpis: KPI[];
  avg_rating: number; my_enrollment?: Enrollment | null;
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
export interface EnrollmentWithVolunteer extends Enrollment {
  volunteer_name: string; volunteer_email: string;
  volunteer_avatar?: string; volunteer_bio?: string;
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
  rating: number; comment?: string; created_at: string;
}
export interface AppNotification {
  id: string; type: string; title: string;
  body?: string; read: boolean | number; created_at: string;
}
