// Mosaico de voluntariado (DESIGN.md → Explorar / pestaña Voluntariados): foto 4:5 con radio 12, título de
// hasta 2 líneas, una línea de datos y una mini barra de voluntarios. Es un <Link>: se enfoca con Tab y se
// abre con Enter.
import { Link } from 'react-router';
import type { Project } from '../../lib/api';
import { Meter, pct } from '../ui/Meter';
import { LogoMark } from '../ui/Logo';
import { TypeBadge } from '../ui/TypeBadge';
import { imagePositionClass } from './imagePosition';

export function VolunteeringTile({ project, note }: { project: Project; note?: string }) {
  const people = pct(project.current_volunteers, project.volunteers_needed);
  const meta = [project.location?.split(',')[0], project.type === 'fugaz' ? project.duration : null].filter(Boolean).join(' · ');
  return (
    <Link to={`/project/${project.id}`} className="group flex flex-col gap-1.5 min-w-0">
      <span className="relative block aspect-[4/5] rounded-xl overflow-hidden bg-surface-soft">
        {project.image ? (
          <img src={project.image} alt="" loading="lazy" className={`w-full h-full object-cover ${imagePositionClass(project.image_position)} transition-transform duration-300 group-hover:scale-[1.02]`} />
        ) : (
          <span className="w-full h-full flex items-center justify-center opacity-30" aria-hidden="true"><LogoMark size={48} /></span>
        )}
        <TypeBadge type={project.type} variant="photo" className="absolute top-2 left-2 !h-6 !px-2" />
      </span>
      <span className="text-[15px] font-semibold leading-snug line-clamp-2">{project.title}</span>
      <span className={`text-[13px] text-ink-muted ${note ? 'line-clamp-2' : 'truncate'}`}>{note ?? (meta || project.ngo_name)}</span>
      {project.volunteers_needed > 0 && <Meter value={people} tone="people" thin label={`${project.current_volunteers} de ${project.volunteers_needed} voluntarios`} />}
    </Link>
  );
}
