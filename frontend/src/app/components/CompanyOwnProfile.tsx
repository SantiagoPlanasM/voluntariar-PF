import { useEffect, useRef, useState } from 'react';
import { Loader2, Menu, Pencil, Plus, Save, X, Sprout, Send, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, Empresa, Patrocinio, Project } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { formatMoney, userMessage } from '../../lib/format';
import {
  POINT_TYPE_LABEL, PointFormValue, SPONSORSHIP_BADGE, SPONSORSHIP_LABEL, editPointForm, formFields, newPointForm,
} from '../../lib/sponsorship';
import { Draft, addPoint, editPoint, emptyDraft, newId, removePoint, toPoints } from '../../lib/sponsorshipDraft';
import { InlineError } from './LoadError';
import { SponsorshipPointForm } from './SponsorshipPointForm';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';
import { ProfileHeader } from '../ui/ProfileHeader';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/UiProvider';
import { PROFILE_FIELD } from '../ui/fieldStyles';

// Tope del listado de proyectos para proponer. Sin `limit` el backend devuelve 20 y los demás no se podían
// patrocinar (REVISION F6). GET /projects no tiene paginación (deuda conocida): el camino principal es
// `?proponer=<id>` desde el botón "Patrocinar este proyecto", que no depende de este tope.
const MAX_PROPOSABLE = '500';
// §329: el tope de puntos por lado del acuerdo (lo impone el backend; acá solo se deja de ofrecer "Agregar punto").
const MAX_POINTS = 20;

const CATEGORIES = ['Medio Ambiente','Educación','Salud','Animales','Alimentación','Tecnología','Arte y Cultura','Deportes'];

export function CompanyOwnProfile() {
  const { logout } = useAuth();
  const navigate    = useNavigate();
  const confirm     = useConfirm();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', mission: '', location: '', industry: '', category: '' });

  const [patrocinios, setPatrocinios] = useState<Patrocinio[]>([]);
  const [patrociniosError, setPatrociniosError] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [showPropose, setShowPropose] = useState(false);
  const [proposeProjectId, setProposeProjectId] = useState('');
  const [proposeMsg, setProposeMsg] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposeErr, setProposeErr] = useState('');
  // §329: los puntos de la propuesta, en un borrador como el del acuerdo (acá solo hay agregados), y su formulario.
  const [proposePoints, setProposePoints] = useState<Draft>(emptyDraft);
  const [pointForm, setPointForm] = useState<PointFormValue | null>(null);
  const nextPointKey = useRef(0);
  // ?proponer=<id> (desde ProjectDetails): abrir el formulario con ese proyecto ya elegido, una sola vez.
  const [searchParams] = useSearchParams();
  const preselectId = searchParams.get('proponer');
  const preselectDone = useRef(false);

  useEffect(() => { void load(); void loadPatrocinios(); }, []);

  const loadPatrocinios = async () => {
    setPatrociniosError('');
    try {
      const [{ patrocinios: p }, { projects }] = await Promise.all([
        api.empresas.patrocinios.list(),
        api.projects.list({ status: 'active', limit: MAX_PROPOSABLE }),
      ]);
      setPatrocinios(p);
      // Ofrecer para proponer solo proyectos sin propuesta vigente (propuesta o aceptada)
      const yaPropuestos = new Set(p.filter(x => x.estado !== 'rechazado').map(x => x.project_id));
      const disponibles = projects.filter(pr => !yaPropuestos.has(pr.id));
      setActiveProjects(disponibles);
      if (preselectId && !preselectDone.current) {
        preselectDone.current = true;
        await preselect(preselectId, disponibles, yaPropuestos);
      }
    } catch (e) {
      // Antes se tragaba y se veía "Todavía no hay patrocinios" (REVISION F9).
      setPatrociniosError(userMessage(e, 'No pudimos cargar tus patrocinios. Revisá tu conexión.'));
    }
  };

  const preselect = async (id: string, disponibles: Project[], yaPropuestos: Set<string>) => {
    setShowPropose(true);
    if (yaPropuestos.has(id)) { setProposeErr('Ya tenés una propuesta vigente para este proyecto.'); return; }
    if (disponibles.some(pr => pr.id === id)) { setProposeProjectId(id); return; }
    // No vino en el listado (más allá del tope): se trae aparte.
    try {
      const { project } = await api.projects.get(id);
      if (project.status !== 'active') { setProposeErr('Ese proyecto no está activo: no se puede patrocinar.'); return; }
      setActiveProjects(prev => [project, ...prev]);
      setProposeProjectId(id);
    } catch (e) {
      setProposeErr(userMessage(e, 'No pudimos cargar ese proyecto. Revisá tu conexión.'));
    }
  };

  const handlePropose = async () => {
    if (!proposeProjectId) { setProposeErr('Elegí un proyecto'); return; }
    if (pointForm) { setProposeErr('Terminá o cancelá el punto que estás escribiendo antes de enviar.'); return; }
    setProposing(true); setProposeErr('');
    try {
      const points = toPoints(proposePoints);
      // Sin puntos, el pedido de siempre (sin `points`).
      if (points.length > 0) await api.empresas.patrocinios.propose(proposeProjectId, proposeMsg || undefined, points);
      else await api.empresas.patrocinios.propose(proposeProjectId, proposeMsg || undefined);
      setShowPropose(false); setProposeProjectId(''); setProposeMsg(''); setProposePoints(emptyDraft());
      void loadPatrocinios();
    } catch (e: any) { setProposeErr(e.message); }
    finally { setProposing(false); }
  };

  /** "Listo" del formulario de un punto: va al borrador de la propuesta (no se manda nada todavía). */
  const applyPoint = () => {
    if (!pointForm) return;
    if (!pointForm.detail.trim()) { setProposeErr('El detalle no puede estar vacío'); return; }
    setProposeErr('');
    const fields = formFields(pointForm);
    setProposePoints(d => (pointForm.id
      ? editPoint(d, undefined, pointForm.id, fields)
      : addPoint(d, String(++nextPointKey.current), fields)));
    setPointForm(null);
  };
  const cancelPoint = () => { setPointForm(null); setProposeErr(''); };
  /** La propuesta rechazada del proyecto elegido, si hay: volver a proponer la reabre con sus puntos. */
  const previousRejected = patrocinios.find(x => x.project_id === proposeProjectId && x.estado === 'rechazado');

  const handleWithdraw = async (p: Patrocinio) => {
    const ok = await confirm({
      title: `¿Retirar la propuesta para ${p.project_title}?`,
      body: 'La ONG deja de verla. Podés volver a proponer después.',
      confirmLabel: 'Retirar propuesta', danger: true,
    });
    if (!ok) return;
    setWithdrawError('');
    try { await api.empresas.patrocinios.withdraw(p.project_id); void loadPatrocinios(); }
    catch (e) { setWithdrawError(userMessage(e, 'No se pudo retirar la propuesta. Revisá tu conexión y probá de nuevo.')); }
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
    try { await api.empresas.update(form); setEditing(false); void load(); }
    catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    // Esqueleto con la forma del perfil (logo cuadrado, nombre, texto y la lista de patrocinios), como el de la ONG (§335).
    <div role="status" aria-label="Cargando perfil" className="min-h-screen bg-canvas-soft">
      <div aria-hidden="true" className="w-full max-w-[640px] mx-auto p-4 md:pt-8 flex flex-col gap-4">
        <div className="flex items-center gap-4"><div className="w-[88px] h-[88px] flex-shrink-0 rounded-[28%] skeleton" /><div className="flex-1 h-10 rounded skeleton" /></div>
        <div className="h-4 w-1/2 rounded skeleton" /><div className="h-11 rounded-[10px] skeleton" /><div className="h-40 rounded-xl skeleton" />
      </div>
    </div>
  );
  if (!empresa) return null;

  const inp = PROFILE_FIELD;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline pb-4">
          <ProfileHeader
            name={empresa.name}
            avatar={empresa.logo}
            kind="org"
            subtitle={[empresa.industry, empresa.location].filter(Boolean).join(' · ')}
            bio={editing ? undefined : [empresa.description, empresa.mission ? `Misión de RSE: ${empresa.mission}` : ''].filter(Boolean).join('\n\n')}
            stats={[
              { n: patrocinios.filter(p => p.estado === 'aceptado').length, label: 'Patrocinios' },
              { n: empresa.followers ?? 0, label: 'Seguidores' },
            ]}
            corner={(
              <Link to="/settings" aria-label="Configuración" className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-surface-soft">
                <Menu size={24} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            )}
            actions={(
              <Button variant="secondary" className="flex-1" onClick={() => { setEditing(!editing); setSaveErr(''); }} aria-label={editing ? 'Cancelar edición' : 'Editar perfil'}>
                {editing ? 'Cancelar' : 'Editar perfil'}
              </Button>
            )}
          />
          {editing && <div className="px-4 pt-4"><ProfilePhotoPicker onUploaded={(url) => setEmpresa((e) => (e ? { ...e, logo: url } : e))} /></div>}
        </div>
      </div>

      <div className="max-w-[640px] mx-auto p-4 space-y-4">
        {editing ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <h2 className="font-bold text-sm text-gray-900">Editar información</h2>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Nombre *</p>
              <input className={inp} placeholder="Nombre de la empresa" aria-label="Nombre" value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveErr(''); }} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Industria / Rubro</p>
              <input className={inp} placeholder="Ej: Tecnología, Retail, Alimentos" aria-label="Industria / Rubro" value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Categoría de interés</p>
              <select className={inp} aria-label="Categoría de interés" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Sin especificar</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Ubicación</p>
              <input className={inp} placeholder="Ej: Córdoba, Argentina" aria-label="Ubicación" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Descripción</p>
              <textarea className={inp + ' resize-none'} rows={3} aria-label="Descripción" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Misión de RSE</p>
              <textarea className={inp + ' resize-none'} rows={2} aria-label="Misión de RSE" value={form.mission}
                onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} />
            </div>

            {saveErr && <p className="text-sm bg-surface-soft text-critical px-3 py-2 rounded-xl">{saveErr}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-ink text-on-ink rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-[opacity]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        ) : (
          <>
            {/* La descripción y la misión de RSE se ven en el encabezado (ProfileHeader, bio). */}

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
                  {proposeErr && <p className="text-xs text-critical">{proposeErr}</p>}
                  {activeProjects.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay proyectos activos disponibles para proponer ahora mismo.</p>
                  ) : (
                    <>
                      <select
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        aria-label="Proyecto a patrocinar" value={proposeProjectId} onChange={e => setProposeProjectId(e.target.value)}
                      >
                        <option value="">Elegí un proyecto...</option>
                        {activeProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <textarea
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                        rows={2} placeholder="Mensaje para la ONG (opcional)"
                        aria-label="Mensaje para la ONG" value={proposeMsg} onChange={e => setProposeMsg(e.target.value)}
                      />
                      {/* §329: lo que la empresa propone aportar, con el formulario del acuerdo. Va con la propuesta. */}
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-bold text-ink-soft">Qué proponés aportar (opcional)</p>
                        {/* Re-proponer conserva los puntos del acuerdo rechazado (routes/empresas.js): se avisa. */}
                        {previousRejected && (
                          <p className="text-xs text-ink-soft">
                            La ONG rechazó tu propuesta anterior para este proyecto. Los puntos de ese acuerdo se mantienen: lo que agregues acá se suma.{' '}
                            <Link to={`/company/patrocinios/${previousRejected.empresa_id}/${previousRejected.project_id}`} className="font-semibold text-ink underline">
                              Ver el acuerdo anterior
                            </Link>
                          </p>
                        )}
                        {proposePoints.adds.length > 0 && (
                          <ul aria-label="Puntos de la propuesta" className="bg-surface border border-hairline rounded-xl divide-y divide-hairline">
                            {proposePoints.adds.map(pt => {
                              const id = newId(pt.key);
                              if (pointForm?.id === id) {
                                return (
                                  <li key={id} className="p-2">
                                    <SponsorshipPointForm value={pointForm} onChange={setPointForm} onDone={applyPoint} onCancel={cancelPoint} />
                                  </li>
                                );
                              }
                              return (
                                <li key={id} className="pl-3 pr-1 py-2 flex items-start gap-2">
                                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                    <span className="text-xs font-semibold text-ink-soft">{POINT_TYPE_LABEL[pt.type]}</span>
                                    <p className="text-sm text-ink break-words">{pt.detail}</p>
                                    {pt.amount != null && <p className="text-sm font-bold text-brand-text">{formatMoney(pt.amount)}</p>}
                                  </div>
                                  <div className="flex flex-shrink-0">
                                    <button type="button" aria-label={`Editar punto: ${pt.detail}`}
                                      onClick={() => { setPointForm(editPointForm({ ...pt, id })); setProposeErr(''); }}
                                      className="w-11 h-11 flex-shrink-0 rounded-full hover:bg-surface-pressed inline-flex items-center justify-center text-ink-soft">
                                      <Pencil size={16} aria-hidden="true" />
                                    </button>
                                    <button type="button" aria-label={`Borrar punto: ${pt.detail}`}
                                      onClick={() => setProposePoints(d => removePoint(d, id))}
                                      className="w-11 h-11 flex-shrink-0 rounded-full hover:bg-surface-pressed inline-flex items-center justify-center text-critical">
                                      <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {pointForm && !pointForm.id && (
                          <SponsorshipPointForm value={pointForm} onChange={setPointForm} onDone={applyPoint} onCancel={cancelPoint} />
                        )}
                        {!pointForm && (proposePoints.adds.length < MAX_POINTS ? (
                          <button type="button" onClick={() => { setPointForm(newPointForm()); setProposeErr(''); }}
                            className="self-start h-11 px-4 rounded-[10px] bg-surface border border-hairline text-sm font-semibold text-ink inline-flex items-center gap-1.5">
                            <Plus size={16} aria-hidden="true" />Agregar punto
                          </button>
                        ) : (
                          <p className="text-xs text-ink-soft">Llegaste al máximo de {MAX_POINTS} puntos.</p>
                        ))}
                      </div>
                      <button onClick={handlePropose} disabled={proposing}
                        className="w-full py-2 bg-ink text-on-ink rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-[opacity]">
                        {proposing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Enviar propuesta
                      </button>
                    </>
                  )}
                </div>
              )}

              {withdrawError && <p role="alert" className="mx-4 mt-3 text-sm bg-surface-soft text-critical rounded-xl px-3 py-2">{withdrawError}</p>}
              {patrociniosError ? (
                <div className="p-4"><InlineError message={patrociniosError} onRetry={loadPatrocinios} /></div>
              ) : patrocinios.length === 0 ? (
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
                        <Link to={`/company/patrocinios/${p.empresa_id}/${p.project_id}`} className="text-xs font-semibold text-ink underline">
                          Ver acuerdo
                        </Link>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${SPONSORSHIP_BADGE[p.estado]}`}>
                        {SPONSORSHIP_LABEL[p.estado]}
                      </span>
                      {p.estado === 'propuesto' && (
                        <button onClick={() => handleWithdraw(p)}
                          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-red-50 flex-shrink-0" title="Retirar propuesta">
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
        {/* §178 */}
      </div>
    </div>
  );
}
