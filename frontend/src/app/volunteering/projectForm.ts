// La lógica del formulario de alta y edición de voluntariados (CreateVoluntariado.tsx), sin la pantalla. Sacada en
// §298 para bajar la complejidad del componente (PLAN_CIERRE §2) y poder probarla aislada; el comportamiento es el mismo.
import type { Project, ProjectDetail } from '../../lib/api';

export const CATEGORIES = ['Medio Ambiente', 'Educación', 'Salud', 'Animales', 'Alimentación', 'Tecnología', 'Arte y Cultura', 'Deportes'];
const ROLE_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-/]{2,40}$/;
const REQ_RE  = /^.{3,100}$/;

export type Form = {
  title: string; description: string; full_description: string; category: string; location: string;
  modality: 'presencial' | 'remoto' | 'hibrido'; type: 'fugaz' | 'sostenido';
  duration: string; hours_per_week: string; volunteers_needed: string; funding_goal: string; cost_per_person: string;
};
export type Coords = { lat: number; lng: number } | null;

export const EMPTY_FORM: Form = {
  title: '', description: '', full_description: '',
  category: 'Medio Ambiente', location: '',
  modality: 'presencial', type: 'fugaz',
  duration: '', hours_per_week: '',
  volunteers_needed: '', funding_goal: '', cost_per_person: '',
};

// Lo que se manda al backend, igual para crear y para editar. Al editar, "sin valor" es null (el PUT es parcial:
// un campo que no viene se conserva, así que para borrar la descripción completa o el lugar hay que mandar null).
export function toBody(form: Form, roles: string[], requirements: string[], coords: Coords, editing: boolean): Partial<Project> {
  const none = editing ? null : undefined;
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    full_description: form.full_description.trim() || (none as undefined),
    category: form.category,
    location: form.modality === 'remoto' && !form.location.trim() ? 'Remoto' : form.location.trim(),
    modality: form.modality,
    // Remoto no tiene lugar: si había un punto marcado antes de cambiar la modalidad, no se manda.
    latitude: form.modality !== 'remoto' && coords ? coords.lat : none,
    longitude: form.modality !== 'remoto' && coords ? coords.lng : none,
    type: form.type,
    duration: form.type === 'fugaz' ? form.duration.trim() : undefined,
    hours_per_week: form.type === 'sostenido' ? Number.parseInt(form.hours_per_week) : undefined,
    volunteers_needed: Number.parseInt(form.volunteers_needed),
    funding_goal: Number.parseFloat(form.funding_goal) || 0,
    cost_per_person: Number.parseFloat(form.cost_per_person) || 0,
    roles_needed: roles,
    requirements,
  };
}

// El formulario precargado con un voluntariado ya publicado (editar, §255).
export function fromProject(p: ProjectDetail): { form: Form; roles: string[]; requirements: string[]; coords: Coords } {
  const num = (n: number | null | undefined) => (n ? String(n) : '');
  return {
    form: {
      title: p.title ?? '', description: p.description ?? '', full_description: p.full_description ?? '',
      category: p.category ?? '', location: p.location ?? '',
      modality: p.modality ?? 'presencial', type: p.type,
      duration: p.duration ?? '', hours_per_week: num(p.hours_per_week),
      volunteers_needed: num(p.volunteers_needed), funding_goal: num(p.funding_goal), cost_per_person: num(p.cost_per_person),
    },
    roles: p.roles_needed ?? [],
    requirements: p.requirements ?? [],
    coords: p.latitude != null && p.longitude != null ? { lat: Number(p.latitude), lng: Number(p.longitude) } : null,
  };
}

// Solo los campos que cambiaron respecto de lo que se cargó (para no reescribir lo que la ONG no tocó).
export function changedFields(body: Partial<Project>, initial: Partial<Project>): Partial<Project> {
  return Object.fromEntries(
    Object.entries(body).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(initial[k as keyof Project])),
  ) as Partial<Project>;
}

function validateBasics(form: Form, e: Record<string, string>) {
  // Topes iguales a los del backend (§143); maxLength los impone al escribir, esto cubre lo pegado (§145).
  const title = form.title.trim();
  if (title.length < 3) e.title = 'Mínimo 3 caracteres';
  else if (title.length > 80) e.title = 'Máximo 80 caracteres';
  const description = form.description.trim();
  if (description.length < 10) e.description = 'Mínimo 10 caracteres';
  else if (description.length > 1000) e.description = 'Máximo 1000 caracteres';
}

const isPositiveInt = (s: string) => { const n = Number.parseInt(s); return Boolean(s) && !Number.isNaN(n) && n >= 1; };

function validateDetails(form: Form, coords: Coords, e: Record<string, string>) {
  if (form.modality !== 'remoto' && !form.location.trim())
    e.location = 'Obligatorio. Indicá la dirección o sede del voluntariado';
  // Presencial sin pin no aparece en el mapa de Explorar (§260); el híbrido puede no tener un único lugar.
  if (form.modality === 'presencial' && !coords)
    e.coords = 'Marcá el lugar en el mapa: buscá la dirección o tocá el mapa';
  if (form.type === 'fugaz' && !form.duration.trim())
    e.duration = 'Indicá la duración del evento';
  if (form.type === 'sostenido' && !isPositiveInt(form.hours_per_week))
    e.hours_per_week = 'Ingresá horas por semana (mín. 1)';
  if (!isPositiveInt(form.volunteers_needed))
    e.volunteers_needed = '¿Cuántos voluntarios necesitás?';
}

/** Los errores del paso (1: lo básico; 2: lugar, tiempo y cupos; 3: nada), por campo. */
export function validateStep(step: number, form: Form, coords: Coords): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) validateBasics(form, e);
  if (step === 2) validateDetails(form, coords, e);
  return e;
}

/** El error de un rol nuevo ('' si se puede agregar). */
export function roleError(value: string, roles: string[]): string {
  const val = value.trim();
  if (!val) return 'Escribí un rol';
  if (!ROLE_RE.test(val)) return 'Solo letras, mínimo 2 caracteres';
  if (roles.includes(val)) return 'Ya está en la lista';
  return '';
}

/** El error de un requisito nuevo ('' si se puede agregar). Repetido: 'duplicate', que no se muestra (no se agrega). */
export function reqError(value: string, requirements: string[]): string {
  const val = value.trim();
  if (!val) return 'Escribí un requisito';
  if (!REQ_RE.test(val)) return 'Mínimo 3 caracteres';
  if (requirements.includes(val)) return 'duplicate';
  return '';
}
