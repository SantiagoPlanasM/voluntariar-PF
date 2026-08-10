import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, ArrowRight, Plus, X, Loader2, Check, AlertCircle,
  Zap, Sprout, MapPin, Users, DollarSign, ClipboardList,
} from 'lucide-react';
import { api } from '../../lib/api';

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
  duration: 'Duración', hours_per_week: 'Horas por semana', volunteers_needed: 'Voluntarios',
};

export function CreateVoluntariado() {
  const navigate = useNavigate();
  const mainRef  = useRef<HTMLElement>(null);
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '', description: '', full_description: '',
    category: 'Medio Ambiente', location: '',
    type: 'fugaz' as 'fugaz' | 'sostenido',
    duration: '', hours_per_week: '',
    volunteers_needed: '', funding_goal: '', cost_per_person: '',
  });
  const [roles, setRoles]         = useState<string[]>([]);
  const [requirements, setReqs]     = useState<string[]>([]);
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
      if (!form.title.trim() || form.title.trim().length < 3)
        e.title = 'Mínimo 3 caracteres';
      if (!form.description.trim() || form.description.trim().length < 10)
        e.description = 'Mínimo 10 caracteres';
    }
    if (s === 2) {
      if (!form.location.trim())
        e.location = 'Obligatorio. Podés poner "Remoto"';
      if (form.type === 'fugaz' && !form.duration.trim())
        e.duration = 'Indicá la duración del evento';
      if (form.type === 'sostenido') {
        const h = parseInt(form.hours_per_week);
        if (!form.hours_per_week || isNaN(h) || h < 1)
          e.hours_per_week = 'Ingresá horas por semana (mín. 1)';
      }
      const v = parseInt(form.volunteers_needed);
      if (!form.volunteers_needed || isNaN(v) || v < 1)
        e.volunteers_needed = '¿Cuántos voluntarios necesitás?';
    }
    return e;
  };

  const next = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      setTimeout(() => {
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
    setLoading(true);
    try {
      await api.projects.create({
        title: form.title.trim(),
        description: form.description.trim(),
        full_description: form.full_description.trim() || undefined,
        category: form.category,
        location: form.location.trim(),
        type: form.type,
        duration: form.type === 'fugaz' ? form.duration.trim() : undefined,
        hours_per_week: form.type === 'sostenido' ? parseInt(form.hours_per_week) : undefined,
        volunteers_needed: parseInt(form.volunteers_needed),
        funding_goal: parseFloat(form.funding_goal) || 0,
        cost_per_person: parseFloat(form.cost_per_person) || 0,
        roles_needed: roles,
        requirements,
      });
      navigate('/ngo/dashboard');
    } catch (err: any) { setErrors({ _global: err.message }); }
    finally { setLoading(false); }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => step > 1 ? back() : navigate(-1)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900">Nuevo Voluntariado</h1>
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
                    done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
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
                    <button key={val} type="button" onClick={() => set('type', val)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selected
                          ? color === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                      }`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
                        selected ? (color === 'blue' ? 'bg-blue-600' : 'bg-emerald-600') : 'bg-gray-200'
                      }`}>
                        <Icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <p className={`font-bold text-sm ${selected ? (color === 'blue' ? 'text-blue-700' : 'text-emerald-700') : 'text-gray-800'}`}>{title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div id="field-title">
                <label className={lbl}>Título del voluntariado *</label>
                <input className={inp('title')} placeholder="Ej: Jornada de limpieza en el río"
                  value={form.title} onChange={e => set('title', e.target.value)} />
                <p className={hint}>{form.title.length}/80 caracteres</p>
                {err('title')}
              </div>

              <div id="field-description">
                <label className={lbl}>Descripción corta *</label>
                <textarea className={inp('description') + ' resize-none'} rows={3}
                  placeholder="Contá en pocas palabras qué harán los voluntarios y por qué es importante..."
                  value={form.description} onChange={e => set('description', e.target.value)} />
                <p className={hint}>{form.description.length} caracteres · mínimo 10</p>
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
                <label className={lbl}>Categoría</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CATEGORIES.map(c => (
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

              <div id="field-location">
                <label className={lbl}>Ubicación *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className={inp('location') + ' pl-9'} placeholder="Ej: Parque Sarmiento, Córdoba — o escribí Remoto"
                    value={form.location} onChange={e => set('location', e.target.value)} />
                </div>
                {err('location')}
              </div>

              {form.type === 'fugaz' ? (
                <div id="field-duration">
                  <label className={lbl}>Duración del evento *</label>
                  <input className={inp('duration')} placeholder="Ej: 1 jornada (4 hs), 2 días, sábado 9 a 13 hs"
                    value={form.duration} onChange={e => set('duration', e.target.value)} />
                  {err('duration')}
                </div>
              ) : (
                <div id="field-hours_per_week">
                  <label className={lbl}>Horas por semana *</label>
                  <input className={inp('hours_per_week')} type="number" min="1" max="40"
                    placeholder="Ej: 4"
                    value={form.hours_per_week} onChange={e => set('hours_per_week', e.target.value)} />
                  <p className={hint}>Tiempo estimado que dedicará cada voluntario por semana</p>
                  {err('hours_per_week')}
                </div>
              )}

              <div id="field-volunteers_needed">
                <label className={lbl}>Voluntarios necesarios *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className={inp('volunteers_needed') + ' pl-9'} type="number" min="1"
                    placeholder="Ej: 20"
                    value={form.volunteers_needed} onChange={e => set('volunteers_needed', e.target.value)} />
                </div>
                {err('volunteers_needed')}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Extras ── */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div>
                <label className={lbl}>
                  Descripción completa
                  <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                </label>
                <textarea className={inp('full_description') + ' resize-none'} rows={4}
                  placeholder="Agregá más detalles: horarios, qué deben traer, cómo será el día..."
                  value={form.full_description} onChange={e => set('full_description', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>
                    <DollarSign className="w-3.5 h-3.5 inline mr-0.5" />
                    Costo por persona
                  </label>
                  <input className={inp('cost_per_person')} type="number" min="0"
                    placeholder="0 = gratis"
                    value={form.cost_per_person} onChange={e => set('cost_per_person', e.target.value)} />
                  <p className={hint}>Transporte, materiales, etc.</p>
                </div>
                <div>
                  <label className={lbl}>Meta de financiamiento</label>
                  <input className={inp('funding_goal')} type="number" min="0" placeholder="0"
                    value={form.funding_goal} onChange={e => set('funding_goal', e.target.value)} />
                  <p className={hint}>Opcional</p>
                </div>
              </div>
            </div>

            {/* Roles */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <label className={lbl}>
                Roles necesitados
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">¿Qué tareas específicas necesitás cubrir?</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTED_ROLES.filter(r => !roles.includes(r)).map(r => (
                  <button key={r} type="button" onClick={() => addRole(r)}
                    className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-medium hover:bg-blue-100 transition-colors">
                    + {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  className={`flex-1 px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${roleError ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="O escribí uno personalizado..."
                  value={newRole} onChange={e => { setNewRole(e.target.value); setRoleError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRole())} />
                <button type="button" onClick={() => addRole()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {roleError && <p className="text-xs text-red-500 mb-2">{roleError}</p>}
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => (
                    <span key={r} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                      {r}
                      <button type="button" onClick={() => setRoles(roles.filter(x => x !== r))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Requisitos */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <label className={lbl}>
                Requisitos
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">¿Qué deben saber o tener los voluntarios?</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTED_REQS.filter(r => !requirements.includes(r)).map(r => (
                  <button key={r} type="button" onClick={() => addReq(r)}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium hover:bg-emerald-100 transition-colors">
                    + {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  className={`flex-1 px-4 py-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${reqError ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="O escribí uno personalizado..."
                  value={newReq} onChange={e => { setNewReq(e.target.value); setReqError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReq())} />
                <button type="button" onClick={() => addReq()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {reqError && <p className="text-xs text-red-500 mb-2">{reqError}</p>}
              {requirements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {requirements.map(r => (
                    <span key={r} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                      {r}
                      <button type="button" onClick={() => setReqs(requirements.filter(x => x !== r))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl border border-blue-100 p-5">
              <p className="text-sm font-bold text-gray-800 mb-3">Resumen</p>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p><span className="font-medium text-gray-800">{form.title || '—'}</span></p>
                <p>{form.type === 'fugaz' ? '⚡ Fugaz' : '🌱 Sostenido'} · {form.category} · {form.location || '—'}</p>
                <p>{form.volunteers_needed ? `${form.volunteers_needed} voluntarios` : '—'} · {roles.length} roles · {requirements.length} requisitos</p>
              </div>
            </div>
          </div>
        )}

        {errors._global && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{errors._global}</p>
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
              Publicar Voluntariado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
