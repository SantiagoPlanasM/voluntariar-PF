import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

const CATEGORIES = ['Medio Ambiente', 'Educación', 'Salud', 'Animales', 'Alimentación', 'Tecnología', 'Arte y Cultura', 'Deportes'];
const ROLE_RE    = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-\/]{2,40}$/;
const REQ_RE     = /^.{3,100}$/;

export function CreateVoluntariado() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '', description: '', full_description: '',
    category: 'Medio Ambiente', location: '',
    type: 'fugaz' as 'fugaz' | 'sostenido',
    duration: '', hours_per_week: '',
    volunteers_needed: '', funding_goal: '', cost_per_person: '',
  });
  const [roles, setRoles]           = useState<string[]>([]);
  const [requirements, setReqs]     = useState<string[]>([]);
  const [newRole, setNewRole]       = useState('');
  const [newReq, setNewReq]         = useState('');
  const [roleError, setRoleError]   = useState('');
  const [reqError, setReqError]     = useState('');

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const addRole = () => {
    if (!newRole.trim()) { setRoleError('Escribí un rol'); return; }
    if (!ROLE_RE.test(newRole.trim())) { setRoleError('Solo letras, mínimo 2 caracteres'); return; }
    if (roles.includes(newRole.trim())) { setRoleError('Ya está en la lista'); return; }
    setRoles(r => [...r, newRole.trim()]); setNewRole(''); setRoleError('');
  };

  const addReq = () => {
    if (!newReq.trim()) { setReqError('Escribí un requisito'); return; }
    if (!REQ_RE.test(newReq.trim())) { setReqError('Mínimo 3 caracteres'); return; }
    setReqs(r => [...r, newReq.trim()]); setNewReq(''); setReqError('');
  };

  // Validación frontend completa
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      e.title = 'Mínimo 3 caracteres';
    if (!form.description.trim() || form.description.trim().length < 10)
      e.description = 'Mínimo 10 caracteres';
    if (!form.location.trim())
      e.location = 'Obligatorio. Podés poner "Remoto"';
    if (form.type === 'fugaz' && !form.duration.trim())
      e.duration = 'La duración es obligatoria';
    if (form.type === 'sostenido') {
      const h = parseInt(form.hours_per_week);
      if (!form.hours_per_week || isNaN(h) || h < 1)
        e.hours_per_week = 'Ingresá un número positivo';
    }
    const v = parseInt(form.volunteers_needed);
    if (!form.volunteers_needed || isNaN(v) || v < 1)
      e.volunteers_needed = 'Ingresá un número positivo';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
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
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
      errors[key] ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-500'
    }`;
  const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5';
  const err = (key: string) => errors[key]
    ? <p className="text-xs text-red-500 mt-1 ml-1">{errors[key]}</p>
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Nuevo Voluntariado</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5" noValidate>
        {/* Tipo */}
        <div>
          <p className={lbl}>Tipo de voluntariado</p>
          <div className="grid grid-cols-2 gap-2">
            {(['fugaz', 'sostenido'] as const).map(t => (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                  form.type === t
                    ? t === 'fugaz' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {t === 'fugaz' ? '⚡ Fugaz (días)' : '🌱 Sostenido (semanas)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={lbl}>Título *</label>
          <input className={inp('title')} placeholder="Nombre del voluntariado"
            value={form.title} onChange={e => set('title', e.target.value)} />
          {err('title')}
        </div>

        <div>
          <label className={lbl}>Descripción corta *</label>
          <textarea className={inp('description') + ' resize-none'} rows={3}
            placeholder="Resumen breve de qué harán los voluntarios..."
            value={form.description} onChange={e => set('description', e.target.value)} />
          {err('description')}
        </div>

        <div>
          <label className={lbl}>Descripción completa <span className="text-gray-400 font-normal">(opcional)</span></label>
          <textarea className={inp('full_description') + ' resize-none'} rows={4}
            placeholder="Detalles del proyecto..."
            value={form.full_description} onChange={e => set('full_description', e.target.value)} />
        </div>

        <div>
          <label className={lbl}>Categoría</label>
          <select className={inp('category')} value={form.category}
            onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={lbl}>Ubicación * <span className="text-gray-400 font-normal">(o "Remoto")</span></label>
          <input className={inp('location')} placeholder="Ej: Parque Sarmiento, Córdoba / Remoto"
            value={form.location} onChange={e => set('location', e.target.value)} />
          {err('location')}
        </div>

        {form.type === 'fugaz' ? (
          <div>
            <label className={lbl}>Duración *</label>
            <input className={inp('duration')} placeholder="Ej: 2 días, 1 jornada de 8hs"
              value={form.duration} onChange={e => set('duration', e.target.value)} />
            {err('duration')}
          </div>
        ) : (
          <div>
            <label className={lbl}>Horas por semana *</label>
            <input className={inp('hours_per_week')} type="number" min="1" max="40"
              placeholder="Ej: 4"
              value={form.hours_per_week} onChange={e => set('hours_per_week', e.target.value)} />
            {err('hours_per_week')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Voluntarios necesarios *</label>
            <input className={inp('volunteers_needed')} type="number" min="1"
              placeholder="Ej: 20"
              value={form.volunteers_needed} onChange={e => set('volunteers_needed', e.target.value)} />
            {err('volunteers_needed')}
          </div>
          <div>
            <label className={lbl}>Costo por persona ($)</label>
            <input className={inp('cost_per_person')} type="number" min="0"
              placeholder="0 = gratis"
              value={form.cost_per_person} onChange={e => set('cost_per_person', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={lbl}>Meta de financiamiento ($) <span className="text-gray-400 font-normal">(opcional)</span></label>
          <input className={inp('funding_goal')} type="number" min="0" placeholder="0"
            value={form.funding_goal} onChange={e => set('funding_goal', e.target.value)} />
        </div>

        {/* Roles */}
        <div>
          <label className={lbl}>Roles necesitados <span className="text-gray-400 font-normal">(opcional)</span></label>
          <div className="flex gap-2 mb-1">
            <input
              className={`flex-1 px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${roleError ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="Ej: Jardinero, Fotógrafo"
              value={newRole} onChange={e => { setNewRole(e.target.value); setRoleError(''); }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRole())} />
            <button type="button" onClick={addRole}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {roleError && <p className="text-xs text-red-500 ml-1 mb-1">{roleError}</p>}
          <div className="flex flex-wrap gap-2">
            {roles.map(r => (
              <span key={r} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                {r}
                <button type="button" onClick={() => setRoles(roles.filter(x => x !== r))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Requisitos */}
        <div>
          <label className={lbl}>Requisitos <span className="text-gray-400 font-normal">(opcional)</span></label>
          <div className="flex gap-2 mb-1">
            <input
              className={`flex-1 px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${reqError ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="Ej: Ropa cómoda, disponibilidad los fines de semana"
              value={newReq} onChange={e => { setNewReq(e.target.value); setReqError(''); }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReq())} />
            <button type="button" onClick={addReq}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {reqError && <p className="text-xs text-red-500 ml-1 mb-1">{reqError}</p>}
          <div className="flex flex-wrap gap-2">
            {requirements.map(r => (
              <span key={r} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                {r}
                <button type="button" onClick={() => setReqs(requirements.filter(x => x !== r))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {errors._global && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{errors._global}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-emerald-200">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Publicar Voluntariado
        </button>
      </form>
    </div>
  );
}
