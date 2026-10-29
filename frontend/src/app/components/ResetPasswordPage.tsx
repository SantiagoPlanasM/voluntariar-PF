// src/app/components/ResetPasswordPage.tsx
//
// /restablecer?token=…: adonde lleva el email de "¿Olvidaste tu contraseña?" (§275). No hace falta sesión: el código del
// link es lo que autoriza. Pide la contraseña nueva dos veces (las reglas y el link las valida el backend y su mensaje
// se muestra tal cual) y, al salir bien, ofrece iniciar sesión. No inicia sesión sola.
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CheckCircle, KeyRound, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { userMessage } from '../../lib/format';
import { PasswordInput } from '../ui/PasswordInput';

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
const btn = 'h-11 px-4 rounded-[10px] text-[15px] font-semibold inline-flex items-center justify-center disabled:opacity-40';
const field = 'w-full h-11 px-3 rounded-[10px] bg-surface-soft border border-hairline text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500';

export function ResetPasswordPage() {
  const { openAuthModal } = useAuth();
  const token = new URLSearchParams(useLocation().search).get('token') ?? '';
  const [form, setForm] = useState({ next: '', repeat: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    if (form.next !== form.repeat) { setError('Las dos contraseñas no coinciden'); return; }
    setError('');
    setSaving(true);
    try {
      await api.auth.resetPassword(token, form.next);
      setDone(true);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
    } finally {
      setSaving(false);
    }
  };

  const login = () => openAuthModal('', 'login');
  const card = (icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <div className="bg-surface text-ink rounded-2xl border border-hairline p-6 flex flex-col gap-3">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-lg font-bold text-center">{title}</h1>
      <div className="text-[15px] text-ink-soft flex flex-col gap-3">{body}</div>
    </div>
  );
  const home = <Link to="/" className={`${btn} bg-surface-soft text-ink`}>Ir al inicio</Link>;
  const askAgain = <button type="button" onClick={login} className={`${btn} bg-surface-soft text-ink`}>Pedir un link nuevo</button>;

  let content: React.ReactNode;
  if (done) {
    content = card(<CheckCircle className="w-10 h-10 text-people-text" aria-hidden="true" />, 'Listo: tu contraseña cambió', <>
      <p className="text-center">Ya podés entrar con la contraseña nueva.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={login} className={`${btn} bg-ink text-on-ink hover:opacity-90`}>Iniciar sesión</button>
        {home}
      </div>
    </>);
  } else if (!token) {
    content = card(<XCircle className="w-10 h-10 text-ink-muted" aria-hidden="true" />, 'Este link no es válido', <>
      <p className="text-center">Pedí uno nuevo desde "¿Olvidaste tu contraseña?", al iniciar sesión.</p>
      <div className="flex flex-wrap justify-center gap-2">{askAgain}{home}</div>
    </>);
  } else {
    content = card(<KeyRound className="w-10 h-10 text-ink" aria-hidden="true" />, 'Elegí una contraseña nueva', <>
      <PasswordInput aria-label="Contraseña nueva" toggleLabel="Mostrar contraseña nueva" autoComplete="new-password" maxLength={72}
        value={form.next} onChange={e => setForm(f => ({ ...f, next: e.target.value }))} className={field} />
      <PasswordInput aria-label="Repetí la contraseña nueva" toggleLabel="Mostrar la repetición de la contraseña nueva" autoComplete="new-password" maxLength={72}
        value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))} className={field} />
      <p className="text-[13px] text-ink-muted">Mínimo 8 caracteres, con una mayúscula y un número.</p>
      {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => void save()} disabled={saving || !form.next || !form.repeat}
          className={`${btn} bg-ink text-on-ink hover:opacity-90`}>{saving ? 'Guardando…' : 'Guardar contraseña'}</button>
        {error && askAgain}
      </div>
    </>);
  }
  return <div className="min-h-screen bg-canvas px-4 py-16 max-w-md mx-auto">{content}</div>;
}
