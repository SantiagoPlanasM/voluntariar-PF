// src/app/components/AuthModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, User, Heart, Building2, Check } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useNavigate } from 'react-router';
import { Modal } from './Modal';
import { Logo } from '../ui/Logo';
import { PasswordInput } from '../ui/PasswordInput';
import { api, GoogleProfile, User as AppUser } from '../../lib/api';
import { googleClientId, renderGoogleButton } from '../../lib/googleSignIn';
import { userMessage } from '../../lib/format';

type Tab = 'login' | 'register';

// ── Validaciones frontend (espejo del backend) ────────────────────────────
// Igual que el backend: el primer punto después del primer carácter del dominio, con 2 o más caracteres después.
// Antes, [^\s@]+\.[^\s@]{2,}, cuadrático por el backtracking (SonarCloud S8786, §201 y §231); acepta lo mismo.
export const EMAIL_RE = /^[^\s@]+@[^\s@][^\s@.]*\.[^\s@]{2,}$/;
const NAME_RE  = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,50}$/;

// Tope de 254 (RFC 5321) antes del regex, como el backend (§201). El regex ya es lineal (§231).
const EMAIL_MAX = 254;
function validateEmail(v: string) {
  const email = v.trim();
  if (!email) return 'El email es obligatorio';
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) return 'Email inválido. Ejemplo: usuario@dominio.com';
  return '';
}
function validateName(v: string) {
  if (!v.trim() || v.trim().length < 2) return 'Mínimo 2 caracteres';
  if (!NAME_RE.test(v.trim())) return 'Solo letras y espacios';
  return '';
}
// bcrypt usa solo los primeros 72 bytes: mismo límite y mismo mensaje que el backend (routes/auth.js).
// Bytes UTF-8, no caracteres: la ñ ocupa 2 y un emoji 4.
const PASSWORD_MAX_BYTES = 72;
function validatePassword(v: string) {
  if (v.length < 8)         return 'Mínimo 8 caracteres';
  if (new TextEncoder().encode(v).length > PASSWORD_MAX_BYTES)
    return 'Máximo 72 caracteres (los acentos, la ñ y los emojis cuentan como más de uno)';
  if (!/[A-Z]/.test(v))    return 'Necesita al menos una mayúscula';
  if (!/[0-9]/.test(v))    return 'Necesita al menos un número';
  return '';
}

// Requisitos de la contraseña: se van tildando mientras se escribe. El verde significa "cumplido", siempre con tilde y texto.
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { ok: password.length >= 8,    label: '8 caracteres o más' },
    { ok: /[A-Z]/.test(password),  label: 'Una mayúscula' },
    { ok: /[0-9]/.test(password),  label: 'Un número' },
  ];
  return (
    <ul className="flex flex-col gap-1 mt-1" aria-label="Requisitos de la contraseña">
      {checks.map(({ ok, label }) => (
        <li key={label} className={`flex items-center gap-1.5 text-[13px] transition-colors ${ok ? 'text-people-text font-semibold' : 'text-ink-muted'}`}>
          {ok ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : <span className="w-3.5 text-center" aria-hidden="true">·</span>}
          {label}
        </li>
      ))}
    </ul>
  );
}

// Clases de los campos y botones (las usan el acceso y el formulario de recuperar la contraseña).
const inp = (hasError: boolean) =>
  `w-full h-12 px-3.5 rounded-[10px] bg-surface-soft text-[15px] text-ink placeholder:text-ink-muted border-[1.5px] outline-none transition-colors focus:bg-surface ${
    hasError ? 'border-critical' : 'border-transparent focus:border-ink'
  }`;
const lbl = 'text-xs font-semibold text-ink-soft';
const primaryBtn = 'h-12 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60 mt-1';
const linkBtn = 'font-semibold text-ink underline underline-offset-2';

// "¿Olvidaste tu contraseña?" (§275). El aviso es el mismo haya o no una cuenta con ese email: el backend tampoco lo
// dice. El link del email lleva a /restablecer (ResetPasswordPage).
function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    setError('');
    setSending(true);
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(userMessage(err, 'No pudimos mandar el pedido. Revisá tu conexión y probá de nuevo.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="text-[17px] font-bold text-ink">Recuperar la contraseña</h2>
      {sent ? (
        <p role="status" className="text-[15px] leading-snug text-ink-soft">
          Si hay una cuenta con ese email, te mandamos un link para elegir una contraseña nueva. Vence en 1 hora; si no
          lo ves, revisá el correo no deseado.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <p className="text-[15px] leading-snug text-ink-soft">Escribí el email de tu cuenta y te mandamos un link para elegir una contraseña nueva.</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-email" className={lbl}>Email</label>
            <input id="forgot-email" className={inp(!!error)} type="email" aria-label="Email" autoComplete="email" placeholder="nombre@correo.com"
              value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
          </div>
          {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
          <button type="submit" disabled={sending} className={primaryBtn}>{sending ? 'Mandando…' : 'Mandarme el link'}</button>
        </form>
      )}
      <p className="text-center text-[13px]">
        <button type="button" onClick={onBack} className={linkBtn}>Volver a iniciar sesión</button>
      </p>
    </div>
  );
}

const ROLES = [
  { id: 'volunteer' as const, label: 'Voluntario', icon: User,      hint: 'Me sumo, dono y cuento lo que hice' },
  { id: 'ngo'       as const, label: 'ONG',        icon: Heart,     hint: 'Publico voluntariados y recibo ayuda' },
  { id: 'company'   as const, label: 'Empresa',    icon: Building2, hint: 'Patrocino y sumo a mi equipo' },
];
type Role = typeof ROLES[number]['id'];

// Tipo de cuenta: lo usan el registro y la pantalla de rol de Google (§314).
function RolePicker({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="mb-5">
      <p id="tipo-cuenta" className={`${lbl} mb-2`}>Elegí cómo vas a usar la app</p>
      <div role="radiogroup" aria-labelledby="tipo-cuenta" className="flex flex-col gap-2">
        {ROLES.map(({ id, label, icon: Icon, hint }) => {
          const on = role === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onChange(id)}
              className={`min-h-16 px-3.5 py-2.5 rounded-xl border-[1.5px] flex items-center gap-3 text-left transition-colors ${on ? 'border-ink' : 'border-hairline hover:bg-surface-soft'}`}>
              <span className={`w-10 h-10 bg-surface-soft flex items-center justify-center flex-shrink-0 ${id === 'volunteer' ? 'rounded-full' : 'rounded-[28%]'}`}>
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-[15px] font-semibold">{label}</span>
                <span className="text-[13px] text-ink-muted">{hint}</span>
              </span>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${on ? 'bg-ink text-on-ink' : 'border-[1.5px] border-border-strong'}`} aria-hidden="true">
                {on && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A dónde va cada rol después de entrar (login, registro y Google).
function useGoHome() {
  const navigate = useNavigate();
  return (u: AppUser) => {
    if (u.role === 'ngo') navigate('/ngo/dashboard');
    else if (u.role === 'company') navigate('/company/profile');
    else if (window.location.pathname === '/') navigate('/feed');
  };
}

// §314: el botón lo dibuja Google (lib/googleSignIn). Si Google no carga, no se muestra nada (ni el separador).
function GoogleSection({ onCredential }: { onCredential: (credential: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onCredential);
  latest.current = onCredential;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    renderGoogleButton(el, (c) => latest.current(c))
      .then((ok) => { if (alive && !ok) setFailed(true); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; el.replaceChildren(); };
  }, []);
  if (failed) return null;
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center gap-3 text-[13px] text-ink-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />o<span className="h-px flex-1 bg-hairline" />
      </div>
      <div ref={ref} className="flex justify-center min-h-11" />
    </div>
  );
}

// §314: primera vez con Google y sin cuenta. Rol (decisión del usuario: una pantalla para elegirlo) y el nombre, que
// arranca con el de Google. El mail es el de Google: no se puede cambiar.
const NAME_LABEL: Record<Role, string> = { volunteer: 'Nombre completo', ngo: 'Nombre de la ONG', company: 'Nombre de la empresa' };
function GoogleSignupForm({ credential, profile, onBack }: { credential: string; profile: GoogleProfile; onBack: () => void }) {
  const { googleRegister, loading } = useAuth();
  const goHome = useGoHome();
  const [role, setRole] = useState<Role>('volunteer');
  const [name, setName] = useState(profile.name ?? '');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    setError('');
    try {
      goHome(await googleRegister(credential, role, name.trim()));
    } catch (err) {
      setError(userMessage(err, 'No pudimos crear la cuenta. Probá de nuevo.'));
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="text-[17px] font-bold text-ink">Crear tu cuenta</h2>
      <p className="text-[15px] leading-snug text-ink-soft">Vas a entrar con <span className="font-semibold text-ink break-all">{profile.email}</span>.</p>
      <RolePicker role={role} onChange={(r) => { setRole(r); setError(''); }} />
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="google-name" className={lbl}>{NAME_LABEL[role]}</label>
          <input id="google-name" className={inp(!!nameError)} aria-label={NAME_LABEL[role]}
            value={name} onChange={e => { setName(e.target.value); setNameError(''); setError(''); }} />
          {nameError && <p role="alert" className="text-[13px] text-critical">{nameError}</p>}
        </div>
        {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
        <button type="submit" disabled={loading} className={primaryBtn}>{loading ? 'Un momento…' : 'Crear cuenta'}</button>
        <p className="text-center text-[13px] leading-snug text-ink-muted">
          Al crear tu cuenta aceptás{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">la política de privacidad y los términos de uso</a>.
        </p>
      </form>
      <p className="text-center text-[13px]">
        <button type="button" onClick={onBack} className={linkBtn}>Volver</button>
      </p>
    </div>
  );
}

export function AuthModal() {
  const { showAuthModal, closeAuthModal, authModalIntent, authModalTab, login, register, googleLogin, loading } = useAuth();
  const goHome = useGoHome();
  const [tab, setTab]         = useState<Tab>('login');
  const [role, setRole]       = useState<Role>('volunteer');
  // §314: primera vez con Google, sin cuenta → pantalla de rol con la misma credencial.
  const [googleSignup, setGoogleSignup] = useState<{ credential: string; profile: GoogleProfile } | null>(null);
  const [error, setError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' });
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [forgot, setForgot]   = useState<{ email: string } | null>(null);   // §275: "¿Olvidaste tu contraseña?"

  useEffect(() => {
    if (showAuthModal) {
      setTab(authModalTab);
    }
  }, [showAuthModal, authModalTab]);

  // Reset on open/tab change
  useEffect(() => {
    setError(''); setFieldErrors({ name: '', email: '', password: '' });
    setForm({ name: '', email: '', password: '' });
    setForgot(null);
    setGoogleSignup(null);
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
    try {
      goHome(await login(form.email, form.password));
    } catch (err: any) { setError(err.message); }
  };

  const handleGoogle = async (credential: string) => {
    setError('');
    try {
      const r = await googleLogin(credential);
      if ('user' in r) goHome(r.user);
      else setGoogleSignup({ credential, profile: r.profile });
    } catch (err) {
      setError(userMessage(err, 'No pudimos entrar con Google. Probá de nuevo.'));
    }
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
    try {
      goHome(await register(form.name, form.email, form.password, role));
    } catch (err: any) { setError(err.message); }
  };

  return (
    <Modal onClose={closeAuthModal} label={forgot ? 'Recuperar la contraseña' : googleSignup ? 'Crear tu cuenta' : tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      overlayClassName="fixed inset-0 bg-[var(--scrim)] z-50 flex items-end sm:items-center justify-center animate-fadeIn"
      className="bg-surface text-ink w-full sm:max-w-md rounded-t-[24px] sm:rounded-2xl shadow-[var(--elev-sheet)] sm:shadow-[var(--elev-popover)] overflow-hidden max-h-[95dvh] overflow-y-auto animate-sheetUp sm:animate-riseIn">

        {/* Manija (celular) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
          <div className="w-9 h-1 bg-hairline rounded-full" />
        </div>

        <div className="pl-5 pr-1 pt-3 pb-1 flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <Logo />
            {authModalIntent && <p className="text-[15px] leading-snug text-ink-soft max-w-[20rem]">{authModalIntent}</p>}
          </div>
          <button type="button" onClick={closeAuthModal} aria-label="Cerrar"
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-surface-soft transition-colors flex-shrink-0">
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-2 pb-6">
          {forgot ? <ForgotPasswordForm initialEmail={forgot.email} onBack={() => setForgot(null)} />
          : googleSignup ? <GoogleSignupForm credential={googleSignup.credential} profile={googleSignup.profile} onBack={() => setGoogleSignup(null)} />
          : <>
          <div role="tablist" aria-label="Acceso" className="flex h-11 p-1 rounded-[10px] bg-surface-soft mb-5">
            {(['login', 'register'] as Tab[]).map(t => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`flex-1 rounded-lg text-[13px] transition-colors ${tab === t ? 'bg-surface font-bold text-ink' : 'font-semibold text-ink-soft'}`}>
                {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {/* Tipo de cuenta */}
          {tab === 'register' && <RolePicker role={role} onChange={setRole} />}

          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-3.5" noValidate>
            {tab === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-name" className={lbl}>Nombre completo</label>
                <input id="auth-name" className={inp(!!fieldErrors.name)} aria-label="Nombre completo" placeholder="Tu nombre completo"
                  value={form.name} onChange={e => setField('name', e.target.value)} />
                {fieldErrors.name && <p role="alert" className="text-[13px] text-critical">{fieldErrors.name}</p>}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-email" className={lbl}>Email</label>
              <input id="auth-email" className={inp(!!fieldErrors.email)} type="email" aria-label="Email" placeholder="nombre@correo.com"
                value={form.email} onChange={e => setField('email', e.target.value)} />
              {fieldErrors.email && <p role="alert" className="text-[13px] text-critical">{fieldErrors.email}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-pass" className={lbl}>Contraseña</label>
              <PasswordInput id="auth-pass" className={inp(!!fieldErrors.password)} aria-label="Contraseña"
                placeholder={tab === 'register' ? 'Mínimo 8 caracteres, 1 mayúscula y 1 número' : 'Tu contraseña'}
                value={form.password} onChange={e => setField('password', e.target.value)} />
              {tab === 'register' && <PasswordStrength password={form.password} />}
              {tab === 'login' && (
                <button type="button" onClick={() => setForgot({ email: form.email })} className={`self-end text-[13px] ${linkBtn}`}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
              {fieldErrors.password && <p role="alert" className="text-[13px] text-critical">{fieldErrors.password}</p>}
            </div>

            {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}

            <button type="submit" disabled={loading} className={primaryBtn}>
              {loading ? 'Un momento…' : tab === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
            {/* §179: en otra pestaña, para no perder lo que ya se escribió en el formulario. */}
            {tab === 'register' && (
              <p className="text-center text-[13px] leading-snug text-ink-muted">
                Al crear tu cuenta aceptás{' '}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">la política de privacidad y los términos de uso</a>.
              </p>
            )}
          </form>

          {googleClientId() && <GoogleSection onCredential={handleGoogle} />}

          <p className="text-center text-[13px] text-ink-muted mt-4">
            {tab === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button type="button" onClick={() => setTab(tab === 'login' ? 'register' : 'login')} className={linkBtn}>
              {tab === 'login' ? 'Creá una gratis' : 'Ingresá'}
            </button>
          </p>
          </>}
        </div>
    </Modal>
  );
}
