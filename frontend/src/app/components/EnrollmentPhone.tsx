// src/app/components/EnrollmentPhone.tsx — el teléfono que dejó quien se postuló, para la ONG (§291).
// Link `tel:` (en el celular llama directo) sin espacios ni paréntesis. Sin teléfono no dibuja nada: el backend lo manda
// solo con la postulación pendiente o aprobada.
import { Phone } from 'lucide-react';

export function EnrollmentPhone({ phone, name, className = '' }: { phone?: string | null; name: string; className?: string }) {
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/[\s()]/g, '')}`} aria-label={`Llamar a ${name}: ${phone}`}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:underline ${className}`}>
      <Phone size={12} strokeWidth={2} aria-hidden="true" />{phone}
    </a>
  );
}
