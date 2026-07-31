import { useEffect, useState } from 'react';
import { LogOut, Edit2, Loader2, Save, X, Sprout } from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { api, NGO, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

const CATEGORIES = ['Medio Ambiente','Educación','Salud','Animales','Alimentación','Tecnología','Arte y Cultura','Deportes'];

export function NGOOwnProfile() {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const [ngo, setNgo]         = useState<NGO | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', mission: '', location: '', category: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { ngo: n, projects: p } = await api.ngos.me();
      setNgo(n); setProjects(p);
      setForm({ name: n.name, description: n.description || '', mission: n.mission || '', location: n.location || '', category: n.category || '' });
    } catch { navigate('/'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setSaveErr('El nombre es obligatorio'); return; }
    setSaving(true); setSaveErr('');
    try { await api.ngos.update(form); setEditing(false); load(); }
    catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
  if (!ngo) return null;

  const inp = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-emerald-600 px-4 pt-14 pb-8 relative">
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
          <div className="w-20 h-20 bg-white rounded-full mx-auto mb-3 overflow-hidden shadow-xl flex items-center justify-center">
            {ngo.logo
              ? <img src={ngo.logo} alt={ngo.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-blue-600">{ngo.name[0]}</span>
            }
          </div>
          {!editing ? (
            <>
              <h1 className="text-xl font-bold text-white mb-0.5">{ngo.name}</h1>
              {ngo.category && <p className="text-white/70 text-sm">{ngo.category}</p>}
              <div className="flex justify-center gap-4 mt-3 text-white/80 text-sm">
                <span><strong className="text-white">{ngo.followers}</strong> seguidores</span>
                <span><strong className="text-white">{projects.length}</strong> proyectos</span>
              </div>
            </>
          ) : (
            <p className="text-white/80 text-sm mt-2">Editando perfil</p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {editing ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <h2 className="font-bold text-sm text-gray-900">Editar información</h2>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Nombre *</p>
              <input className={inp} placeholder="Nombre de la ONG" value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveErr(''); }} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Categoría</p>
              <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Sin especificar</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Ubicación</p>
              <input className={inp} placeholder="Ej: Córdoba, Argentina" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Descripción</p>
              <textarea className={inp + ' resize-none'} rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Misión</p>
              <textarea className={inp + ' resize-none'} rows={2} value={form.mission}
                onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} />
            </div>

            {saveErr && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{saveErr}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-blue-700 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        ) : (
          <>
            {(ngo.description || ngo.mission) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                {ngo.description && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                    <p className="text-sm text-gray-700">{ngo.description}</p>
                  </div>
                )}
                {ngo.mission && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Misión</p>
                    <p className="text-sm text-gray-700">{ngo.mission}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-sm text-gray-900">Proyectos ({projects.length})</h2>
                <Link to="/ngo/create" className="text-xs text-blue-600 font-semibold">+ Nuevo</Link>
              </div>
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">Aún no publicaste proyectos</p>
                  <Link to="/ngo/create" className="text-xs text-blue-600 font-semibold mt-2 inline-block">Crear el primero →</Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {projects.map(p => (
                    <Link to={`/ngo/dashboard/project/${p.id}`} key={p.id}>
                      <div className="p-4 flex gap-3 hover:bg-gray-50 transition-colors">
                        {p.image
                          ? <img src={p.image} alt={p.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                          : <div className="w-12 h-12 rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center">
                              <Sprout className="w-5 h-5 text-emerald-400" />
                            </div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                          <p className="text-xs text-gray-500">{p.category}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                            p.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            {p.status === 'active' ? 'Activo' : 'Completado'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
