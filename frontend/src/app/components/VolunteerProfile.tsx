// Perfil propio del voluntario (DESIGN.md → Perfiles): arriba la identidad (avatar, tres estadísticas, bio y
// botones) y abajo el contenido en pestañas. El CV, el tema, "Cerrar sesión" y "Borrar mi cuenta" viven en
// Configuración (/settings), no en el medio del perfil.
import { useAuth } from '../../lib/AuthContext';
import { Loader2, Menu, Save } from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { api, EnrollmentWithProject, SkillCatalogItem, VolunteerSkill, NGO, VolunteerPublic } from '../../lib/api';
import { FollowListModal, FollowListMode } from './FollowListModal';
import { InlineError } from './LoadError';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';
import { MomentsGrid } from './MomentsGrid';
import { userMessage } from '../../lib/format';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useToast } from '../ui/UiProvider';

/** Cada carga del perfil, para saber cuál falló. */
type Part = 'enrollments' | 'catalog' | 'skills' | 'ngos' | 'following' | 'followers';
type TabKey = 'posts' | 'volunteering' | 'ngos';

const NAME_RE = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;
const NIVEL_LABELS: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export function VolunteerProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [enrollments, setEnrollments] = useState<EnrollmentWithProject[]>([]);
  const [myNgos, setMyNgos]           = useState<NGO[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveErr, setSaveErr]         = useState('');
  const [form, setForm] = useState({ name: '', bio: '', location: '' });
  const [tab, setTab] = useState<TabKey>('volunteering');

  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogItem[]>([]);
  const [mySkills, setMySkills]         = useState<VolunteerSkill[]>([]);
  const [draftSkills, setDraftSkills]   = useState<{ habilidad_id: string; nivel: string }[]>([]);

  const [myFollowerCount, setMyFollowerCount] = useState(0);
  const [myFollowingCount, setMyFollowingCount] = useState(0);
  const [myFollowingVols, setMyFollowingVols] = useState<VolunteerPublic[]>([]);

  const [listMode, setListMode] = useState<FollowListMode | null>(null);

  // Errores de carga (REVISION S1): antes se tragaban y se veían "Todavía no…" y contadores en 0. Un solo
  // aviso con "Reintentar" (recarga todo) y, en cada parte que falló, "—" o "No se pudo cargar." en vez del vacío.
  const [failed, setFailed] = useState<ReadonlySet<Part>>(new Set());
  const [loadErr, setLoadErr] = useState('');
  const latest = useLatestRequest();

  const loadAll = () => {
    const req = latest.start();
    setFailed(new Set()); setLoadErr(''); setLoading(true);
    // Solo se descarta el error de un pedido viejo (marcaría como fallida una parte que el reintento ya
    // cargó). Una respuesta vieja exitosa es un dato válido del mismo endpoint: no hace falta descartarla.
    const fail = (part: Part) => (e: unknown) => {
      if (!latest.isLatest(req)) return;
      setFailed(s => new Set(s).add(part));
      setLoadErr(prev => prev || userMessage(e, 'No pudimos cargar parte de tu perfil. Revisá tu conexión.'));
    };
    api.enrollments.my()
      .then(r => setEnrollments(r.enrollments))
      .catch(fail('enrollments'))
      .finally(() => setLoading(false));
    api.catalog.habilidades().then(r => setSkillCatalog(r.habilidades)).catch(fail('catalog'));
    api.voluntarios.habilidades.list().then(r => setMySkills(r.habilidades)).catch(fail('skills'));
    api.follows.myNgos().then(r => setMyNgos(r.ngos)).catch(fail('ngos'));
    api.follows.myFollowing().then(r => {
      setMyFollowingVols(r.volunteers);
      setMyFollowingCount(r.volunteers.length);
    }).catch(fail('following'));
    api.follows.myFollowers().then(r => setMyFollowerCount(r.volunteers.length)).catch(fail('followers'));
  };

  useEffect(() => {
    if (!user) return;
    if (user.role === 'ngo') {
      navigate('/ngo/profile', { replace: true });
      return;
    }
    if (user.role === 'company') {
      navigate('/company/profile', { replace: true });
      return;
    }
    setForm({ name: user.name || '', bio: user.bio || '', location: user.location || '' });
    loadAll();
  }, [user]);

  // Sin el catálogo o sin mis habilidades, el borrador arrancaría vacío y guardar las borraría todas.
  const skillsUnavailable = failed.has('skills') || failed.has('catalog');

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
      if (!skillsUnavailable) {
        const { habilidades } = await api.voluntarios.habilidades.update(draftSkills);
        setMySkills(habilidades);
      }
      setEditing(false);
      // Refrescar el usuario en contexto
      window.location.reload();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const handleShare = async () => {
    if (!user) return;
    const url = `${window.location.origin}/volunteer/${user.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: user.name, url }); return; }
      await navigator.clipboard.writeText(url);
      toast('Link de tu perfil copiado');
    } catch { /* la persona canceló */ }
  };

  const upcoming = useMemo(() => enrollments.filter(e => e.status === 'approved' && e.project_status === 'active'), [enrollments]);
  const done = useMemo(() => enrollments.filter(e => e.status === 'approved' && e.project_status !== 'active'), [enrollments]);

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-canvas">
      <p className="text-[15px] text-ink-soft">No estás logueado</p>
      <Link to="/" className="text-[15px] font-semibold">Ir al inicio</Link>
    </div>
  );

  /** Contador que se muestra: "—" si su carga falló (un 0 se leería como dato). */
  const count = (part: Part, n: number) => (failed.has(part) ? '—' : n);
  const notLoaded = <p className="text-[13px] text-ink-muted py-6 text-center">No se pudo cargar.</p>;
  const approved = count('enrollments', enrollments.filter(e => e.status === 'approved').length);
  const inp = 'w-full h-12 px-3.5 rounded-[10px] bg-surface-soft text-[15px] border-[1.5px] border-transparent focus:bg-surface focus:border-ink outline-none';

  const stat = (n: number | string, label: string, onClick?: () => void) => {
    const inner = (<><span className="text-[15px] font-bold">{n}</span><span className="text-xs font-semibold text-ink-soft">{label}</span></>);
    return onClick
      ? <button type="button" onClick={onClick} className="flex-1 flex flex-col items-center gap-0.5 min-h-11 justify-center">{inner}</button>
      : <div className="flex-1 flex flex-col items-center gap-0.5 min-h-11 justify-center">{inner}</div>;
  };

  const projectRow = (e: EnrollmentWithProject) => (
    <li key={e.id}>
      <Link to={`/project/${e.project_id}`} className="flex items-center gap-3 min-h-[72px]">
        {e.image
          ? <img src={e.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-surface-soft" />
          : <span className="w-14 h-14 rounded-xl bg-surface-soft flex-shrink-0" aria-hidden="true" />}
        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-snug line-clamp-2">{e.title}</span>
          <span className="text-[13px] text-ink-muted truncate">{e.ngo_name}</span>
        </span>
      </Link>
    </li>
  );

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline">
          <header className="h-[52px] pl-4 pr-1 flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-[-0.2px] truncate">{user.name}</h1>
            <Link to="/settings" aria-label="Configuración" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
              <Menu size={24} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </header>

          <div className="px-4 pt-2 flex items-center gap-4">
            <Avatar src={user.avatar} name={user.name} size={88} alt={user.name} />
            <div className="flex-1 flex" role="group" aria-label="Estadísticas">
              {stat(approved, 'Voluntariados')}
              {stat(count('followers', myFollowerCount), 'Seguidores', () => setListMode('followers'))}
              {stat(count('following', myFollowingCount), 'Siguiendo', () => setListMode('following'))}
            </div>
          </div>

          <div className="px-4 pt-3 flex flex-col gap-1.5">
            <p className="text-[15px] font-semibold">{user.name}</p>
            {!editing && user.bio && <p className="text-[15px] leading-[1.45] whitespace-pre-line">{user.bio}</p>}
            <p className="text-[13px] text-ink-muted">{[user.location, user.email].filter(Boolean).join(' · ')}</p>
            {!editing && (mySkills.length > 0 || failed.has('skills')) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {failed.has('skills') && <span className="text-[13px] text-ink-muted">No se pudieron cargar las habilidades.</span>}
                {mySkills.map(s => (
                  <span key={s.id} className="h-8 px-3 rounded-full bg-surface-soft text-xs font-semibold inline-flex items-center">
                    {s.nombre} · {NIVEL_LABELS[s.nivel]}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setEditing(e => !e); setSaveErr(''); }} aria-label={editing ? 'Cancelar edición' : 'Editar perfil'}>
              {editing ? 'Cancelar' : 'Editar perfil'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={handleShare}>Compartir perfil</Button>
          </div>

          {loadErr && <div className="px-4 pt-4"><InlineError message={loadErr} onRetry={loadAll} /></div>}

          {/* Editar perfil */}
          {editing && (
            <div className="mx-4 mt-4 rounded-xl bg-surface-soft p-4 flex flex-col gap-4">
              <h2 className="text-[15px] font-bold">Editar perfil</h2>
              <ProfilePhotoPicker />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="perfil-nombre" className="text-xs font-semibold text-ink-soft">Nombre completo *</label>
                <input id="perfil-nombre" className={inp} aria-label="Nombre completo" value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveErr(''); }} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="perfil-bio" className="text-xs font-semibold text-ink-soft">Sobre mí</label>
                <textarea id="perfil-bio" className={inp + ' h-auto py-3 resize-none'} rows={3}
                  placeholder="Contá quién sos y por qué querés ser voluntario"
                  aria-label="Sobre mí" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="perfil-ubicacion" className="text-xs font-semibold text-ink-soft">Ubicación</label>
                <input id="perfil-ubicacion" className={inp} placeholder="Ej: Córdoba Capital"
                  aria-label="Ubicación" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-ink-soft">Habilidades</p>
                {skillsUnavailable ? (
                  <p className="text-[13px] text-ink-muted">No pudimos cargar tus habilidades: reintentá para editarlas.</p>
                ) : (<>
                  <div className="flex flex-wrap gap-1.5">
                    {skillCatalog.map(s => {
                      const selected = draftSkills.find(d => d.habilidad_id === s.id);
                      return (
                        <button key={s.id} type="button" onClick={() => toggleSkill(s.id)} aria-pressed={!!selected}
                          className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors ${selected ? 'bg-ink text-on-ink' : 'bg-surface hover:bg-surface-pressed'}`}>
                          {s.nombre}
                        </button>
                      );
                    })}
                  </div>
                  {draftSkills.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {draftSkills.map(d => {
                        const skill = skillCatalog.find(s => s.id === d.habilidad_id);
                        if (!skill) return null;
                        return (
                          <div key={d.habilidad_id} className="flex items-center justify-between gap-2">
                            <span className="text-[15px]">{skill.nombre}</span>
                            <select aria-label={`Nivel de ${skill.nombre}`} value={d.nivel} onChange={e => setSkillNivel(d.habilidad_id, e.target.value)}
                              className="h-9 px-2 rounded-[10px] bg-surface text-[13px] font-semibold outline-none focus:ring-[1.5px] focus:ring-ink">
                              {Object.entries(NIVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>)}
              </div>

              {saveErr && <p role="alert" className="text-[13px] font-medium text-critical">{saveErr}</p>}

              <Button variant="primary" onClick={handleSave} busy={saving} busyLabel="Guardando…" className="!h-12">
                <Save size={18} strokeWidth={1.75} aria-hidden="true" />Guardar cambios
              </Button>
            </div>
          )}

          {/* Pestañas */}
          <div role="tablist" aria-label="Contenido del perfil" className="mt-5 flex border-b border-hairline">
            {([['posts', 'Publicaciones'], ['volunteering', 'Voluntariados'], ['ngos', 'ONGs']] as [TabKey, string][]).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex-1 h-12 text-[13px] border-b-2 -mb-px transition-colors ${tab === k ? 'border-ink font-bold text-ink' : 'border-transparent font-semibold text-ink-muted'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 pb-6" role="tabpanel">
            {tab === 'posts' && <MomentsGrid filters={{ user_id: user.id }} />}

            {tab === 'volunteering' && (
              loading ? (
                <div role="status" aria-label="Cargando participaciones" className="flex flex-col gap-3">{[1, 2].map(i => <div key={i} aria-hidden="true" className="h-14 rounded-xl skeleton" />)}</div>
              ) : failed.has('enrollments') ? notLoaded : upcoming.length + done.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center gap-1">
                  <p className="text-[15px] font-semibold">Todavía no participaste en ningún voluntariado</p>
                  <Link to="/explore" className="text-[15px] font-semibold mt-1">Explorar voluntariados →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {upcoming.length > 0 && <section aria-labelledby="pf-prox"><h2 id="pf-prox" className="text-[15px] font-bold mb-1">Próximos</h2><ul>{upcoming.map(projectRow)}</ul></section>}
                  {done.length > 0 && <section aria-labelledby="pf-real"><h2 id="pf-real" className="text-[15px] font-bold mb-1">Realizados</h2><ul>{done.map(projectRow)}</ul></section>}
                  <Link to="/participation" className="text-[15px] font-semibold">Ver todas mis postulaciones →</Link>
                </div>
              )
            )}

            {tab === 'ngos' && (
              failed.has('ngos') ? notLoaded : myNgos.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center gap-1">
                  <p className="text-[15px] font-semibold">Todavía no seguís a ninguna ONG</p>
                  <Link to="/explore" className="text-[15px] font-semibold mt-1">Explorar organizaciones →</Link>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {myNgos.map(ngo => (
                    <li key={ngo.id}>
                      <Link to={`/ngo/${ngo.id}`} className="flex items-center gap-3 min-h-[64px]">
                        <Avatar src={ngo.logo} name={ngo.name} kind="org" size={44} />
                        <span className="min-w-0 flex flex-col">
                          <span className="text-[15px] font-semibold truncate">{ngo.name}</span>
                          <span className="text-[13px] text-ink-muted truncate">{ngo.location || 'Argentina'} · {ngo.followers || 0} seguidores</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </div>
      </div>

      {listMode && (
        <FollowListModal mode={listMode} meId={user?.id} onClose={() => setListMode(null)}
          load={m => m === 'followers' ? api.follows.myFollowers() : api.follows.myFollowing()}
          emptyText={{ followers: 'Todavía no tenés seguidores.', following: 'Todavía no seguís a nadie.' }} />
      )}
    </div>
  );
}
