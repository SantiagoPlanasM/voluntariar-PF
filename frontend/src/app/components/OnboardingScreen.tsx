import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Heart, Building2, Users, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

type Mode = 'select' | 'login' | 'register';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { login, register, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('select');
  const [role, setRole] = useState<'volunteer' | 'ngo' | 'company'>('volunteer');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const roles = [
    { id: 'volunteer' as const, title: 'Voluntario', desc: 'Participá en proyectos sociales', icon: Heart, color: '#2D5A27' },
    { id: 'ngo' as const, title: 'ONG', desc: 'Publicá proyectos y conectá voluntarios', icon: Users, color: '#0056B3' },
    { id: 'company' as const, title: 'Empresa', desc: 'Patrociná iniciativas de RSE', icon: Building2, color: '#2D5A27' },
  ];

  const dest = (r: typeof role) => r === 'ngo' ? '/ngo/dashboard' : '/feed';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await login(form.email, form.password);
      navigate(dest(role));
    } catch (err: any) { setError(err.message); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await register(form.name, form.email, form.password, role);
      navigate(dest(role));
    } catch (err: any) { setError(err.message); }
  };

  const inp = 'w-full px-4 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]';

  if (mode === 'login' || mode === 'register') {
    const isLogin = mode === 'login';
    const selectedRole = roles.find(r => r.id === role)!;
    const Icon = selectedRole.icon;
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2D5A27] to-[#0056B3] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-xl">
              <Icon className="w-8 h-8" style={{ color: selectedRole.color }} />
            </div>
            <h1 className="text-2xl font-bold text-white">{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
            <p className="text-white/70 text-sm mt-1">como {selectedRole.title}</p>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
            {!isLogin && (
              <input className={inp} placeholder="Nombre completo" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            )}
            <input className={inp} type="email" placeholder="Email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} required />
            <div className="relative">
              <input className={inp + ' pr-10'} type={showPass ? 'text' : 'password'}
                placeholder="Contraseña" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} required />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#2D5A27] text-white rounded-xl font-semibold text-sm hover:bg-[#234820] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? 'Entrar' : 'Registrarme'}
            </button>

            <p className="text-center text-sm text-gray-500">
              {isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
              <button type="button" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}
                className="text-[#2D5A27] font-semibold">
                {isLogin ? 'Registrate' : 'Iniciá sesión'}
              </button>
            </p>
          </form>

          <button onClick={() => { setMode('select'); setError(''); }}
            className="mt-4 w-full text-white/60 text-sm text-center hover:text-white/90 transition-colors">
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2D5A27] to-[#0056B3] flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
          <Heart className="w-10 h-10 text-[#2D5A27] fill-[#2D5A27]" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-1">Voluntariar</h1>
        <p className="text-white/80">Red Social Solidaria · UCC</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {roles.map(({ id, title, desc, icon: Icon, color }) => (
          <button key={id} onClick={() => { setRole(id); setMode('login'); }}
            className="w-full bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="text-white/50 text-xs text-center mt-8">Al continuar aceptás los términos de uso</p>
    </div>
  );
}
