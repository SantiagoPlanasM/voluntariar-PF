// Accesos del Panel de la ONG a Patrocinios, Publicaciones y Equipo. En escritorio están en la barra lateral, pero en
// el celular no: la barra inferior solo tiene Panel, Explorar, Crear, Mensajes y Perfil (cinco como máximo), y estas
// tres pantallas quedaban sin acceso (Equipo, solo por Configuración). En escritorio van en una fila de tres.
import { Camera, Handshake } from 'lucide-react';
import { NGOTeamCard } from './NGOTeamCard';
import { ShortcutCard } from './ShortcutCard';

export function NGOShortcuts() {
  return (
    <nav aria-label="Accesos del panel" className="grid gap-3 md:grid-cols-3">
      <ShortcutCard to="/ngo/patrocinios" icon={Handshake} title="Patrocinios" detail="Propuestas y acuerdos con empresas" />
      <ShortcutCard to="/ngo/momentos" icon={Camera} title="Publicaciones" detail="Momentos de tus voluntariados" />
      <NGOTeamCard />
    </nav>
  );
}
