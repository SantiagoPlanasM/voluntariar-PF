// src/app/components/RequireRole.test.tsx
//
// Guardas de rol en el frontend (deuda conocida, aprobada por el usuario; §97). Antes /ngo/* y /company/* se abrían
// con cualquier rol o sin sesión: el backend rechazaba los datos, pero la interfaz mostraba un panel vacío (un
// voluntario en /ngo/dashboard veía "No hay proyectos"). Ahora los layouts del panel de ONG y de empresa:
//   - mientras se verifica la sesión, muestran "cargando";
//   - sin sesión, van al inicio y abren el login;
//   - con otro rol, van al inicio de ESE rol.
// La autorización real sigue en el backend (AI_RULES regla 15): esto es experiencia de uso.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; role: string }, initializing: false, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./NGOSidebarNav', () => ({ NGOSidebarNav: () => null }));
vi.mock('./NGOBottomNav', () => ({ NGOBottomNav: () => null }));
vi.mock('./CompanySidebarNav', () => ({ CompanySidebarNav: () => null }));
vi.mock('./CompanyBottomNav', () => ({ CompanyBottomNav: () => null }));
vi.mock('./AuthModal', () => ({ AuthModal: () => null }));
vi.mock('./ChatbotWidget', () => ({ ChatbotWidget: () => null, ChatbotSpacer: () => null }));

import { NGOLayout } from './NGOLayout';
import { CompanyLayout } from './CompanyLayout';

const app = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/" element={<p>Inicio público</p>} />
      <Route path="/feed" element={<p>Feed del voluntario</p>} />
      <Route path="/ngo" element={<NGOLayout />}>
        <Route path="dashboard" element={<p>Panel ONG</p>} />
      </Route>
      <Route path="/company" element={<CompanyLayout />}>
        <Route path="profile" element={<p>Perfil empresa</p>} />
        <Route path="dashboard" element={<p>Panel empresa</p>} />
      </Route>
    </Routes>
  </MemoryRouter>
);
const as = (role: string | null) => { auth.user = role ? { id: `u-${role}`, role } : null; };

beforeEach(() => { auth.initializing = false; auth.openAuthModal.mockReset(); });

describe('panel de ONG', () => {
  test('una ONG lo ve', () => { as('ngo'); app('/ngo/dashboard'); expect(screen.getByText('Panel ONG')).toBeInTheDocument(); });

  test('un voluntario va a su feed (antes veía el panel vacío)', () => {
    as('volunteer'); app('/ngo/dashboard');
    expect(screen.getByText('Feed del voluntario')).toBeInTheDocument();
    expect(screen.queryByText('Panel ONG')).not.toBeInTheDocument();
  });

  test('una empresa va a su perfil', () => {
    as('company'); app('/ngo/dashboard');
    expect(screen.getByText('Perfil empresa')).toBeInTheDocument();
  });

  test('sin sesión: al inicio y se abre el login', () => {
    as(null); app('/ngo/dashboard');
    expect(screen.getByText('Inicio público')).toBeInTheDocument();
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
    expect(auth.openAuthModal.mock.calls[0][0]).toMatch(/Iniciá sesión/);
  });

  test('mientras se verifica la sesión: "cargando", sin panel ni redirección', () => {
    as(null); auth.initializing = true; app('/ngo/dashboard');
    expect(screen.getByRole('status', { name: 'Verificando sesión' })).toBeInTheDocument();
    expect(screen.queryByText('Inicio público')).not.toBeInTheDocument();
    expect(screen.queryByText('Panel ONG')).not.toBeInTheDocument();
    expect(auth.openAuthModal).not.toHaveBeenCalled();
  });
});

describe('cerrar sesión desde el panel', () => {
  test('si la sesión se pierde estando adentro (logout), va al inicio SIN abrir el login', () => {
    as('ngo');
    const { rerender } = app('/ngo/dashboard');
    expect(screen.getByText('Panel ONG')).toBeInTheDocument();
    as(null);
    rerender(<MemoryRouter initialEntries={['/ngo/dashboard']}><Routes>
      <Route path="/" element={<p>Inicio público</p>} />
      <Route path="/ngo" element={<NGOLayout />}><Route path="dashboard" element={<p>Panel ONG</p>} /></Route>
    </Routes></MemoryRouter>);
    expect(screen.getByText('Inicio público')).toBeInTheDocument();
    expect(auth.openAuthModal).not.toHaveBeenCalled();
  });
});

describe('panel de empresa', () => {
  test('una empresa lo ve', () => { as('company'); app('/company/dashboard'); expect(screen.getByText('Panel empresa')).toBeInTheDocument(); });

  test('una ONG va a su panel', () => {
    as('ngo'); app('/company/dashboard');
    expect(screen.getByText('Panel ONG')).toBeInTheDocument();
    expect(screen.queryByText('Panel empresa')).not.toBeInTheDocument();
  });

  test('un voluntario va a su feed', () => {
    as('volunteer'); app('/company/dashboard');
    expect(screen.getByText('Feed del voluntario')).toBeInTheDocument();
  });

  test('sin sesión: al inicio y se abre el login', () => {
    as(null); app('/company/dashboard');
    expect(screen.getByText('Inicio público')).toBeInTheDocument();
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
  });
});

// §128: #root es un flex en columna; el div exterior de cada layout (min-h-screen) se encogía al alto de la
// pantalla y su contenido se desbordaba: la última tarjeta quedaba debajo de la barra inferior y del botón del
// chatbot aunque se bajara hasta el final. jsdom no hace layout: se comprueba la clase que lo evita.
describe('los layouts no se encogen dentro de #root', () => {
  test('ONG y empresa: el contenedor exterior tiene flex-shrink-0', () => {
    as('ngo');
    const { unmount } = app('/ngo/dashboard');
    expect(screen.getByText('Panel ONG').parentElement!.parentElement!.className).toContain('flex-shrink-0');
    unmount();
    as('company');
    app('/company/profile');
    expect(screen.getByText('Perfil empresa').parentElement!.parentElement!.className).toContain('flex-shrink-0');
  });
});
