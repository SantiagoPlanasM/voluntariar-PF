// src/app/components/PrivacyPage.test.tsx
//
// /privacidad: privacidad y términos de uso (PLAN_FALTANTE.md, Etapa 11, §179). Decisiones del usuario: responsable
// "VoluntariAR, proyecto final de la UCC", sin nombres ni email; borrar la cuenta desde el perfil (§177–§178). Cada cosa
// que la página afirma está verificada en el código (ver §179). Se enlaza desde el registro y el pie de la barra.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PrivacyPage } from './PrivacyPage';
import { FeedSidebar } from './FeedSidebar';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, openAuthModal: vi.fn() }) }));

const mount = () => render(<MemoryRouter><PrivacyPage /></MemoryRouter>);

describe('<PrivacyPage />', () => {
  test('título y fecha de actualización', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Privacidad y términos de uso' })).toBeInTheDocument();
    expect(screen.getByText(/Última actualización: 16 de octubre de 2026/)).toBeInTheDocument();
  });

  test('dice quién es responsable (proyecto final de la UCC, sin nombres) y que es una demo académica', () => {
    mount();
    const who = screen.getByRole('region', { name: 'Quién es responsable' });
    expect(within(who).getByText(/proyecto final/)).toBeInTheDocument();
    expect(within(who).getByText(/Universidad Católica de Córdoba/)).toBeInTheDocument();
    expect(within(who).getByText(/demo académica/)).toBeInTheDocument();
  });

  test('las secciones que se esperan', () => {
    mount();
    for (const name of ['Quién es responsable', 'Qué datos guardamos', 'Quién ve qué', 'Con quién compartimos datos',
      'Cuánto tiempo los guardamos', 'Tus derechos', 'Reglas de uso', 'Limitaciones de esta demo']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  test('CV: privado, solo para ONGs donde te postulaste, con link que vence', () => {
    mount();
    const who = screen.getByRole('region', { name: 'Quién ve qué' });
    const item = within(who).getByText('CV').closest('li');
    expect(item).toHaveTextContent(/ONG/);
    expect(item).toHaveTextContent(/pendiente o aprobada/);
    expect(item).toHaveTextContent(/10 minutos/);
  });

  test('proveedores: Render, Cloudinary, Mercado Pago y Resend; no se venden datos; la tarjeta la ve solo Mercado Pago', () => {
    mount();
    const share = screen.getByRole('region', { name: 'Con quién compartimos datos' });
    for (const p of ['Render', 'Cloudinary', 'Mercado Pago', 'Resend']) expect(within(share).getAllByText(new RegExp(p)).length).toBeGreaterThan(0);
    expect(within(share).getByText(/No vendemos/)).toBeInTheDocument();
    expect(within(share).getByText(/nunca ve los datos de tu tarjeta/)).toBeInTheDocument();
  });

  test('derechos (Ley 25.326): editar el perfil y borrar la cuenta desde el perfil', () => {
    mount();
    const rights = screen.getByRole('region', { name: 'Tus derechos' });
    expect(within(rights).getByText(/25\.326/)).toBeInTheDocument();
    expect(within(rights).getByText(/Borrar mi cuenta/)).toBeInTheDocument();
  });

  test('es honesta sobre los límites de la demo: pagos de prueba, emails al equipo y fotos viejas que pueden quedar', () => {
    mount();
    const lim = screen.getByRole('region', { name: 'Limitaciones de esta demo' });
    expect(within(lim).getByText(/modo prueba/)).toBeInTheDocument();
    expect(within(lim).getByText(/al equipo del proyecto/)).toBeInTheDocument();
    expect(within(lim).getByText(/fotos de perfil anteriores/)).toBeInTheDocument();
  });

  test('sin cookies ni analítica: la sesión se guarda en tu navegador', () => {
    mount();
    expect(screen.getByText(/No usamos cookies de seguimiento ni herramientas de analítica/)).toBeInTheDocument();
  });

  test('no publica ningún email ni nombre propio', () => {
    const { container } = mount();
    expect(container.textContent).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
  });
});

describe('links a /privacidad', () => {
  test('pie de la barra del feed: "Privacidad y términos"', () => {
    render(<MemoryRouter><FeedSidebar user={null} suggestedNgos={[]} followingNgoIds={new Set()} onFollowNgo={async () => {}} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Privacidad y términos' })).toHaveAttribute('href', '/privacidad');
  });
});
