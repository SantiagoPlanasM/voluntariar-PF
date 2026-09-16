import { useEffect, useState } from 'react';
import { LogOut, Edit2, Loader2, Save, X, Sprout, Send, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api, Empresa, Patrocinio, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

const CATEGORIES = ['Medio Ambiente','Educación','Salud','Animales','Alimentación','Tecnología','Arte y Cultura','Deportes'];

const ESTADO_BADGE: Record<Patrocinio['estado'], string> = {
  propuesto: 'bg-amber-50 text-amber-700',
  aceptado:  'bg-emerald-50 text-emerald-700',
  rechazado: 'bg-red-50 text-red-600',
};
const ESTADO_LABEL: Record<Patrocinio['estado'], string> = {
  propuesto: 'Pendiente', aceptado: 'Aceptado', rechazado: 'Rechazado',
};

export function CompanyOwnProfile() {
  const { logout } = useAuth();
  const navigate    = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', mission: '', location: '', industry: '', category: '' });

  const [patrocinios, setPatrocinios] = useState<Patrocinio[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [showPropose, setShowPropose] = useState(false);
  const [proposeProjectId, setProposeProjectId] = useState('');
  const [proposeMsg, setProposeMsg] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposeErr, setProposeErr] = useState('');

  useEffect(() => { load(); loadPatrocinios(); }, []);

  const loadPatrocinios = async () => {
    try {
      const [{ patrocinios: p }, { projects }] = await Promise.all([
        api.empresas.patrocinios.list(),
        api.projects.list({ status: 'active' }),
      ]);
      setPatrocinios(p);
      // Ofrecer para proponer solo proyectos sin propuesta vigente (propuesta o aceptada)
      const yaPropuestos = new Set(p.filter(x => x.estado !== 'rechazado').map(x => x.project_id));
      setActiveProjects(projects.filter(pr => !yaPropuestos.has(pr.id)));
    } catch { /* la sección de patrocinios simplemente queda vacía */ }
  };

  const handlePropose = async () => {
    if (!proposeProjectId) { setProposeErr('Elegí un proyecto'); return; }
    setProposing(true); setProposeErr('');
    try {
      await api.empresas.patrocinios.propose(proposeProjectId, proposeMsg || undefined);
      setShowPropose(false); setProposeProjectId(''); setProposeMsg('');
      loadPatrocinios();
    } catch (e: any) { setProposeErr(e.message); }
    finally { setProposing(false); }
  };

  const handleWithdraw = async (projectId: string) => {
    if (!window.confirm('¿Retirar esta propuesta de patrocinio?')) return;
    try { await api.empresas.patrocinios.withdraw(projectId); loadPatrocinios(); }
    catch { /* si falla, el usuario puede reintentar */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { empresa: e } = await api.empresas.me();
      setEmpresa(e);
      setForm({
        name: e.name, description: e.description || '', mission: e.mission || '',
        location: e.location || '', industry: e.industry || '', category: e.category || '',
      });
    } catch { navigate('/'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setSaveErr('El nombre es obligatorio'); return; }
    setSaving(true); setSaveErr('');
    try { await api.empresas.update(form); setEditing(false); load(); }
    catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );
  if (!empresa) return null;

  const inp = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-4 pt-14 pb-8 relative">
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
            {empresa.logo
              ? <img src={empresa.logo} alt={empresa.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-violet-600">{empresa.name[0]}</span>
            }
          </div>
          {!editing ? (
            <>
              <h1 className="text-xl font-bold text-white mb-0.5">{empresa.name}</h1>
              {empresa.industry && <p className="text-white/70 text-sm">{empresa.industry}</p>}
              <div className="flex justify-center gap-4 mt-3 text-white/80 text-sm">
                <span><strong className="text-white">{empresa.followers}</strong> seguidores</span>
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
              <input className={inp} placeholder="Nombre de la empresa" value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveErr(''); }} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Industria / Rubro</p>
              <input className={inp} placeholder="Ej: Tecnología, Retail, Alimentos" value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Categoría de interés</p>
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
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Misión de RSE</p>
              <textarea className={inp + ' resize-none'} rows={2} value={form.mission}
                onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} />
            </div>

            {saveErr && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{saveErr}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-violet-700 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        ) : (
          <>
            {(empresa.description || empresa.mission) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                {empresa.description && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                    <p className="text-sm text-gray-700">{empresa.description}</p>
                  </div>
                )}
                {empresa.mission && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Misión de RSE</p>
                    <p className="text-sm text-gray-700">{empresa.mission}</p>
                  </div>
                )}
              </div>
            )}

            {/* Patrocinios: API real desde 2026-09 (roadmap punto 5), ver
                routes/empresas.js y routes/ngos.js. */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-sm text-gray-900">Proyectos patrocinados</h2>
                <button onClick={() => { setShowPropose(v => !v); setProposeErr(''); }}
                  className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700">
                  <Send className="w-3.5 h-3.5" />Proponer
                </button>
              </div>

              {showPropose && (
                <div className="p-4 bg-violet-50/50 border-b border-gray-100 space-y-2">
                  {activeProjects.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay proyectos activos disponibles para proponer ahora mismo.</p>
                  ) : (
                    <>
                      <select
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        value={proposeProjectId} onChange={e => setProposeProjectId(e.target.value)}
                      >
                        <option value="">Elegí un proyecto...</option>
                        {activeProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <textarea
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                        rows={2} placeholder="Mensaje para la ONG (opcional)"
                        value={proposeMsg} onChange={e => setProposeMsg(e.target.value)}
                      />
                      {proposeErr && <p className="text-xs text-red-500">{proposeErr}</p>}
                      <button onClick={handlePropose} disabled={proposing}
                        className="w-full py-2 bg-violet-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-violet-700 transition-colors">
                        {proposing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Enviar propuesta
                      </button>
                    </>
                  )}
                </div>
              )}

              {patrocinios.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Sprout className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Todavía no hay patrocinios</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {patrocinios.map(p => (
                    <div key={p.project_id} className="p-4 flex items-center gap-3">
                      {p.project_image
                        ? <img src={p.project_image} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        : <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.project_title}</p>
                        <p className="text-xs text-gray-400 truncate">{p.ngo_name}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${ESTADO_BADGE[p.estado]}`}>
                        {ESTADO_LABEL[p.estado]}
                      </span>
                      {p.estado === 'propuesto' && (
                        <button onClick={() => handleWithdraw(p.project_id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 flex-shrink-0" title="Retirar propuesta">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
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
