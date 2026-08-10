import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Plus, Trash2, Edit2, X, Save, Loader2, BarChart2, TrendingUp } from 'lucide-react';
import { api, KPI } from '../../lib/api';

const TIPO_COLORS: Record<string, string> = {
  numero:     'bg-blue-50 text-blue-700',
  porcentaje: 'bg-violet-50 text-violet-700',
  texto:      'bg-gray-100 text-gray-600',
  booleano:   'bg-emerald-50 text-emerald-700',
};

const TIPO_LABELS: Record<string, string> = {
  numero: 'Número', porcentaje: 'Porcentaje', texto: 'Texto', booleano: 'Sí/No',
};

function formatValor(kpi: KPI): string {
  if (kpi.valor === null || kpi.valor === undefined) return '—';
  if (kpi.tipo_valor === 'porcentaje') return `${kpi.valor}%`;
  if (kpi.tipo_valor === 'booleano')   return kpi.valor ? 'Sí ✓' : 'No ✗';
  return `${kpi.valor}${kpi.unidad ? ' ' + kpi.unidad : ''}`;
}

export function NGOKPIs() {
  const { projectId } = useParams();
  const navigate       = useNavigate();
  const [kpis, setKpis]       = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KPI | null>(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [projectTitle, setProjectTitle] = useState('');

  const emptyForm = { nombre: '', descripcion: '', valor: '', tipo_valor: 'numero', unidad: '', fecha: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!projectId) return;
    api.projects.get(projectId).then(({ project }) => setProjectTitle(project.title || '')).catch(() => {});
    load();
  }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { kpis } = await api.projects.kpis.list(projectId!);
      setKpis(kpis || []);
    } catch { setKpis([]); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!form.nombre.trim()) { setErr('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        valor: form.valor !== '' ? parseFloat(form.valor) : undefined,
        tipo_valor: form.tipo_valor,
        unidad: form.unidad.trim() || undefined,
        fecha: form.fecha || undefined,
      };
      if (editing) await api.projects.kpis.update(projectId!, editing.id, body);
      else await api.projects.kpis.create(projectId!, body);
      setForm(emptyForm); setShowForm(false); setEditing(null); load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleEdit = (kpi: KPI) => {
    setEditing(kpi);
    setForm({
      nombre:      kpi.nombre,
      descripcion: kpi.descripcion || '',
      valor:       kpi.valor !== null && kpi.valor !== undefined ? String(kpi.valor) : '',
      tipo_valor:  kpi.tipo_valor,
      unidad:      kpi.unidad || '',
      fecha:       kpi.fecha || '',
    });
    setShowForm(true); setErr('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este KPI?')) return;
    try { await api.projects.kpis.delete(projectId!, id); setKpis(kpis.filter(k => k.id !== id)); }
    catch (e: any) { alert(e.message); }
  };

  const cancelForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setErr(''); };

  const inp = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  // Calcular resumen
  const numericKPIs = kpis.filter(k => k.tipo_valor === 'numero' || k.tipo_valor === 'porcentaje');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">KPIs de Impacto</h1>
              {projectTitle && <p className="text-xs text-gray-400 truncate max-w-[200px]">{projectTitle}</p>}
            </div>
          </div>
          <button
            onClick={() => { cancelForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
            <Plus className="w-3.5 h-3.5" />Agregar KPI
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* Resumen visual */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-2xl font-black text-blue-600">{kpis.length}</p>
              <p className="text-xs text-gray-500">KPIs totales</p>
            </div>
            {numericKPIs.slice(0, 3).map(k => (
              <div key={k.id} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                <p className="text-xl font-black text-emerald-600 truncate">{formatValor(k)}</p>
                <p className="text-xs text-gray-500 truncate">{k.nombre}</p>
              </div>
            ))}
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-900">
                {editing ? 'Editar KPI' : 'Nuevo KPI'}
              </h2>
              <button type="button" onClick={cancelForm}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre *</label>
              <input className={inp} placeholder="Ej: Árboles plantados, Familias beneficiadas"
                value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Descripción</label>
              <input className={inp} placeholder="Qué mide este indicador"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo</label>
                <select className={inp} value={form.tipo_valor}
                  onChange={e => setForm(f => ({ ...f, tipo_valor: e.target.value }))}>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  {form.tipo_valor === 'booleano' ? 'Logrado (1=Sí, 0=No)' : 'Valor'}
                </label>
                <input className={inp}
                  type={form.tipo_valor === 'texto' ? 'text' : 'number'}
                  placeholder={form.tipo_valor === 'porcentaje' ? '85' : form.tipo_valor === 'booleano' ? '1 o 0' : '500'}
                  value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Unidad</label>
                <input className={inp} placeholder="árboles, familias, hs..."
                  value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Fecha de medición</label>
                <input className={inp} type="date"
                  value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>

            {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}

            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editing ? 'Guardar cambios' : 'Agregar KPI'}
            </button>
          </form>
        )}

        {/* Lista de KPIs */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : kpis.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-gray-100">
            <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-medium text-gray-400">Sin KPIs todavía</p>
            <p className="text-sm text-gray-300 mt-1">
              Agregá indicadores para medir el impacto del proyecto
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {kpis.map(kpi => (
                <div key={kpi.id} className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{kpi.nombre}</p>
                        {kpi.descripcion && (
                          <p className="text-xs text-gray-500 mt-0.5">{kpi.descripcion}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => handleEdit(kpi)}
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(kpi.id)}
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xl font-black text-emerald-600">{formatValor(kpi)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TIPO_COLORS[kpi.tipo_valor]}`}>
                        {TIPO_LABELS[kpi.tipo_valor]}
                      </span>
                      {kpi.fecha && (
                        <span className="text-xs text-gray-400">
                          {new Date(kpi.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
