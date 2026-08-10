// src/app/components/AuthModal.tsx
import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2, Heart, Users, Building2, Check } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useNavigate } from 'react-router';

type Tab = 'login' | 'register';

// ── Validaciones frontend (espejo del backend) ────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE  = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;

function validateEmail(v: string) {
  if (!v.trim()) return 'El email es obligatorio';
  if (!EMAIL_RE.test(v.trim())) return 'Email inválido. Ejemplo: usuario@dominio.com';
  return '';
}
function validateName(v: string) {
  if (!v.trim() || v.trim().length < 2) return 'Mínimo 2 caracteres';
  if (!NAME_RE.test(v.trim())) return 'Solo letras y espacios';
  return '';
}
function validatePassword(v: string) {
  if (v.length < 8)         return 'Mínimo 8 caracteres';
  if (!/[A-Z]/.test(v))    return 'Necesita al menos una mayúscula';
  if (!/[0-9]/.test(v))    return 'Necesita al menos un número';
  return '';
}

// Indicador visual de fortaleza de contraseña
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { ok: password.length >= 8,    label: '8+ caracteres' },
    { ok: /[A-Z]/.test(password),  label: 'Mayúscula' },
    { ok: /[0-9]/.test(password),  label: 'Número' },
  ];
  return (
    <div className="flex gap-2 mt-1.5">
      {checks.map(({ ok, label }) => (
        <span key={label} className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${ok ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
            {ok && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

const ROLES = [
  { id: 'volunteer' as const, label: 'Voluntario', icon: Heart,     color: 'text-emerald-600', ring: 'ring-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-500' },
  { id: 'ngo'       as const, label: 'ONG',        icon: Users,     color: 'text-blue-600',    ring: 'ring-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-500'    },
  { id: 'company'   as const, label: 'Empresa',    icon: Building2, color: 'text-violet-600',  ring: 'ring-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-500'  },
];

export function AuthModal() {
  const { showAuthModal, closeAuthModal, authModalIntent, login, register, loading, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]         = useState<Tab>('login');
  const [role, setRole]       = useState<'volunteer' | 'ngo' | 'company'>('volunteer');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' });
  const [form, setForm]       = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (user && !showAuthModal) {
      if (user.role === 'ngo') navigate('/ngo/dashboard');
    }
  }, [user, showAuthModal]);

  // Reset on open/tab change
  useEffect(() => {
    setError(''); setFieldErrors({ name: '', email: '', password: '' });
    setForm({ name: '', email: '', password: '' });
  }, [tab, showAuthModal]);

  if (!showAuthModal) return null;

  const setField = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    // Clear field error on type
    setFieldErrors(fe => ({ ...fe, [k]: '' }));
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(form.email);
    if (emailErr) { setFieldErrors(fe => ({ ...fe, email: emailErr })); return; }
    setError('');
    try { await login(form.email, form.password); }
    catch (err: any) { setError(err.message); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr  = validateName(form.name);
    const emailErr = validateEmail(form.email);
    const passErr  = validatePassword(form.password);
    const newFE = { name: nameErr, email: emailErr, password: passErr };
    setFieldErrors(newFE);
    if (nameErr || emailErr || passErr) return;
    setError('');
    try { await register(form.name, form.email, form.password, role); }
    catch (err: any) { setError(err.message); }
  };

  const inp = (hasError: boolean) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
      hasError ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-emerald-500 focus:border-transparent'
    }`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={closeAuthModal}>
      <div className="bg-white w-full sm:max-w-md md:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '95vh', overflowY: 'auto' }}>

        {/* Handle bar */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Heart className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">Voluntariar</span>
            </div>
            {authModalIntent && <p className="text-sm text-gray-500 mt-0.5">{authModalIntent}</p>}
          </div>
          <button onClick={closeAuthModal}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0 mt-1">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="px-6 pt-2 pb-6">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            {(['login', 'register'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {/* Role selector */}
          {tab === 'register' && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Soy...</p>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ id, label, icon: Icon, color, bg, border }) => (
                  <button key={id} type="button" onClick={() => setRole(id)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                      role === id ? `${border} ${bg} ${color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Icon className={`w-5 h-5 ${role === id ? color : 'text-gray-400'}`} />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-3" noValidate>
            {tab === 'register' && (
              <div>
                <input className={inp(!!fieldErrors.name)} placeholder="Tu nombre completo"
                  value={form.name} onChange={e => setField('name', e.target.value)} />
                {fieldErrors.name && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.name}</p>}
              </div>
            )}

            <div>
              <input className={inp(!!fieldErrors.email)} type="email" placeholder="Email"
                value={form.email} onChange={e => setField('email', e.target.value)} />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <div className="relative">
                <input className={inp(!!fieldErrors.password) + ' pr-11'}
                  type={showPass ? 'text' : 'password'}
                  placeholder={tab === 'register' ? 'Mínimo 8 caracteres, 1 mayúscula y 1 número' : 'Contraseña'}
                  value={form.password} onChange={e => setField('password', e.target.value)} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {tab === 'register' && <PasswordStrength password={form.password} />}
              {fieldErrors.password && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.password}</p>}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 mt-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {tab === 'login' ? 'Entrar' : 'Crear mi cuenta gratis'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            {tab === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
              className="text-emerald-600 font-semibold hover:underline">
              {tab === 'login' ? 'Registrate gratis' : 'Iniciá sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
