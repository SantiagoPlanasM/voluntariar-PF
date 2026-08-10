import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Loader2, Users, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

interface Empleado {
  id: string; nombre: string; apellido: string;
  email: string; rol: string; foto_perfil?: string;
}

const ROLES = ['coordinador','comunicador','admin','otro'];

export function NGOEmpleados() {
  const { id } = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', rol: 'coordinador' });

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ngos/${id}/empleados`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('v_token')}` }
      });
      const data = await res.json();
      setEmpleados(data.empleados || []);
    } catch { setEmpleados([]); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim()) {
      setErr('Nombre, apellido y email son obligatorios'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ngos/${id}/empleados`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('v_token')}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ nombre: '', apellido: '', email: '', rol: 'coordinador' });
      setShowForm(false);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const ROL_COLORS: Record<string, string> = {
    coordinador: 'bg-blue-50 text-blue-700',
    comunicador: 'bg-violet-50 text-violet-700',
    admin:       'bg-emerald-50 text-emerald-700',
    otro:        'bg-gray-100 text-gray-600',
  };

  const inp = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">Equipo ONG</h1>
              <p className="text-xs text-gray-400">{empleados.length} miembro{empleados.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={() => { setShowForm(!showForm); setErr(''); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancelar' : 'Agregar'}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-sm text-gray-900">Nuevo miembro del equipo</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre *</label>
                <input className={inp} placeholder="Ana" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Apellido *</label>
                <input className={inp} placeholder="García" value={form.apellido}
                  onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Email *</label>
              <input className={inp} type="email" placeholder="ana@ong.org" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Rol</label>
              <select className={inp} value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{err}</p>}
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Agregar al equipo
            </button>
          </form>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : empleados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-medium text-gray-400">Sin miembros en el equipo</p>
            <p className="text-sm text-gray-300 mt-1">Agregá personas que forman parte de tu ONG</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {empleados.map(e => (
                <div key={e.id} className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                    {e.foto_perfil
                      ? <img src={e.foto_perfil} alt="" className="w-full h-full rounded-full object-cover" />
                      : `${e.nombre[0]}${e.apellido[0]}`
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{e.nombre} {e.apellido}</p>
                    <p className="text-xs text-gray-400">{e.email}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROL_COLORS[e.rol] || ROL_COLORS.otro}`}>
                    {e.rol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
