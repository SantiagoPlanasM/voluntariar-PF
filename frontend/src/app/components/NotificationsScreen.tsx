import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api, AppNotification } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

const TYPE_ICON: Record<string, string> = {
  enrollment_approved: '✅',
  enrollment_rejected: '❌',
  new_enrollment:      '🙋',
  new_project:         '🌱',
  default:             '🔔',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

export function NotificationsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setNotifs((await api.notifications.list()).notifications); }
    catch { setNotifs([]); }
    finally { setLoading(false); }
  };

  const markAll = async () => {
    setMarking(true);
    try { await api.notifications.markAllRead(); load(); }
    catch {}
    finally { setMarking(false); }
  };

  const unread = notifs.filter(n => !n.read && n.read !== 1).length;

  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 bg-gray-50 md:ml-60">
      <p className="text-gray-500">Iniciá sesión para ver tus notificaciones</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:ml-60">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
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
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-medium text-gray-400">Sin notificaciones</p>
            <p className="text-sm text-gray-300 mt-1">Te avisaremos cuando haya novedades</p>
          </div>
        ) : (
          notifs.map(n => {
            const isUnread = !n.read && n.read !== 1;
            const icon = TYPE_ICON[n.type] || TYPE_ICON.default;
            return (
              <div key={n.id}
                className={`bg-white rounded-2xl border p-4 flex gap-3 transition-all ${
                  isUnread ? 'border-emerald-200 shadow-sm' : 'border-gray-100'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                  isUnread ? 'bg-emerald-50' : 'bg-gray-50'
                }`}>
                  {icon}
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
