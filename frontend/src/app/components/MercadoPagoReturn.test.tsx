// src/app/components/MercadoPagoReturn.test.tsx
//
// /ngo/mercadopago/vuelta (Marketplace, PROJECT_ANALYSIS.md §218): adonde vuelve la ONG desde Mercado Pago con
// `?code=…&state=…`. Le pasa los dos al backend (con su sesión), que comprueba el state y cambia el code por los tokens.
// El code se puede usar UNA vez: en StrictMode el efecto corre dos veces y no puede mandarse dos veces.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError } from '../../lib/api';
import { MercadoPagoReturn } from './MercadoPagoReturn';

const mount = (search: string) => render(
  <StrictMode>
    <MemoryRouter initialEntries={[`/ngo/mercadopago/vuelta${search}`]}><Routes>
      <Route path="/ngo/mercadopago/vuelta" element={<MercadoPagoReturn />} />
      <Route path="/ngo/profile" element={<p>perfil de la ONG</p>} />
    </Routes></MemoryRouter>
  </StrictMode>);
const account = { mp_user_id: '3772556008', status: 'active' as const, origin: 'oauth' as const, expires_at: null };

beforeEach(() => { vi.restoreAllMocks(); });

describe('<MercadoPagoReturn />', () => {
  test('con code y state: los manda UNA vez (aun en StrictMode) y confirma la vinculación', async () => {
    const cb = vi.spyOn(api.ngos.mercadopago, 'callback').mockResolvedValue({ account });
    mount('?code=TG-abc-3772556008&state=st-1');
    expect(await screen.findByRole('heading', { name: 'Tu cuenta de Mercado Pago quedó vinculada' })).toBeInTheDocument();
    expect(screen.getByText(/ya pueden recibir donaciones/i)).toBeInTheDocument();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('TG-abc-3772556008', 'st-1');
    fireEvent.click(screen.getByRole('link', { name: 'Ir a mi perfil' }));
    expect(screen.getByText('perfil de la ONG')).toBeInTheDocument();
  });

  test('mientras espera: "Vinculando…"', async () => {
    vi.spyOn(api.ngos.mercadopago, 'callback').mockReturnValue(new Promise(() => {}));
    mount('?code=TG-c&state=s');
    expect(await screen.findByText(/Vinculando tu cuenta/)).toBeInTheDocument();
  });

  test('error del backend: muestra su mensaje y ofrece volver a intentar desde el perfil', async () => {
    vi.spyOn(api.ngos.mercadopago, 'callback').mockRejectedValue(new ApiError('El link de vinculación venció. Probá vincular de nuevo.', 400));
    mount('?code=TG-c&state=s');
    expect(await screen.findByRole('heading', { name: 'No se pudo vincular la cuenta' })).toBeInTheDocument();
    expect(screen.getByText('El link de vinculación venció. Probá vincular de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a intentar' })).toHaveAttribute('href', '/ngo/profile#mercadopago');
  });

  test('error de red (no ApiError): mensaje genérico', async () => {
    vi.spyOn(api.ngos.mercadopago, 'callback').mockRejectedValue(new TypeError('Failed to fetch'));
    mount('?code=TG-c&state=s');
    expect(await screen.findByText(/No pudimos conectarnos con el servidor/)).toBeInTheDocument();
  });

  test('sin code o sin state (por ejemplo, la ONG no autorizó): no llama al backend', async () => {
    const cb = vi.spyOn(api.ngos.mercadopago, 'callback');
    for (const [q, msg] of [['?state=s', 'El link de vuelta no es válido.'], ['?code=TG-c', 'El link de vuelta no es válido.'],
      ['', 'El link de vuelta no es válido.'], ['?error=access_denied&state=s', 'No autorizó la vinculación en Mercado Pago.']]) {
      const { unmount } = mount(q);
      expect(await screen.findByRole('heading', { name: 'No se pudo vincular la cuenta' })).toBeInTheDocument();
      expect(screen.getByText(msg)).toBeInTheDocument();
      unmount();
    }
    expect(cb).not.toHaveBeenCalled();
  });
});
