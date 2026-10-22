import { AppShell } from '../layout/AppShell';
import { RequireRole } from './RequireRole';

export function CompanyLayout() {
  // Solo para su rol: con otro rol o sin sesión redirige (§97).
  return (
    <RequireRole role="company">
      <AppShell />
    </RequireRole>
  );
}
