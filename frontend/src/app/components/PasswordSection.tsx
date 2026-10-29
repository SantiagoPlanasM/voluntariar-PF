// src/app/components/PasswordSection.tsx — cambiar la contraseña en Configuración (§272).
//
// Las reglas (mínimo 8, una mayúscula, un número, distinta de la actual) y la actual correcta las valida el backend
// (PUT /api/auth/me/password) y su mensaje se muestra tal cual; acá solo se chequea que la nueva esté repetida bien.
import { useState } from 'react';
import { api } from '../../lib/api';
import { userMessage } from '../../lib/format';

const btn = 'h-11 px-3.5 rounded-[10px] text-[15px] font-semibold inline-flex items-center justify-center disabled:opacity-40';
const field = 'w-full h-11 px-3 rounded-[10px] bg-surface-soft border border-hairline text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500';
const EMPTY = { current: '', next: '', repeat: '' };

export function PasswordSection() {
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => (f ? { ...f, [k]: e.target.value } : f));

  const save = async () => {
    if (!form) return;
    if (form.next !== form.repeat) { setError('Las dos contraseñas nuevas no coinciden'); return; }
    setSaving(true);
    setError('');
    try {
      await api.auth.changePassword(form.current, form.next);
      setForm(null);
      setDone(true);
    } catch (e) {
      setError(userMessage(e, 'No pudimos cambiar la contraseña. Revisá tu conexión y probá de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Contraseña" className="rounded-xl bg-surface border border-hairline p-4 flex flex-col gap-2">
      {!form ? (
        <button type="button" onClick={() => { setForm(EMPTY); setDone(false); setError(''); }}
          className={`${btn} self-start -ml-3.5 text-ink hover:bg-surface-soft`}>Cambiar contraseña</button>
      ) : (
        <div role="group" aria-label="Cambiar contraseña" className="flex flex-col gap-2">
          <input type="password" aria-label="Contraseña actual" autoComplete="current-password" value={form.current} onChange={set('current')} className={field} />
          <input type="password" aria-label="Contraseña nueva" autoComplete="new-password" maxLength={72} value={form.next} onChange={set('next')} className={field} />
          <input type="password" aria-label="Repetí la contraseña nueva" autoComplete="new-password" maxLength={72} value={form.repeat} onChange={set('repeat')} className={field} />
          <p className="text-[13px] text-ink-muted">Mínimo 8 caracteres, con una mayúscula y un número.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={saving || !form.current || !form.next || !form.repeat}
              className={`${btn} bg-ink text-on-ink hover:opacity-90`}>Guardar contraseña</button>
            <button type="button" onClick={() => { setForm(null); setError(''); }} disabled={saving} className={`${btn} bg-surface-soft text-ink`}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] font-medium text-critical">{error}</p>}
      {done && <p role="status" className="text-[13px] font-semibold text-people-text">Listo: tu contraseña cambió.</p>}
    </section>
  );
}
