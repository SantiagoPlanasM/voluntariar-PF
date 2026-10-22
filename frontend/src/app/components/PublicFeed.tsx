import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { api, Project, PublicStats } from '../../lib/api';
import { compactNumber } from '../../lib/format';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { useAuth } from '../../lib/AuthContext';
import { FeedPostCard } from './FeedPostCard';
import { Button } from '../ui/Button';

const CATEGORIES = ['Todos', 'Medio Ambiente', 'Alimentación', 'Educación', 'Tecnología', 'Animales', 'Salud'];

export function PublicFeed() {
  const { user, initializing, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [cat, setCat]           = useState('Todos');
  const [stats, setStats]       = useState<PublicStats | null>(null);

  // Números de la portada desde la base (§129; antes eran fijos e inventados). Son decorativos: si el pedido
  // falla no se muestra nada (sin error en la portada), y con todo en 0 la fila se oculta (ver más abajo).
  useEffect(() => {
    let cancelled = false;
    api.stats().then((s) => { if (!cancelled) setStats(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Wait until auth state is settled
    if (initializing) return;
    if (user) {
      if (user.role === 'ngo') {
        navigate('/ngo/dashboard', { replace: true });
        return;
      }
      if (user.role === 'company') {
        navigate('/company/profile', { replace: true });
        return;
      }
      navigate('/feed', { replace: true });
      return;
    }
    void load();
  }, [user, initializing]);

  useEffect(() => { if (!initializing && !user) void load(); }, [cat]);

  // load() se llama al cambiar de categoría y al buscar, y las respuestas pueden llegar en cualquier orden:
  // solo se aplica la del último pedido (antes una vieja podía pisar a la nueva, REVISION F15).
  const latest = useLatestRequest();

  const load = async () => {
    const request = latest.start();
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (cat !== 'Todos') params.category = cat;
      if (search.trim())   params.search   = search.trim();
      const { projects } = await api.projects.list(params);
      if (latest.isLatest(request)) setProjects(projects);
    } catch { if (latest.isLatest(request)) setProjects([]); }
    finally { if (latest.isLatest(request)) setLoading(false); }
  };

  // Show nothing while auth is being verified to prevent flashing
  if (initializing) {
    return (
      <div role="status" aria-label="Cargando" className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-hairline border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  const showStats = stats && stats.active_projects + stats.volunteers + stats.ngos > 0;

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-[520px] mx-auto px-3 md:px-0 md:pt-8 flex flex-col gap-4">
        {/* Franja de bienvenida: qué es esto y cómo ayudar, con los números reales de la base. */}
        <section aria-labelledby="bienvenida" className="rounded-2xl bg-surface border border-hairline p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 id="bienvenida" className="text-[22px] font-bold leading-[1.2] tracking-[-0.3px]">Voluntariados en Córdoba, para sumarte o donar</h1>
            <p className="text-[15px] leading-[1.45] text-ink-soft">Organizaciones sociales publican sus acciones. Vos elegís una, te inscribís y ves cómo avanza.</p>
          </div>
          {showStats && (
            <ul aria-label="VoluntariAR en números" className="flex gap-6">
              {[
                { n: stats!.active_projects, one: 'voluntariado activo', many: 'voluntariados activos' },
                { n: stats!.volunteers,      one: 'voluntario',          many: 'voluntarios' },
                { n: stats!.ngos,            one: 'ONG',                 many: 'ONGs' },
              ].map(({ n, one, many }) => (
                <li key={many} className="flex flex-col">
                  <span className="text-[22px] font-extrabold tracking-[-0.3px]">{compactNumber(n)}</span>
                  <span className="text-[13px] text-ink-muted">{n === 1 ? one : many}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => openAuthModal('Creá tu cuenta gratis y empezá a ayudar hoy', 'register')} className="flex-1">Crear cuenta</Button>
            <Button variant="secondary" onClick={() => openAuthModal()} className="flex-1">Ingresar</Button>
          </div>
        </section>

        <form onSubmit={e => { e.preventDefault(); void load(); }} role="search">
          <label className="h-12 px-4 rounded-full bg-surface-soft flex items-center gap-2.5 text-ink-muted focus-within:bg-surface focus-within:ring-[1.5px] focus-within:ring-ink">
            <Search size={20} strokeWidth={1.75} aria-hidden="true" />
            <input type="search" aria-label="Buscar proyectos" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscá causas, ONGs o lugares" className="flex-1 min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted" />
          </label>
        </form>

        <div className="-mx-3 md:mx-0 px-3 md:px-0 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Categorías">
          {CATEGORIES.map(name => (
            <button key={name} type="button" onClick={() => setCat(name)} aria-pressed={cat === name}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${cat === name ? 'bg-ink text-on-ink' : 'bg-surface-soft text-ink hover:bg-surface-pressed'}`}>
              {name}
            </button>
          ))}
        </div>

        <h2 className="text-lg font-bold tracking-[-0.2px] mt-1">
          {cat === 'Todos' ? 'Proyectos destacados' : cat} <span className="text-[13px] font-normal text-ink-muted">{projects.length}</span>
        </h2>

        {loading ? (
          <div role="status" aria-label="Cargando proyectos" className="flex flex-col gap-3 md:gap-6">
            {[1, 2].map(i => (
              <div key={i} aria-hidden="true" className="bg-surface border border-hairline rounded-2xl overflow-hidden">
                <div className="aspect-[16/10] skeleton" />
                <div className="p-4 flex flex-col gap-3"><div className="h-5 w-3/4 rounded skeleton" /><div className="h-3 rounded skeleton" /><div className="h-12 rounded-xl skeleton" /></div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-1">
            <p className="text-[15px] font-semibold">No encontramos voluntariados con esos filtros</p>
            <Button variant="text" onClick={() => { setCat('Todos'); setSearch(''); }}>Limpiar filtros</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 md:gap-6">
            {projects.map(p => <FeedPostCard key={p.id} project={p} />)}
          </div>
        )}

        <p className="text-xs text-ink-muted text-center pt-2">Proyecto final de tesis · UCC</p>
      </div>
    </div>
  );
}
