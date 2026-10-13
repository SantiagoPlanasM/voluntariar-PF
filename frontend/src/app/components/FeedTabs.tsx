// src/app/components/FeedTabs.tsx
//
// Pestañas "Proyectos | Momentos" del feed. Son ENLACES a rutas (no estado local): así funcionan el botón
// "atrás" y los links directos, y MainFeed / PublicFeed no cargan los dos feeds a la vez.
import { Link } from 'react-router';

interface Props {
  active: 'projects' | 'moments';
  projectsHref: string;
  momentsHref: string;
}

export function FeedTabs({ active, projectsHref, momentsHref }: Props) {
  const tabs = [
    { key: 'projects', label: 'Proyectos', to: projectsHref },
    { key: 'moments', label: 'Momentos', to: momentsHref },
  ] as const;

  return (
    <nav aria-label="Secciones del feed" className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
      {tabs.map(({ key, label, to }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 text-center py-2 rounded-xl text-sm font-semibold transition-colors ${
              isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
