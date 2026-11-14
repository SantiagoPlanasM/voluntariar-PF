// Impacto de un voluntariado (/ngo/kpis/:projectId): los indicadores (KPIs) que carga la ONG. Pantalla de panel
// (DESIGN.md → Paneles de gestión y "Reportes de impacto"): fondo `canvas-soft`, bloques `surface` con borde
// `hairline`, los números importantes como texto grande y sin colores por tipo. El gráfico por mes y "Publicar como
// dato de impacto" del diseño no están hechos.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, KPI } from '../../lib/api';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { formatDateOnly, userMessage } from '../../lib/format';
import { Button } from '../ui/Button';
import { PROFILE_FIELD } from '../ui/fieldStyles';
import { useConfirm, useToast } from '../ui/UiProvider';
import { InlineError } from './LoadError';

// Etiquetas de todos los tipos (los KPIs de tipo 'texto' que ya existían se siguen mostrando)…
const TIPO_LABELS: Record<string, string> = {
  numero: 'Número', porcentaje: 'Porcentaje', texto: 'Texto', booleano: 'Sí/No',
};
// …pero para crear o editar solo se ofrecen los numéricos: 'texto' se guardaba vacío (kpis.valor es numérica;
// REVISION F3, decisión del usuario, PROJECT_ANALYSIS.md §90).
const TIPOS_EDITABLES = ['numero', 'porcentaje', 'booleano'];

const BLOCK = 'rounded-xl bg-surface border border-hairline';
const LABEL = 'text-[13px] font-semibold text-ink-soft mb-1 block';
const ICON_BUTTON = 'w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-surface-soft transition-colors';

function formatValor(kpi: KPI): string {
  if (kpi.valor === null || kpi.valor === undefined) return '—';
  if (kpi.tipo_valor === 'porcentaje') return `${kpi.valor}%`;
  if (kpi.tipo_valor === 'booleano')   return kpi.valor ? 'Sí' : 'No';
  return `${kpi.valor}${kpi.unidad ? ' ' + kpi.unidad : ''}`;
}

export function NGOKPIs() {
  const { projectId } = useParams();
  const navigate       = useNavigate();
  const confirm        = useConfirm();
  const toast          = useToast();
  const [kpis, setKpis]       = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KPI | null>(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [loadError, setLoadError] = useState('');

  const emptyForm = { nombre: '', descripcion: '', valor: '', tipo_valor: 'numero', unidad: '', fecha: '' };
  const [form, setForm] = useState(emptyForm);

  // Solo vale la respuesta del último pedido (al cambiar de proyecto, reintentar o recargar tras guardar): F15, §89.
  const latest = useLatestRequest();
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false; // el título del proyecto anterior no pisa al del actual
    api.projects.get(projectId).then(({ project }) => { if (!cancelled) setProjectTitle(project.title || ''); }).catch(() => {});
    void load();
    return () => { cancelled = true; };
  }, [projectId]);

  const load = async () => {
    const req = latest.start();
    setLoading(true);
    setLoadError('');
    try {
      const { kpis } = await api.projects.kpis.list(projectId!);
      if (latest.isLatest(req)) setKpis(kpis || []);
    } catch (e) { if (latest.isLatest(req)) { setKpis([]); setLoadError(userMessage(e, 'No pudimos cargar los KPIs. Revisá tu conexión.')); } } // antes: "Sin KPIs todavía" (F9)
    finally { if (latest.isLatest(req)) setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!form.nombre.trim()) { setErr('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        valor: form.valor !== '' ? Number.parseFloat(form.valor) : undefined,
        tipo_valor: form.tipo_valor,
        unidad: form.unidad.trim() || undefined,
        fecha: form.fecha || undefined,
      };
      if (editing) await api.projects.kpis.update(projectId!, editing.id, body);
      else await api.projects.kpis.create(projectId!, body);
      setForm(emptyForm); setShowForm(false); setEditing(null); void load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleEdit = (kpi: KPI) => {
    setEditing(kpi);
    setForm({
      nombre:      kpi.nombre,
      descripcion: kpi.descripcion || '',
      valor:       kpi.valor !== null && kpi.valor !== undefined ? String(kpi.valor) : '',
      tipo_valor:  TIPOS_EDITABLES.includes(kpi.tipo_valor) ? kpi.tipo_valor : 'numero',
      unidad:      kpi.unidad || '',
      fecha:       kpi.fecha || '',
    });
    setShowForm(true); setErr('');
  };

  const handleDelete = async (kpi: KPI) => {
    const ok = await confirm({ title: `¿Borrar el indicador ${kpi.nombre}?`, body: 'No se puede deshacer.', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    try { await api.projects.kpis.delete(projectId!, kpi.id); setKpis(prev => prev.filter(k => k.id !== kpi.id)); }
    catch (e) { toast(userMessage(e, 'No se pudo borrar. Revisá tu conexión y probá de nuevo.'), { kind: 'error' }); }
  };

  const cancelForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setErr(''); };

  // Arriba, los números (hasta cuatro): los indicadores numéricos, en grande.
  const numericKPIs = kpis.filter(k => k.tipo_valor === 'numero' || k.tipo_valor === 'porcentaje').slice(0, 4);
  const valorLabel = form.tipo_valor === 'booleano' ? 'Logrado (1=Sí, 0=No)' : 'Valor';

  return (
    <div className="min-h-screen bg-canvas-soft pb-28">
      <div className="w-full max-w-[880px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-4">
        <header className="flex items-center gap-1 -ml-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Volver" className={ICON_BUTTON}>
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">Impacto</h1>
            {projectTitle && <p className="text-[13px] text-ink-muted truncate">{projectTitle}</p>}
          </div>
          <Button variant="primary" className="flex-shrink-0" onClick={() => { cancelForm(); setShowForm(true); }}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />Agregar KPI
          </Button>
        </header>

        {numericKPIs.length > 0 && (
          <dl className={`${BLOCK} grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 p-4`}>
            {numericKPIs.map(k => (
              <div key={k.id} className="min-w-0 flex flex-col-reverse">
                <dt className="text-[13px] text-ink-soft truncate">{k.nombre}</dt>
                <dd className="text-2xl font-extrabold tracking-[-0.4px] truncate">{formatValor(k)}</dd>
              </div>
            ))}
          </dl>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className={`${BLOCK} p-4 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-[-0.2px]">{editing ? 'Editar KPI' : 'Nuevo KPI'}</h2>
              <button type="button" onClick={cancelForm} aria-label="Cerrar formulario" className={`${ICON_BUTTON} -mr-2`}>
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>

            <div>
              <label htmlFor="kpi-nombre" className={LABEL}>Nombre *</label>
              <input id="kpi-nombre" className={PROFILE_FIELD} placeholder="Ej: Árboles plantados, Familias beneficiadas"
                aria-label="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>

            <div>
              <label htmlFor="kpi-descripcion" className={LABEL}>Descripción</label>
              <input id="kpi-descripcion" className={PROFILE_FIELD} placeholder="Qué mide este indicador"
                aria-label="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="kpi-tipo" className={LABEL}>Tipo</label>
                <select id="kpi-tipo" className={PROFILE_FIELD} aria-label="Tipo" value={form.tipo_valor}
                  onChange={e => setForm(f => ({ ...f, tipo_valor: e.target.value }))}>
                  {TIPOS_EDITABLES.map(v => <option key={v} value={v}>{TIPO_LABELS[v]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="kpi-valor" className={LABEL}>{valorLabel}</label>
                <input id="kpi-valor" className={PROFILE_FIELD}
                  type="number"
                  placeholder={form.tipo_valor === 'porcentaje' ? '85' : form.tipo_valor === 'booleano' ? '1 o 0' : '500'}
                  aria-label={valorLabel} value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="kpi-unidad" className={LABEL}>Unidad</label>
                <input id="kpi-unidad" className={PROFILE_FIELD} placeholder="árboles, familias, hs..."
                  aria-label="Unidad" value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="kpi-fecha" className={LABEL}>Fecha de medición</label>
                <input id="kpi-fecha" className={PROFILE_FIELD} type="date"
                  aria-label="Fecha de medición" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>

            {err && <p role="alert" className="text-[13px] bg-surface-soft text-critical px-3 py-2 rounded-xl">{err}</p>}

            <Button type="submit" variant="primary" block busy={saving} busyLabel="Guardando…">
              {editing ? 'Guardar cambios' : 'Agregar KPI'}
            </Button>
          </form>
        )}

        {loading ? (
          // Esqueleto con la forma de la lista: nombre, valor y los dos botones de cada indicador.
          <div role="status" aria-label="Cargando KPIs" className={`${BLOCK} divide-y divide-hairline`}>
            {[0, 1, 2].map(i => (
              <div key={i} aria-hidden="true" className="p-4 flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-2"><div className="h-4 w-1/2 rounded skeleton" /><div className="h-6 w-1/4 rounded skeleton" /></div>
                <div className="w-20 h-9 rounded-[10px] skeleton" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <InlineError message={loadError} onRetry={load} />
        ) : kpis.length === 0 ? (
          <div className={`${BLOCK} text-center py-12 px-4`}>
            <p className="text-[15px] font-semibold">Sin KPIs todavía</p>
            <p className="text-[15px] text-ink-soft mt-1">Agregá indicadores para medir el impacto del voluntariado.</p>
          </div>
        ) : (
          <ul className={`${BLOCK} divide-y divide-hairline`}>
            {kpis.map(kpi => (
              <li key={kpi.id} className="p-4 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold break-words">{kpi.nombre}</p>
                  {kpi.descripcion && <p className="text-[13px] text-ink-soft break-words">{kpi.descripcion}</p>}
                  <p className="flex items-baseline gap-x-2 flex-wrap mt-1">
                    <span className="text-xl font-extrabold tracking-[-0.3px]">{formatValor(kpi)}</span>
                    <span className="text-[13px] text-ink-soft">{TIPO_LABELS[kpi.tipo_valor]}</span>
                    {kpi.fecha && <span className="text-[13px] text-ink-muted">{formatDateOnly(kpi.fecha)}</span>}
                  </p>
                </div>
                <div className="flex items-center flex-shrink-0 -mr-2">
                  <button type="button" onClick={() => handleEdit(kpi)} aria-label={`Editar KPI ${kpi.nombre}`} className={ICON_BUTTON}>
                    <Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => handleDelete(kpi)} aria-label={`Borrar KPI ${kpi.nombre}`} className={`${ICON_BUTTON} text-critical`}>
                    <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
