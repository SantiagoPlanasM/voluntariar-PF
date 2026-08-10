import { useAuth } from '../../lib/AuthContext';
import { LogOut, CheckCircle, Clock, Heart, Edit2, Save, X, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { api, EnrollmentWithProject, SkillCatalogItem, VolunteerSkill } from '../../lib/api';

const NAME_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;
const NIVEL_LABELS: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export function VolunteerProfile() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<EnrollmentWithProject[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveErr, setSaveErr]         = useState('');
  const [form, setForm] = useState({ name: '', bio: '', location: '' });

  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogItem[]>([]);
  const [mySkills, setMySkills]         = useState<VolunteerSkill[]>([]);
  const [draftSkills, setDraftSkills]   = useState<{ habilidad_id: string; nivel: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name || '', bio: user.bio || '', location: user.location || '' });
    api.enrollments.my()
      .then(r => setEnrollments(r.enrollments))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.catalog.habilidades().then(r => setSkillCatalog(r.habilidades)).catch(() => {});
    api.voluntarios.habilidades.list().then(r => setMySkills(r.habilidades)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (editing) setDraftSkills(mySkills.map(s => ({ habilidad_id: s.id, nivel: s.nivel })));
  }, [editing, mySkills]);

  const toggleSkill = (habilidad_id: string) => {
    setDraftSkills(ds =>
      ds.some(s => s.habilidad_id === habilidad_id)
        ? ds.filter(s => s.habilidad_id !== habilidad_id)
        : [...ds, { habilidad_id, nivel: 'basico' }]
    );
  };
  const setSkillNivel = (habilidad_id: string, nivel: string) => {
    setDraftSkills(ds => ds.map(s => (s.habilidad_id === habilidad_id ? { ...s, nivel } : s)));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !NAME_RE.test(form.name.trim())) {
      setSaveErr('Nombre inválido: solo letras y espacios, mínimo 2 caracteres'); return;
    }
    setSaving(true); setSaveErr('');
    try {
      await api.auth.updateMe({ name: form.name.trim(), bio: form.bio, location: form.location });
      const { habilidades } = await api.voluntarios.habilidades.update(draftSkills);
      setMySkills(habilidades);
      setEditing(false);
      // Refrescar el usuario en contexto
      window.location.reload();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3">
      <p className="text-gray-500">No estás logueado</p>
      <Link to="/" className="text-emerald-600 font-semibold text-sm">Ir al inicio</Link>
    </div>
  );

  const approved = enrollments.filter(e => e.status === 'approved').length;
  const pending  = enrollments.filter(e => e.status === 'pending').length;
  const inp = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-4 pt-14 pb-10 relative">
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={() => { setEditing(!editing); setSaveErr(''); }}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            {editing ? <X className="w-5 h-5 text-white" /> : <Edit2 className="w-5 h-5 text-white" />}
          </button>
          <button onClick={() => { logout(); navigate('/'); }}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto mb-3 overflow-hidden shadow-xl">
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">{user.name[0]}</div>
            }
          </div>
          <h1 className="text-2xl font-bold text-white mb-0.5">{user.name}</h1>
          <p className="text-white/70 text-sm">{user.email}</p>
          {user.location && <p className="text-white/60 text-xs mt-1">📍 {user.location}</p>}
          <span className="mt-2 inline-block px-3 py-1 bg-white/20 text-white text-xs rounded-full font-medium">
            🙋 Voluntario
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6 mb-5">
        <div className="bg-white rounded-2xl shadow-xl p-4 grid grid-cols-3 gap-4 border border-gray-100">
          {[
            { icon: CheckCircle, label: 'Aprobadas',  val: approved,           color: 'text-green-600',  bg: 'bg-green-50'  },
            { icon: Clock,       label: 'Pendientes', val: pending,             color: 'text-amber-500',  bg: 'bg-amber-50'  },
            { icon: Heart,       label: 'Total',      val: enrollments.length,  color: 'text-emerald-600',bg: 'bg-emerald-50'},
          ].map(({ icon: Icon, label, val, color, bg }) => (
            <div key={label} className="text-center">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{val}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4 pb-8">
        {/* Editar perfil */}
        {editing && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <h2 className="font-bold text-sm text-gray-900">Editar perfil</h2>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nombre completo *</label>
              <input className={inp} value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveErr(''); }} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Sobre mí</label>
              <textarea className={inp + ' resize-none'} rows={3}
                placeholder="Contá quién sos y por qué querés ser voluntario..."
                value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Ubicación</label>
              <input className={inp} placeholder="Ej: Córdoba Capital"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Habilidades</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skillCatalog.map(s => {
                  const selected = draftSkills.find(d => d.habilidad_id === s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSkill(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s.nombre}
                    </button>
                  );
                })}
              </div>
              {draftSkills.length > 0 && (
                <div className="space-y-1.5 bg-gray-50 rounded-xl p-3">
                  {draftSkills.map(d => {
                    const skill = skillCatalog.find(s => s.id === d.habilidad_id);
                    if (!skill) return null;
                    return (
                      <div key={d.habilidad_id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700">{skill.nombre}</span>
                        <select value={d.nivel} onChange={e => setSkillNivel(d.habilidad_id, e.target.value)}
                          className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          {Object.entries(NIVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {saveErr && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{saveErr}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        )}

        {/* Bio */}
        {!editing && user.bio && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Sobre mí</p>
            <p className="text-sm text-gray-700">{user.bio}</p>
          </div>
        )}

        {/* Habilidades */}
        {!editing && mySkills.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />Habilidades
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mySkills.map(s => (
                <span key={s.id} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                  {s.nombre} · {NIVEL_LABELS[s.nivel]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Últimas participaciones */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Últimas participaciones</h2>
            <Link to="/participation" className="text-xs text-emerald-600 font-semibold">Ver todas →</Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-3xl mb-2">🌱</p>
              <p className="text-sm text-gray-500">Aún no participaste en ningún proyecto</p>
              <Link to="/feed" className="text-sm text-emerald-600 font-semibold mt-2 inline-block">Explorar proyectos →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {enrollments.slice(0, 3).map(e => (
                <Link to={`/project/${e.project_id}`} key={e.id}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex gap-3 items-center hover:border-emerald-200 transition-colors">
                    {e.image
                      ? <img src={e.image} alt={e.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      : <div className="w-12 h-12 rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center text-xl">🌱</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{e.title}</p>
                      <p className="text-xs text-gray-500">{e.ngo_name}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                      e.status === 'approved' ? 'bg-green-50 text-green-600'
                      : e.status === 'pending' ? 'bg-amber-50 text-amber-500'
                      : 'bg-red-50 text-red-500'}`}>
                      {e.status === 'approved' ? '✓ Aprobado' : e.status === 'pending' ? '⏳ Pendiente' : '✕ Rechazado'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
