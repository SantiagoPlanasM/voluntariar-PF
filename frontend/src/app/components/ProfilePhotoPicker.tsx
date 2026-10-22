// src/app/components/ProfilePhotoPicker.tsx
//
// "Cambiar foto" del perfil propio: el mismo componente para voluntario, ONG y empresa (PLAN_FALTANTE.md, Etapa 2).
// Comprime la foto en el navegador como Momentos (lib/imageCompress), la sube con PUT /api/auth/me/photo (§162) y
// actualiza la sesión, así la foto nueva se ve en la barra, el chat y las reseñas sin recargar. `onUploaded` le
// pasa la URL a la pantalla, para que la ONG o la empresa actualicen su logo en el estado local.
import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { ACCEPTED_TYPES, compressImage } from '../../lib/imageCompress';
import { userMessage } from '../../lib/format';

const NETWORK_ERROR = 'No pudimos subir la foto. Revisá tu conexión y probá de nuevo.';

export function ProfilePhotoPicker({ onUploaded }: { onUploaded?: (url: string) => void }) {
  const { updateUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';   // que elegir el mismo archivo otra vez vuelva a disparar el cambio
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const ready = await compressImage(file);
      const form = new FormData();
      form.append('photo', ready);
      const { user } = await api.auth.uploadPhoto(form);
      updateUser(user);
      if (user.avatar) onUploaded?.(user.avatar);
    } catch (err) {
      setError(userMessage(err, NETWORK_ERROR));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={() => input.current?.click()} disabled={uploading}
        className="inline-flex items-center gap-1.5 h-10 px-3.5 bg-surface hover:bg-surface-pressed disabled:opacity-60 text-ink text-[13px] rounded-[10px] font-semibold transition-colors">
        <Camera className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        <span>{uploading ? 'Subiendo foto…' : 'Cambiar foto'}</span>
      </button>
      <input ref={input} type="file" accept={ACCEPTED_TYPES.join(',')} aria-label="Elegir una foto de perfil"
        className="hidden" onChange={onChange} />
      {error && <p role="alert" className="text-[13px] font-medium text-critical max-w-xs">{error}</p>}
    </div>
  );
}
