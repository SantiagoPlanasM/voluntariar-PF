// Un acceso del Panel de la ONG (NGOShortcuts): ícono, título, una línea opcional y la flecha.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export function ShortcutCard({ to, icon: Icon, title, detail }: { to: string; icon: LucideIcon; title: string; detail?: ReactNode }) {
  return (
    <Link to={to} className="rounded-xl bg-surface border border-hairline min-h-[60px] px-4 py-3 flex items-center gap-3 hover:bg-surface-soft">
      <Icon size={22} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[15px] font-bold">{title}</span>
        {detail && <span className="text-[13px] text-ink-soft">{detail}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="text-ink-muted flex-shrink-0" aria-hidden="true" />
    </Link>
  );
}
