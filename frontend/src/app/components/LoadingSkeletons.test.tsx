// src/app/components/LoadingSkeletons.test.tsx — T6 (§335): esqueletos en vez de spinner a pantalla completa.
//
// DESIGN.md → Estados: "Cargando: esqueletos con la forma final […]. Nunca un spinner a pantalla completa." Cinco
// pantallas todavía cargaban con un círculo girando en el medio de la pantalla (hallazgo B9 del barrido del 12/11):
// la guarda de rol, el panel del equipo, el perfil de la empresa, la gestión de un voluntariado y el formulario de
// edición. Acá cada una se monta con el pedido en vuelo (fetch que no responde) y se mira qué muestra.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';

const { auth } = vi.hoisted(() => ({
  auth: {
    user: { id: 'u-1', name: 'Ana Pérez', email: 'ana@x.com', role: 'ngo' } as null | Record<string, unknown>,
    initializing: false, openAuthModal: vi.fn(),
  },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));

import { RequireRole } from './RequireRole';
import { TeamPanel } from './TeamPanel';
import { CompanyOwnProfile } from './CompanyOwnProfile';
import { NGOProjectDetail } from './NGOProjectDetail';
import { CreateVoluntariado } from './CreateVoluntariado';

const at = (path: string, route: string, el: ReactElement) => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>,
);

const SCREENS: { name: string; label: string; mount: () => unknown }[] = [
  { name: 'guarda de rol (RequireRole)', label: 'Verificando sesión',
    mount: () => { auth.initializing = true; return at('/ngo/dashboard', '/ngo/dashboard', <RequireRole role="ngo"><p>Panel</p></RequireRole>); } },
  { name: 'panel del equipo (TeamPanel)', label: 'Cargando panel',
    mount: () => at('/equipo/ngo-1', '/equipo/:ngoId', <TeamPanel />) },
  { name: 'perfil de la empresa (CompanyOwnProfile)', label: 'Cargando perfil',
    mount: () => at('/company/profile', '/company/profile', <CompanyOwnProfile />) },
  { name: 'gestión de un voluntariado (NGOProjectDetail)', label: 'Cargando voluntariado',
    mount: () => at('/ngo/dashboard/project/p1', '/ngo/dashboard/project/:projectId', <NGOProjectDetail />) },
  { name: 'editar un voluntariado (CreateVoluntariado)', label: 'Cargando voluntariado',
    mount: () => at('/ngo/dashboard/project/p1/editar', '/ngo/dashboard/project/:projectId/editar', <CreateVoluntariado />) },
];

describe('mientras carga: esqueleto, no spinner a pantalla completa', () => {
  beforeEach(() => {
    auth.initializing = false;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));   // ningún pedido responde: todo queda "cargando"
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  for (const s of SCREENS) {
    test(s.name, () => {
      s.mount();
      const status = screen.getByRole('status', { name: s.label });
      expect(status.querySelectorAll('.skeleton').length).toBeGreaterThan(1);
      expect(status.querySelector('.animate-spin')).toBeNull();
      expect(document.querySelector('.animate-spin')).toBeNull();
      // Los bloques grises son decoración: el lector de pantalla solo anuncia el nombre del estado.
      for (const block of status.querySelectorAll('.skeleton')) expect(block.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  }
});

// Para que no vuelva a aparecer en otra pantalla: ningún componente centra un Loader2 en un contenedor del alto de
// la pantalla. Los spinners dentro de una sección o de un botón no son esto y siguen permitidos.
describe('en el código', () => {
  const DIRS = ['.', '../layout', '../ui', '../volunteering', '../team'].map(d => fileURLToPath(new URL(d, import.meta.url)));
  const FULL_SCREEN_SPINNER = /className="[^"]*\b(?:min-)?h-screen\b[^"]*"[^>]*>\s*<Loader2\b[^>]*animate-spin/;

  test('ningún componente tiene un spinner a pantalla completa', () => {
    const found: string[] = [];
    let seen = 0;
    for (const dir of DIRS) {
      for (const rel of readdirSync(dir) as string[]) {
        if (!rel.endsWith('.tsx') || rel.includes('.test.')) continue;
        seen++;
        if (FULL_SCREEN_SPINNER.test(readFileSync(join(dir, rel), 'utf8'))) found.push(rel);
      }
    }
    expect(seen).toBeGreaterThan(60);   // si no lee archivos, el test no probaría nada
    expect(found).toEqual([]);
  });
});
