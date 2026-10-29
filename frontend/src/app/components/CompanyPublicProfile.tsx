import { useParams, useNavigate, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { api, Empresa } from '../../lib/api';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { LoadError, describeLoadError } from './LoadError';
import { useAuth } from '../../lib/AuthContext';
import { ProfileHeader, ProfileTabs } from '../ui/ProfileHeader';
import { ButtonLink } from '../ui/Button';

export function CompanyPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; retry: boolean } | null>(null);

  // Solo vale la respuesta del último pedido (al cambiar de :id o reintentar): REVISION F15, §89.
  const latest = useLatestRequest();
  useEffect(() => { load(); }, [id]);

  const load = () => {
    if (!id) return;
    const req = latest.start();
    setLoading(true);
    setLoadError(null);
    api.empresas.get(id)
      .then(({ empresa: e }) => { if (latest.isLatest(req)) setEmpresa(e); })
      .catch((e) => { if (latest.isLatest(req)) setLoadError(describeLoadError(e, 'No encontramos esta empresa')); })
      .finally(() => { if (latest.isLatest(req)) setLoading(false); });
  };

  if (loading) return (
    <div role="status" aria-label="Cargando empresa" className="p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4"><div className="w-[88px] h-[88px] rounded-[28%] skeleton" /><div className="flex-1 h-10 rounded skeleton" /></div>
      <div className="h-4 w-1/2 rounded skeleton" /><div className="h-16 rounded-xl skeleton" />
    </div>
  );
  if (loadError || !empresa) return (
    <LoadError message={loadError?.message ?? 'No encontramos esta empresa'}
      onRetry={loadError?.retry ? load : undefined} home="/" />
  );

  const about = [empresa.description, empresa.mission ? `Misión de RSE: ${empresa.mission}` : ''].filter(Boolean).join('\n\n');

  return (
    <div className="min-h-screen bg-canvas md:bg-canvas-soft pb-6">
      <div className="max-w-[640px] mx-auto md:pt-8">
        <div className="bg-canvas md:rounded-2xl md:border md:border-hairline">
          <ProfileHeader
            name={empresa.name}
            avatar={empresa.logo}
            kind="org"
            subtitle={[empresa.industry, empresa.location].filter(Boolean).join(' · ')}
            bio={about}
            onBack={() => navigate(-1)}
            stats={[{ n: empresa.followers ?? 0, label: 'Seguidores' }]}
            actions={user && user.id !== empresa.user_id ? (
              <ButtonLink to={`/messages/${empresa.user_id}`} variant="secondary" className="flex-1">Mensaje</ButtonLink>
            ) : undefined}
          />
          <ProfileTabs label="Contenido de la empresa" value="patrocinios" onChange={() => {}} tabs={[{ key: 'patrocinios', label: 'Patrocinios' }]} />
          {/* §266: los voluntariados con el acuerdo de patrocinio aceptado (sin montos: son privados de las partes). */}
          <div className="p-4 pb-8" role="tabpanel">
            {empresa.sponsored_projects?.length ? (
              <ul className="flex flex-col gap-2">
                {empresa.sponsored_projects.map(p => (
                  <li key={p.id}>
                    <Link to={`/project/${p.id}`} className="flex items-center gap-3 min-h-[64px]">
                      {p.image
                        ? <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-surface-soft" />
                        : <span className="w-12 h-12 rounded-xl bg-surface-soft flex-shrink-0" aria-hidden="true" />}
                      <span className="min-w-0 flex flex-col">
                        <span className="text-[15px] font-semibold truncate">{p.title}</span>
                        <span className="text-[13px] text-ink-muted truncate">{p.ngo_name}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-soft text-center py-8">Todavía no patrocina voluntariados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
