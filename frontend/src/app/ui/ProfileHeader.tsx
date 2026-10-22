// Cabecera común de los perfiles (DESIGN.md → Perfiles): avatar de 88 px a la izquierda y tres estadísticas a la
// derecha; abajo el nombre, el texto y una fila de botones. Voluntario = avatar redondo, ONG o empresa = cuadrado.
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from './Avatar';

export interface ProfileStat { n: number | string; label: string; onClick?: () => void }

interface Props {
  name: string;
  avatar?: string | null;
  kind: 'person' | 'org';
  stats: ProfileStat[];
  /** Línea chica bajo el nombre (ubicación, rol…). */
  subtitle?: string;
  bio?: string | null;
  actions?: ReactNode;
  /** Texto de ayuda o error bajo los botones. */
  notice?: ReactNode;
  onBack?: () => void;
  /** Acción de la esquina (por ejemplo, Configuración en el perfil propio). */
  corner?: ReactNode;
}

export function ProfileHeader({ name, avatar, kind, stats, subtitle, bio, actions, notice, onBack, corner }: Props) {
  return (
    <>
      <header className="h-[52px] pl-1 pr-1 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft flex-shrink-0">
              <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <h1 className={`text-lg font-bold tracking-[-0.2px] truncate ${onBack ? '' : 'pl-3'}`}>{name}</h1>
        </div>
        {corner}
      </header>

      <div className="px-4 pt-2 flex items-center gap-4">
        <Avatar src={avatar} name={name} kind={kind} size={88} alt={name} />
        <div className="flex-1 flex" role="group" aria-label="Estadísticas">
          {stats.map(s => {
            const inner = (<><span className="text-[15px] font-bold">{s.n}</span><span className="text-xs font-semibold text-ink-soft">{s.label}</span></>);
            return s.onClick
              ? <button key={s.label} type="button" onClick={s.onClick} className="flex-1 flex flex-col items-center gap-0.5 min-h-11 justify-center">{inner}</button>
              : <div key={s.label} className="flex-1 flex flex-col items-center gap-0.5 min-h-11 justify-center">{inner}</div>;
          })}
        </div>
      </div>

      <div className="px-4 pt-3 flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold">{name}</p>
        {subtitle && <p className="text-[13px] text-ink-muted">{subtitle}</p>}
        {bio && <p className="text-[15px] leading-[1.45] whitespace-pre-line break-words">{bio}</p>}
      </div>

      {actions && <div className="px-4 pt-4 flex gap-2">{actions}</div>}
      {notice && <div className="px-4 pt-2">{notice}</div>}
    </>
  );
}

/** Pestañas de un perfil (con rol `tablist`). */
export function ProfileTabs<T extends string>({ tabs, value, onChange, label }:
  { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mt-5 flex border-b border-hairline">
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={`flex-1 h-12 text-[13px] border-b-2 -mb-px transition-colors ${value === t.key ? 'border-ink font-bold text-ink' : 'border-transparent font-semibold text-ink-muted'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
