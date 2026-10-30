// Perfil propio de la ONG (DESIGN.md → Perfiles): la misma estructura que el de un voluntario (identidad arriba,
// contenido abajo). "Cerrar sesión" y "Borrar la cuenta" están en Configuración; la cuenta de Mercado Pago queda acá
// (el aviso del panel lleva a #mercadopago).
import { useEffect, useState } from 'react';
import { Menu, Save } from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { api, NGO, Project } from '../../lib/api';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';
import { MercadoPagoAccountSection } from './MercadoPagoAccount';
import { MomentsFeed } from './MomentsFeed';
import { ProfileHeader, ProfileTabs } from '../ui/ProfileHeader';
import { Button } from '../ui/Button';
import { useToast } from '../ui/UiProvider';
import { VolunteeringTile } from '../volunteering/VolunteeringTile';
import { NGOTransparency } from './NGOTransparency';
import { PROFILE_FIELD } from '../ui/fieldStyles';

const CATEGORIES = ['Medio Ambiente','Educación','Salud','Animales','Alimentación','Tecnología','Arte y Cultura','Deportes'];

export function NGOOwnProfile() {
  const navigate   = useNavigate();
  const toast      = useToast();
  const [ngo, setNgo]         = useState<NGO | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', mission: '', location: '', category: '', cuit: '', transparency_url: '' });
  const [tab, setTab] = useState<'volunteering' | 'posts'>('volunteering');

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { ngo: n, projects: p } = await api.ngos.me();
      setNgo(n); setProjects(p);
      setForm({ name: n.name, description: n.description || '', mission: n.mission || '', location: n.location || '', category: n.category || '',
        cuit: n.cuit || '', transparency_url: n.transparency_url || '' });
    } catch { navigate('/'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setSaveErr('El nombre es obligatorio'); return; }
    setSaving(true); setSaveErr('');
    try { await api.ngos.update(form); setEditing(false); void load(); }
    catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const handleShare = async () => {
    if (!ngo) return;
    const url = `${window.location.origin}/ngo/${ngo.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: ngo.name, url }); return; }
      await navigator.clipboard.writeText(url);
      toast('Link de tu perfil copiado');
    } catch { /* la persona canceló */ }
  };

  if (loading) return (
    <div role="status" aria-label="Cargando perfil" className="p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4"><div className="w-[88px] h-[88px] rounded-[28%] skeleton" /><div className="flex-1 h-10 rounded skeleton" /></div>
      <div className="h-4 w-1/2 rounded skeleton" />
    </div>
  );
  if (!ngo) return null;

  const inp = PROFILE_FIELD;
  const lbl = 'text-xs font-semibold text-ink-soft';
  const about = [ngo.description, ngo.mission ? `Misión: ${ngo.mission}` : ''].filter(Boolean).join('\n\n');

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8 flex flex-col gap-4">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline">
          <ProfileHeader
            name={ngo.name}
            avatar={ngo.logo}
            kind="org"
            subtitle={[ngo.category, ngo.location].filter(Boolean).join(' · ')}
            bio={editing ? undefined : about}
            stats={[
              { n: projects.length, label: 'Voluntariados' },
              { n: projects.reduce((s, p) => s + (p.current_volunteers || 0), 0), label: 'Voluntarios' },
              { n: ngo.followers ?? 0, label: 'Seguidores' },
            ]}
            corner={(
              <Link to="/settings" aria-label="Configuración" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
                <Menu size={24} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            )}
            actions={(
              <>
                <Button variant="secondary" className="flex-1" onClick={() => { setEditing(e => !e); setSaveErr(''); }} aria-label={editing ? 'Cancelar edición' : 'Editar perfil'}>
                  {editing ? 'Cancelar' : 'Editar perfil'}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={handleShare}>Compartir perfil</Button>
              </>
            )}
          />

          {editing && (
            <div className="mx-4 mt-4 rounded-xl bg-surface-soft p-4 flex flex-col gap-4">
              <h2 className="text-[15px] font-bold">Editar información</h2>
              <ProfilePhotoPicker onUploaded={(url) => setNgo((n) => (n ? { ...n, logo: url } : n))} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-nombre" className={lbl}>Nombre *</label>
                <input id="ong-nombre" className={inp} placeholder="Nombre de la ONG" aria-label="Nombre" value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveErr(''); }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-cat" className={lbl}>Categoría</label>
                <select id="ong-cat" className={inp} aria-label="Categoría" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">Sin especificar</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-ubi" className={lbl}>Ubicación</label>
                <input id="ong-ubi" className={inp} placeholder="Ej: Córdoba, Argentina" aria-label="Ubicación" value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-desc" className={lbl}>Descripción</label>
                <textarea id="ong-desc" className={inp + ' h-auto py-3 resize-none'} rows={3} aria-label="Descripción" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-mis" className={lbl}>Misión</label>
                <textarea id="ong-mis" className={inp + ' h-auto py-3 resize-none'} rows={2} aria-label="Misión" value={form.mission}
                  onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} />
              </div>
              {/* §285: transparencia (opcional y pública; el backend valida el CUIT y que el link sea https). */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-cuit" className={lbl}>CUIT</label>
                <input id="ong-cuit" className={inp} inputMode="numeric" placeholder="30-12345678-9" value={form.cuit}
                  onChange={e => { setForm(f => ({ ...f, cuit: e.target.value })); setSaveErr(''); }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ong-transparencia" className={lbl}>Link a balances y documentos</label>
                <input id="ong-transparencia" className={inp} type="url" placeholder="https://…" value={form.transparency_url}
                  onChange={e => { setForm(f => ({ ...f, transparency_url: e.target.value })); setSaveErr(''); }} />
                <p className="text-xs text-ink-muted">Opcionales y públicos. Generan confianza en quienes donan.</p>
              </div>

              {saveErr && <p role="alert" className="text-[13px] font-medium text-critical">{saveErr}</p>}

              <Button variant="primary" onClick={handleSave} busy={saving} busyLabel="Guardando…" className="!h-12">
                <Save size={18} strokeWidth={1.75} aria-hidden="true" />Guardar cambios
              </Button>
            </div>
          )}

          <NGOTransparency cuit={ngo.cuit} url={ngo.transparency_url} />

          <ProfileTabs
            label="Contenido de la ONG"
            value={tab}
            onChange={setTab}
            tabs={[{ key: 'volunteering', label: 'Voluntariados' }, { key: 'posts', label: 'Publicaciones' }]}
          />

          <div className="p-4 pb-6" role="tabpanel">
            {tab === 'posts' ? (
              <MomentsFeed filters={{ ngo_id: ngo.id }} showComposer={false} />
            ) : projects.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-1">
                <p className="text-[15px] font-semibold">Todavía no publicaste voluntariados</p>
                <Link to="/ngo/create" className="text-[15px] font-semibold mt-1">Crear el primero →</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-5">
                {projects.map(p => <VolunteeringTile key={p.id} project={p} />)}
              </div>
            )}
          </div>
        </div>

        {/* §218: Marketplace */}
        <div className="px-4 md:px-0"><MercadoPagoAccountSection /></div>
      </div>
    </div>
  );
}
