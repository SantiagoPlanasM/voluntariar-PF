// Accesos del Panel de la ONG a Postulaciones, Patrocinios, Publicaciones, Equipo y Validación. En escritorio están en la
// barra lateral, pero en el celular no: la barra inferior solo tiene Panel, Explorar, Crear, Mensajes y Perfil (cinco como
// máximo), y estas pantallas quedaban sin acceso (Equipo, solo por Configuración). En escritorio van en una grilla de dos;
// Postulaciones (§319), la más usada, primero y a lo ancho.
// Validación (§317): DESIGN.md pide "Validar la ONG" desde el Panel y Configuración.
import { Camera, Handshake, UserCheck } from 'lucide-react';
import { NGOTeamCard } from './NGOTeamCard';
import { NGOValidationCard } from './NGOValidation';
import { ShortcutCard } from './ShortcutCard';

// `stacked`: de a uno por fila, para la columna derecha del Panel desde 1280 px (§321), que es angosta para dos.
export function NGOShortcuts({ stacked = false }: { stacked?: boolean }) {
  return (
    <nav aria-label="Accesos del panel" className={`grid gap-3 ${stacked ? '' : 'md:grid-cols-2'}`}>
      <div className={stacked ? '' : 'md:col-span-2'}>
        <ShortcutCard to="/ngo/postulaciones" icon={UserCheck} title="Postulaciones" detail="Filtrá, buscá y decidí varias juntas" />
      </div>
      <ShortcutCard to="/ngo/patrocinios" icon={Handshake} title="Patrocinios" detail="Propuestas y acuerdos con empresas" />
      <ShortcutCard to="/ngo/momentos" icon={Camera} title="Publicaciones" detail="Momentos de tus voluntariados" />
      <NGOTeamCard />
      <NGOValidationCard />
    </nav>
  );
}
