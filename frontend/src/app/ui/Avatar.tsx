// Avatar según el rol (DESIGN.md → Formas y avatares): redondo = persona, cuadrado de esquinas redondeadas
// (28 %) = organización. Sin foto: iniciales sobre `surface-soft`, nunca colores al azar.
// Las imágenes de DiceBear (las que genera el seed y el registro) son solo iniciales de colores: se tratan
// como "sin foto" para que no compitan con el azul y el verde.

const PLACEHOLDER_HOSTS = ['dicebear.com'];

export function initials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? '');
  return (first + second).toUpperCase();
}

function isPlaceholder(src?: string | null) {
  return !src || PLACEHOLDER_HOSTS.some(h => src.includes(h));
}

interface Props {
  src?: string | null;
  name: string;
  kind?: 'person' | 'org';
  size?: number;
  className?: string;
  /** Texto alternativo; vacío cuando el nombre ya está escrito al lado. */
  alt?: string;
}

export function Avatar({ src, name, kind = 'person', size = 44, className = '', alt = '' }: Props) {
  const radius = kind === 'org' ? '28%' : '9999px';
  const style = { width: size, height: size, borderRadius: radius, fontSize: Math.max(11, Math.round(size * 0.34)) };
  if (!isPlaceholder(src)) {
    return <img src={src!} alt={alt} style={style} className={`object-cover flex-shrink-0 bg-surface-soft ${className}`} />;
  }
  return (
    <span
      data-initial=""
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={style}
      className={`inline-flex items-center justify-center flex-shrink-0 bg-surface-soft text-ink font-extrabold ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/** Tilde azul de ONG validada. Hoy ninguna ONG se valida (no hay dato en el backend): no se usa todavía. */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} role="img" aria-label="ONG verificada" className="flex-shrink-0">
      <circle cx="8" cy="8" r="8" fill="var(--brand)" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
