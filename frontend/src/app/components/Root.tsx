// Layout del lado "voluntario/público" (y de las pantallas compartidas: explorar, voluntariado, perfiles).
// La navegación (barra inferior, lateral y superior) vive en layout/AppShell y es la misma para los tres roles.
import { AppShell } from '../layout/AppShell';

export function Root() {
  return <AppShell />;
}
