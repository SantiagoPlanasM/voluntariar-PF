import { useState, useEffect, useRef } from 'react';
import { TypeBadge } from '../ui/TypeBadge';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, ArrowRight, Plus, X, Loader2, Check, AlertCircle,
  Zap, Sprout, MapPin, Users, DollarSign, ClipboardList, Laptop, Globe,
} from 'lucide-react';
import { api, type Project, type ProjectDetail } from '../../lib/api';
import { LocationPicker } from './LocationPicker';
import { LoadError, describeLoadError } from './LoadError';
import { ProjectPhotoField } from './ProjectPhotoField';
import { compressImage } from '../../lib/imageCompress';
import { userMessage } from '../../lib/format';
import { useToast } from '../ui/UiProvider';

const CATEGORIES = ['Medio Ambiente', 'Educación', 'Salud', 'Animales', 'Alimentación', 'Tecnología', 'Arte y Cultura', 'Deportes'];
const ROLE_RE    = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-\/]{2,40}$/;
const REQ_RE     = /^.{3,100}$/;

const STEPS = [
  { id: 1, label: 'Básico',    icon: ClipboardList },
  { id: 2, label: 'Detalles',  icon: MapPin },
  { id: 3, label: 'Extras',    icon: Users },
];

const SUGGESTED_ROLES = ['Coordinador', 'Fotógrafo', 'Logística', 'Comunicación', 'Jardinero'];
const SUGGESTED_REQS  = ['Ropa cómoda', 'Disponibilidad fines de semana', 'Mayor de 18 años', 'Sin experiencia previa'];

const FIELD_LABELS: Record<string, string> = {
  title: 'Título', description: 'Descripción', location: 'Ubicación',
  modality: 'Modalidad', duration: 'Duración', hours_per_week: 'Horas por semana', volunteers_needed: 'Voluntarios',
};

type Form = {
  title: string; description: string; full_description: string; category: string; location: string;
  modality: 'presencial' | 'remoto' | 'hibrido'; type: 'fugaz' | 'sostenido';
  duration: string; hours_per_week: string; volunteers_needed: string; funding_goal: string; cost_per_person: string;
};
type Coords = { lat: number; lng: number } | null;

const EMPTY_FORM: Form = {
  title: '', description: '', full_description: '',
  category: 'Medio Ambiente', location: '',
  modality: 'presencial', type: 'fugaz',
  duration: '', hours_per_week: '',
  volunteers_needed: '', funding_goal: '', cost_per_person: '',
};

// Lo que se manda al backend, igual para crear y para editar. Al editar, "sin valor" es null (el PUT es parcial:
// un campo que no viene se conserva, así que para borrar la descripción completa o el lugar hay que mandar null).
function toBody(form: Form, roles: string[], requirements: string[], coords: Coords, editing: boolean): Partial<Project> {
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
function fromProject(p: ProjectDetail): { form: Form; roles: string[]; requirements: string[]; coords: Coords } {
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
function changedFields(body: Partial<Project>, initial: Partial<Project>): Partial<Project> {
  return Object.fromEntries(
    Object.entries(body).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(initial[k as keyof Project])),
  ) as Partial<Project>;
}

export function CreateVoluntariado() {
  const navigate = useNavigate();
  // Con :projectId es la edición de un voluntariado ya publicado (§255); sin él, el alta.
  const { projectId } = useParams();
  const editing = !!projectId;
  const mainRef  = useRef<HTMLElement>(null);
  const initialBody = useRef<Partial<Project>>({});
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProject, setLoadingProject] = useState(editing);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  // Lugar en el mapa (opcional). Antes no se mandaba nunca: el mapa ponía el voluntariado en un punto inventado.
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null);
  const [roles, setRoles]         = useState<string[]>([]);
  const [requirements, setReqs]     = useState<string[]>([]);
  // §282: la foto elegida (se sube después de guardar) y la actual, al editar.
  const [photo, setPhoto]               = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const toast = useToast();

  const loadProject = async () => {
    setLoadingProject(true);
    setLoadError(null);
    try {
      const { project } = await api.projects.get(projectId!);
      // El backend igual rechaza el PUT de otra ONG (404); esto evita llenar un formulario que no se va a poder guardar.
      if (project.can_manage === false) {
        setLoadError({ message: 'Solo la organización que lo publicó puede editarlo.', retry: false });
        return;
      }
      const loaded = fromProject(project);
      setForm(loaded.form); setRoles(loaded.roles); setReqs(loaded.requirements); setCoords(loaded.coords);
      setCurrentImage(project.image || null);
      initialBody.current = toBody(loaded.form, loaded.roles, loaded.requirements, loaded.coords, true);
    } catch (e) {
      setLoadError(describeLoadError(e, 'No encontramos este voluntariado'));
    } finally {
      setLoadingProject(false);
    }
  };
  useEffect(() => { if (editing) void loadProject(); }, [projectId]);
  const [newRole, setNewRole]       = useState('');
  const [newReq, setNewReq]         = useState('');
  const [roleError, setRoleError]   = useState('');
  const [reqError, setReqError]     = useState('');

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const addRole = (value?: string) => {
    const val = (value ?? newRole).trim();
    if (!val) { setRoleError('Escribí un rol'); return; }
    if (!ROLE_RE.test(val)) { setRoleError('Solo letras, mínimo 2 caracteres'); return; }
    if (roles.includes(val)) { setRoleError('Ya está en la lista'); return; }
    setRoles(r => [...r, val]); setNewRole(''); setRoleError('');
  };

  const addReq = (value?: string) => {
    const val = (value ?? newReq).trim();
    if (!val) { setReqError('Escribí un requisito'); return; }
    if (!REQ_RE.test(val)) { setReqError('Mínimo 3 caracteres'); return; }
    if (requirements.includes(val)) return;
    setReqs(r => [...r, val]); setNewReq(''); setReqError('');
  };

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      // Topes iguales a los del backend (§143); maxLength los impone al escribir, esto cubre lo pegado (§145).
      if (!form.title.trim() || form.title.trim().length < 3)
        e.title = 'Mínimo 3 caracteres';
      else if (form.title.trim().length > 80)
        e.title = 'Máximo 80 caracteres';
      if (!form.description.trim() || form.description.trim().length < 10)
        e.description = 'Mínimo 10 caracteres';
      else if (form.description.trim().length > 1000)
        e.description = 'Máximo 1000 caracteres';
    }
    if (s === 2) {
      if (form.modality !== 'remoto' && !form.location.trim())
        e.location = 'Obligatorio. Indicá la dirección o sede del voluntariado';
      // Presencial sin pin no aparece en el mapa de Explorar (§260); el híbrido puede no tener un único lugar.
      if (form.modality === 'presencial' && !coords)
        e.coords = 'Marcá el lugar en el mapa: buscá la dirección o tocá el mapa';
      if (form.type === 'fugaz' && !form.duration.trim())
        e.duration = 'Indicá la duración del evento';
      if (form.type === 'sostenido') {
        const h = Number.parseInt(form.hours_per_week);
        if (!form.hours_per_week || Number.isNaN(h) || h < 1)
          e.hours_per_week = 'Ingresá horas por semana (mín. 1)';
      }
      const v = Number.parseInt(form.volunteers_needed);
      if (!form.volunteers_needed || Number.isNaN(v) || v < 1)
        e.volunteers_needed = '¿Cuántos voluntarios necesitás?';
    }
    return e;
  };

  const next = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      // §292: uno solo pendiente, y se cancela al desmontar (si no, corría con la pantalla ya cerrada).
      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return;
    }
    setErrors({});
    setStep(s => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setErrors({});
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const allErrs = { ...validateStep(1), ...validateStep(2) };
    if (Object.keys(allErrs).length) {
      setErrors(allErrs);
      setStep(Object.keys(validateStep(1)).length ? 1 : 2);
      return;
    }
    const body = toBody(form, roles, requirements, coords, editing);
    setLoading(true);
    try {
      if (editing) {
        const changes = changedFields(body, initialBody.current);
        if (Object.keys(changes).length > 0) await api.projects.update(projectId!, changes);
        await savePhoto(projectId!, 'Los cambios se guardaron');
        navigate(`/ngo/dashboard/project/${projectId}`);
      } else {
        const { project } = await api.projects.create(body);
        await savePhoto(project.id, 'El voluntariado se publicó');
        navigate('/ngo/dashboard');
      }
    } catch (err: any) { setErrors({ _global: err.message }); }
    finally { setLoading(false); }
  };

  // §282: la foto va después de guardar (al crear, recién ahí hay id). Si falla, el voluntariado ya quedó guardado:
  // se sigue igual y el aviso lo dice, para que no se vuelva a publicar.
  const savePhoto = async (id: string, saved: string) => {
    if (!photo) return;
    try {
      const ready = await compressImage(photo);
      const fd = new FormData();
      fd.append('photo', ready, ready.name);
      await api.projects.uploadPhoto(id, fd);
    } catch (e) {
      toast(`${saved}, pero la foto no se pudo subir: ${userMessage(e, 'revisá tu conexión')}. Podés cargarla desde "Editar".`, { kind: 'error' });
    }
  };

  const inp = (key: string) =>
    `w-full px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
      errors[key] ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-400 focus:border-blue-300'
    }`;
  const lbl = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const hint = 'text-xs text-gray-400 mt-1';
  const err = (key: string) => errors[key]
    ? <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{errors[key]}
      </p>
    : null;

  const fieldErrors = Object.entries(errors).filter(([k]) => k !== '_global');
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  // Ajusta padding inferior según si hay errores visibles en el footer
  useEffect(() => {
    if (!mainRef.current) return;
    const extra = fieldErrors.length > 0 ? 48 : 0;
    mainRef.current.style.paddingBottom = `${112 + extra}px`;
  }, [fieldErrors.length, step]);

  if (loadingProject) return (
    <div role="status" aria-label="Cargando voluntariado" className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-brand" />
    </div>
  );
  if (loadError) return (
    <LoadError message={loadError.message} onRetry={loadError.retry ? loadProject : undefined} home="/ngo/dashboard" />
  );

  // Al editar, una categoría vieja que ya no está entre las sugeridas se muestra igual (elegida).
  const categories = form.category && !CATEGORIES.includes(form.category) ? [...CATEGORIES, form.category] : CATEGORIES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => step > 1 ? back() : navigate(-1)} aria-label="Volver"
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900">{editing ? 'Editar voluntariado' : 'Nuevo Voluntariado'}</h1>
              <p className="text-xs text-gray-400">Paso {step} de {STEPS.length} — {STEPS[step - 1].label}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }} />
          </div>

          {/* Step pills */}
          <div className="flex gap-2">
            {STEPS.map(({ id, label, icon: Icon }) => {
              const done = id < step;
              const active = id === step;
              return (
                <div key={id} className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : done ? 'text-emerald-600' : 'text-gray-400'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-people text-white' : active ? 'bg-blue-600 text-white' : 'bg-surface-soft text-ink-muted'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </div>
                  <span className="hidden sm:inline truncate">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Form content */}
      <main ref={mainRef} className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 pb-28">

        {/* ── Step 1: Básico ── */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Tipo */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className={lbl}>¿Qué tipo de voluntariado es?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {([
                  { val: 'fugaz', icon: Zap, color: 'blue', title: 'Fugaz', desc: 'Evento puntual: limpieza, jornada solidaria, campaña de un fin de semana.' },
                  { val: 'sostenido', icon: Sprout, color: 'emerald', title: 'Sostenido', desc: 'Compromiso continuo: tutorías, apoyo semanal, proyecto de largo plazo.' },
                ] as const).map(({ val, icon: Icon, color, title, desc }) => {
                  const selected = form.type === val;
                  return (
                    <button key={val} type="button" onClick={() => set('type', val)} disabled={editing}
                      className={`text-left p-4 rounded-xl border-2 transition-all disabled:cursor-not-allowed ${editing && !selected ? 'opacity-50' : ''} ${
                        selected
                          ? color === 'blue' ? 'border-brand bg-brand-soft' : 'border-people bg-people-soft'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                      }`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
                        selected ? (color === 'blue' ? 'bg-brand' : 'bg-people') : 'bg-surface-pressed'
                      }`}>
                        <Icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <p className={`font-bold text-sm ${selected ? (color === 'blue' ? 'text-brand-text' : 'text-people-text') : 'text-ink'}`}>{title}</p>
                      <p className="text-xs text-ink-soft mt-1 leading-relaxed">{desc}</p>
                    </button>
                  );
                })}
              </div>
              {/* Cambiarlo con inscriptos cambiaría el compromiso que aceptaron (una jornada o horas por semana). */}
              {editing && <p className={hint}>El tipo no se puede cambiar después de publicar.</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div id="field-title">
                <label htmlFor="crear-titulo" className={lbl}>Título del voluntariado *</label>
                <input id="crear-titulo" className={inp('title')} placeholder="Ej: Jornada de limpieza en el río"
                  aria-label="Título del voluntariado" maxLength={80} value={form.title} onChange={e => set('title', e.target.value)} />
                <p className={hint}>{form.title.length}/80 caracteres</p>
                {err('title')}
              </div>

              <div id="field-description">
                <label htmlFor="crear-descripcion" className={lbl}>Descripción corta *</label>
                <textarea id="crear-descripcion" className={inp('description') + ' resize-none'} rows={3}
                  placeholder="Contá en pocas palabras qué harán los voluntarios y por qué es importante..."
                  aria-label="Descripción corta" maxLength={1000} value={form.description} onChange={e => set('description', e.target.value)} />
                <p className={hint}>{form.description.length}/1000 caracteres · mínimo 10</p>
                {err('description')}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Detalles ── */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div>
                <p className={lbl}>Categoría</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {categories.map(c => (
                    <button key={c} type="button" onClick={() => set('category', c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.category === c
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modalidad */}
              <div>
                <p className={lbl}>Modalidad del voluntariado *</p>
                <div className="grid grid-cols-3 gap-2.5 mt-1">
                  {([
                    { val: 'presencial', label: 'Presencial', icon: MapPin, desc: 'En sede física' },
                    { val: 'remoto',     label: 'Remoto',     icon: Laptop, desc: '100% online' },
                    { val: 'hibrido',    label: 'Híbrido',    icon: Globe,  desc: 'Virtual y presencial' },
                  ] as const).map(({ val, label, icon: Icon, desc }) => {
                    const selected = form.modality === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          set('modality', val);
                          if (val === 'remoto') {
                            if (!form.location.trim() || form.location.toLowerCase() !== 'remoto') {
                              set('location', 'Remoto');
                            }
                          } else if (val === 'presencial') {
                            if (form.location.toLowerCase() === 'remoto') {
                              set('location', '');
                            }
                          }
                        }}
                        className={`p-3 sm:p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                          selected
                            ? 'border-ink bg-surface-soft text-ink shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs sm:text-sm font-bold">{label}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-tight hidden sm:block">{desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div id="field-location">
                <label className={lbl}>
                  {form.modality === 'remoto' ? 'Plataforma o medio digital' : 'Ubicación *'}
                </label>
                <div className="relative">
                  {form.modality === 'remoto' ? (
                    <Laptop className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  ) : (
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                  <input
                    className={inp('location') + ' pl-9'}
                    placeholder={
                      form.modality === 'remoto'
                        ? 'Ej: Google Meet, Zoom, Slack (o podés dejar Remoto)'
                        : form.modality === 'hibrido'
                        ? 'Ej: Parque Sarmiento y Google Meet'
                        : 'Ej: Parque Sarmiento, Córdoba'
                    }
                    aria-label={form.modality === 'remoto' ? 'Plataforma o medio digital' : 'Ubicación'} value={form.location}
                    onChange={e => set('location', e.target.value)}
                  />
                </div>
                {form.modality === 'remoto' ? (
                  <p className={hint}>Los voluntarios participarán 100% de manera online.</p>
                ) : form.modality === 'hibrido' ? (
                  <p className={hint}>Indicá el punto de encuentro físico y la plataforma virtual.</p>
                ) : null}
                {err('location')}
                {form.modality !== 'remoto' && (
                  <div id="field-coords">
                    <LocationPicker query={form.location} value={coords} onChange={setCoords} />
                    {err('coords')}
                  </div>
                )}
              </div>

              {form.type === 'fugaz' ? (
                <div id="field-duration">
                  <label htmlFor="crear-duracion" className={lbl}>Duración del evento *</label>
                  <input id="crear-duracion" className={inp('duration')} placeholder="Ej: 1 jornada (4 hs), 2 días, sábado 9 a 13 hs"
                    aria-label="Duración del evento" value={form.duration} onChange={e => set('duration', e.target.value)} />
                  {err('duration')}
                </div>
              ) : (
                <div id="field-hours_per_week">
                  <label htmlFor="crear-horas" className={lbl}>Horas por semana *</label>
                  <input id="crear-horas" className={inp('hours_per_week')} type="number" min="1" max="40"
                    placeholder="Ej: 4"
                    aria-label="Horas por semana" value={form.hours_per_week} onChange={e => set('hours_per_week', e.target.value)} />
                  <p className={hint}>Tiempo estimado que dedicará cada voluntario por semana</p>
                  {err('hours_per_week')}
                </div>
              )}

              <div id="field-volunteers_needed">
                <label htmlFor="crear-voluntarios" className={lbl}>Voluntarios necesarios *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input id="crear-voluntarios" className={inp('volunteers_needed') + ' pl-9'} type="number" min="1"
                    placeholder="Ej: 20"
                    aria-label="Voluntarios necesarios" value={form.volunteers_needed} onChange={e => set('volunteers_needed', e.target.value)} />
                </div>
                {err('volunteers_needed')}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Extras ── */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <ProjectPhotoField currentUrl={currentImage} file={photo} onChange={setPhoto} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div>
                <label htmlFor="crear-descripcion-completa" className={lbl}>
                  Descripción completa
                  <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                </label>
                <textarea id="crear-descripcion-completa" className={inp('full_description') + ' resize-none'} rows={4}
                  placeholder="Agregá más detalles: horarios, qué deben traer, cómo será el día..."
                  aria-label="Descripción completa" maxLength={5000} value={form.full_description} onChange={e => set('full_description', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>
                    <DollarSign className="w-3.5 h-3.5 inline mr-0.5" />
                    Costo por persona
                  </label>
                  <input className={inp('cost_per_person')} type="number" min="0"
                    placeholder="0 = gratis"
                    aria-label="Costo por persona" value={form.cost_per_person} onChange={e => set('cost_per_person', e.target.value)} />
                  <p className={hint}>Transporte, materiales, etc.</p>
                </div>
                <div>
                  <label htmlFor="crear-meta" className={lbl}>Meta de financiamiento</label>
                  <input id="crear-meta" className={inp('funding_goal')} type="number" min="0" placeholder="0"
                    aria-label="Meta de financiamiento" value={form.funding_goal} onChange={e => set('funding_goal', e.target.value)} />
                  <p className={hint}>Opcional</p>
                </div>
              </div>
            </div>

            {/* Roles */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className={lbl}>
                Roles necesitados
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </p>
              <p className="text-xs text-gray-400 mb-3">¿Qué tareas específicas necesitás cubrir?</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTED_ROLES.filter(r => !roles.includes(r)).map(r => (
                  <button key={r} type="button" onClick={() => addRole(r)}
                    className="px-2.5 py-1 bg-surface-soft text-ink-soft text-xs rounded-full font-medium hover:bg-surface-pressed transition-colors">
                    + {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  className={`flex-1 px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${roleError ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="O escribí uno personalizado..."
                  aria-label="Rol personalizado" value={newRole} onChange={e => { setNewRole(e.target.value); setRoleError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRole())} />
                <button type="button" onClick={() => addRole()} aria-label="Agregar rol"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {roleError && <p className="text-xs text-critical mb-2">{roleError}</p>}
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => (
                    <span key={r} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                      {r}
                      <button type="button" onClick={() => setRoles(roles.filter(x => x !== r))} aria-label={`Quitar rol ${r}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Requisitos */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className={lbl}>
                Requisitos
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </p>
              <p className="text-xs text-gray-400 mb-3">¿Qué deben saber o tener los voluntarios?</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTED_REQS.filter(r => !requirements.includes(r)).map(r => (
                  <button key={r} type="button" onClick={() => addReq(r)}
                    className="px-2.5 py-1 bg-people-soft text-people-text text-xs rounded-full font-medium hover:opacity-80 transition-opacity">
                    + {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  className={`flex-1 px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${reqError ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="O escribí uno personalizado..."
                  aria-label="Requisito personalizado" value={newReq} onChange={e => { setNewReq(e.target.value); setReqError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReq())} />
                <button type="button" onClick={() => addReq()} aria-label="Agregar requisito"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {reqError && <p className="text-xs text-critical mb-2">{reqError}</p>}
              {requirements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {requirements.map(r => (
                    <span key={r} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                      {r}
                      <button type="button" onClick={() => setReqs(requirements.filter(x => x !== r))} aria-label={`Quitar requisito ${r}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="bg-surface-soft rounded-2xl p-5">
              <p className="text-sm font-bold text-gray-800 mb-3">Resumen</p>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p><span className="font-medium text-gray-800">{form.title || '—'}</span></p>
                <p className="flex items-center gap-1.5 flex-wrap">
                  <TypeBadge type={form.type} variant="soft" />
                  <span>
                    · {form.category} · {
                      form.modality === 'remoto'
                        ? '💻 Remoto'
                        : form.modality === 'hibrido'
                        ? `🌐 Híbrido (${form.location || 'Online + Sede'})`
                        : (form.location || '—')
                    }
                  </span>
                </p>
                {form.modality !== 'remoto' && <p>{coords ? 'Lugar marcado en el mapa' : 'Sin lugar marcado en el mapa'}</p>}
                <p>{form.volunteers_needed ? `${form.volunteers_needed} voluntarios` : '—'} · {roles.length} roles · {requirements.length} requisitos</p>
              </div>
            </div>
          </div>
        )}

        {errors._global && (
          <p className="mt-4 text-sm bg-surface-soft text-critical border border-hairline px-4 py-3 rounded-xl">{errors._global}</p>
        )}
      </main>

      {/* Footer fijo — siempre visible al scrollear */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-60 right-0 z-20 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={back}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          {step < 3 ? (
            <button type="button" onClick={next}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-blue-200">
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 shadow-md shadow-emerald-200">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? 'Guardar cambios' : 'Publicar Voluntariado'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
