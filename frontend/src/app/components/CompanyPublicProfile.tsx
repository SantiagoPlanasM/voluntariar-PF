import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Loader2, MessageCircle, Building2 } from 'lucide-react';
import { api, Empresa } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

export function CompanyPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.empresas.get(id)
      .then(({ empresa: e }) => setEmpresa(e))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );
  if (!empresa) return null;

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      {/* Header */}
      <div className="relative h-32 sm:h-44 bg-gradient-to-br from-violet-600 to-indigo-700 flex-shrink-0">
        {empresa.cover_image && (
          <img src={empresa.cover_image} alt="" className="w-full h-full object-cover opacity-40" />
        )}
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4">
        {/* Avatar + info */}
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden flex-shrink-0">
            {empresa.logo
              ? <img src={empresa.logo} alt={empresa.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-violet-100 flex items-center justify-center text-2xl font-black text-violet-700">{empresa.name[0]}</div>
            }
          </div>
          <div className="pb-1 min-w-0 flex-1">
            <h1 className="text-xl font-black text-gray-900 leading-tight">{empresa.name}</h1>
            {empresa.location && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />{empresa.location}
              </p>
            )}
          </div>
          {user && user.id !== empresa.user_id && (
            <button onClick={() => navigate(`/messages/${empresa.user_id}`)}
              className="mb-1 flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors flex-shrink-0">
              <MessageCircle className="w-3.5 h-3.5" />Mensaje
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { val: empresa.industry || '—', label: 'Industria',  color: 'text-violet-600', bg: 'bg-violet-50' },
            { val: empresa.followers,       label: 'Seguidores', color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map(({ val, label, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
              <p className={`text-lg font-black ${color} truncate`}>{val}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Descripción y misión */}
        {(empresa.description || empresa.mission) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
            {empresa.description && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                <p className="text-sm text-gray-700 leading-relaxed">{empresa.description}</p>
              </div>
            )}
            {empresa.mission && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Misión de RSE</p>
                <p className="text-sm text-gray-700 leading-relaxed">{empresa.mission}</p>
              </div>
            )}
          </div>
        )}

        {/* Patrocinios: sin API todavía, ver CompanyOwnProfile.tsx */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-600" />
            <h2 className="font-bold text-sm text-gray-900">Proyectos patrocinados</h2>
          </div>
          <p className="text-sm text-gray-400 text-center py-8">Esta función se habilita próximamente</p>
        </div>
      </div>
    </div>
  );
}
