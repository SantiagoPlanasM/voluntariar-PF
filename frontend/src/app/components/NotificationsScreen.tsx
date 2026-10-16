import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2, ArrowLeft, CheckCircle, XCircle, UserPlus, Heart } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api, AppNotification } from '../../lib/api';
import { timeAgo, userMessage } from '../../lib/format';
import { InlineError } from './LoadError';
import { useAuth } from '../../lib/AuthContext';

const TYPE_ICON = {
  enrollment_approved: { icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-100' },
  enrollment_rejected: { icon: XCircle,     color: 'text-red-500 bg-red-50 border-red-100' },
  new_enrollment:      { icon: UserPlus,    color: 'text-blue-500 bg-blue-50 border-blue-100' },
  new_project:         { icon: Heart,       color: 'text-emerald-500 bg-emerald-50 border-emerald-100' },
  default:             { icon: Bell,        color: 'text-gray-500 bg-gray-50 border-gray-100' },
};

// "Hace cuánto": el timeAgo compartido (lib/format.ts). Antes había una copia acá con `new Date(fecha)`, que
// leía el formato de SQLite (UTC sin zona) como hora local: 3 h de desfase en Córdoba (REVISION F11).

// `inPanel` (§173): dentro del panel de la ONG la barra lateral está en el flujo (NGOLayout), así que no lleva el margen
// `md:ml-60` que necesita el layout del voluntario (Root), donde la barra es fija.
export function NotificationsScreen({ inPanel = false }: { inPanel?: boolean } = {}) {
  const { user } = useAuth();
  const offset = inPanel ? '' : ' md:ml-60';
  const navigate = useNavigate();
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  // Contador del backend (COUNT sobre todas): la lista viene limitada a 50 y contarla acá daba ≤50 (§152).
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try { const r = await api.notifications.list(); setNotifs(r.notifications); setUnread(r.unread); }
    catch (e) { setNotifs([]); setUnread(0); setLoadError(userMessage(e, 'No pudimos cargar tus notificaciones. Revisá tu conexión.')); } // antes: "Sin notificaciones" (F9)
    finally { setLoading(false); }
  };

  const markAll = async () => {
    setMarking(true);
    setActionError('');
    try { await api.notifications.markAllRead(); load(); }
    catch (e) { setActionError(userMessage(e, 'No pudimos marcar las notificaciones como leídas. Revisá tu conexión.')); }
    finally { setMarking(false); }
  };

  if (!user) return (
    <div className={`flex flex-col items-center justify-center h-screen gap-3 bg-gray-50${offset}`}>
      <p className="text-gray-500">Iniciá sesión para ver tus notificaciones</p>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-50${offset}`}>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} aria-label="Volver"
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center md:hidden">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">Notificaciones</h1>
              {unread > 0 && <p className="text-xs text-emerald-600 font-medium">{unread} sin leer</p>}
            </div>
          </div>
          {unread > 0 && (
            <button onClick={markAll} disabled={marking}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-600 transition-colors disabled:opacity-50">
              {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Marcar todas leídas
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {actionError && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{actionError}</p>}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : loadError ? (
          <InlineError message={loadError} onRetry={load} />
        ) : notifs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-medium text-gray-400">Sin notificaciones</p>
            <p className="text-sm text-gray-300 mt-1">Te avisaremos cuando haya novedades</p>
          </div>
        ) : (
          notifs.map(n => {
            const isUnread = !n.read && n.read !== 1;
            const config = TYPE_ICON[n.type as keyof typeof TYPE_ICON] || TYPE_ICON.default;
            const Icon = config.icon;
            return (
              <div key={n.id}
                className={`bg-white rounded-2xl border p-4 flex gap-3 transition-all ${
                  isUnread ? 'border-emerald-200 shadow-sm' : 'border-gray-100'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${config.color}`}>
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-tight ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                  {isUnread && <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mt-2" />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
