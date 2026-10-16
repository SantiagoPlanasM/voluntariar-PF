// src/app/components/DonationReturn.test.tsx
//
// /donaciones/vuelta: adonde vuelve el comprador desde Mercado Pago (PLAN_FALTANTE.md, Etapa 9, §172). Con el id de
// la donación (external_reference) y el del pago (payment_id) le pregunta al backend, que concilia con Mercado Pago
// (§171). El estado que se muestra es SIEMPRE el del backend: el `status` de la URL solo cambia el texto mientras el
// backend sigue "pending". Mientras está pendiente, vuelve a preguntar unas veces (el aviso puede tardar).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, Donation } from '../../lib/api';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' } as Record<string, unknown> | null, initializing: false, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
import { DonationReturn } from './DonationReturn';

const donation = (status: Donation['status']): { donation: Donation } => ({
  donation: { id: 'don-1', status, amount: 1500, currency: 'ARS', project_id: 'proj-1', project_title: 'Reforestación' },
});
const mount = (search = '?payment_id=55&status=approved&external_reference=don-1') => render(
  <MemoryRouter initialEntries={[`/donaciones/vuelta${search}`]}><Routes>
    <Route path="/donaciones/vuelta" element={<DonationReturn />} />
    <Route path="/project/:id" element={<p>detalle del proyecto</p>} />
  </Routes></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
  auth.user = { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' };
  auth.initializing = false;
});
afterEach(() => vi.useRealTimers());

describe('<DonationReturn />', () => {
  test('aprobado: "¡Gracias!" con el monto y el proyecto, y link al proyecto; pidió con el payment_id', async () => {
    const get = vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('completed'));
    mount();
    expect(await screen.findByRole('heading', { name: '¡Gracias por tu donación!' })).toBeInTheDocument();
    expect(screen.getByText(/\$1\.500/)).toBeInTheDocument();
    expect(screen.getByText(/Reforestación/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('don-1', '55');
    fireEvent.click(screen.getByRole('link', { name: 'Volver al proyecto' }));
    expect(screen.getByText('detalle del proyecto')).toBeInTheDocument();
  });

  test('el agradecimiento no promete que la ONG ya vio el aviso (eso no lo puede saber)', async () => {
    vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('completed'));
    mount();
    await screen.findByRole('heading', { name: '¡Gracias por tu donación!' });
    expect(screen.queryByText(/recibió el aviso/)).toBeNull();
    expect(screen.getByText(/Gracias por apoyar este proyecto/)).toBeInTheDocument();
  });

  test('la URL dice approved pero el backend dice pending: NO dice "Gracias" (manda el backend) y vuelve a preguntar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = vi.spyOn(api.donaciones, 'get')
      .mockResolvedValueOnce(donation('pending'))
      .mockResolvedValueOnce(donation('completed'));
    mount();
    expect(await screen.findByRole('heading', { name: 'Estamos confirmando tu pago' })).toBeInTheDocument();
    expect(screen.queryByText('¡Gracias por tu donación!')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(await screen.findByRole('heading', { name: '¡Gracias por tu donación!' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('sigue pendiente: deja de preguntar después de unos intentos y ofrece "Actualizar"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('pending'));
    mount();
    await screen.findByRole('heading', { name: 'Estamos confirmando tu pago' });
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    const calls = get.mock.calls.length;
    expect(calls).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(get.mock.calls.length).toBe(calls + 1);
  });

  test('pendiente y Mercado Pago dijo rejected/failure en la URL: "El pago no se completó" con link para reintentar', async () => {
    vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('pending'));
    mount('?payment_id=55&status=rejected&external_reference=don-1');
    expect(await screen.findByRole('heading', { name: 'El pago no se completó' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al proyecto' })).toHaveAttribute('href', '/project/proj-1');
  });

  test('sin pago (status=null, volvió sin pagar): también "no se completó"', async () => {
    vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('pending'));
    mount('?payment_id=null&status=null&external_reference=don-1');
    expect(await screen.findByRole('heading', { name: 'El pago no se completó' })).toBeInTheDocument();
  });

  test('con un rechazo en la URL no vuelve a preguntar (no hay nada que esperar)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const get = vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('pending'));
    mount('?payment_id=55&status=rejected&external_reference=don-1');
    await screen.findByRole('heading', { name: 'El pago no se completó' });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('la URL dice approved pero el backend dice failed: manda el backend ("no se completó")', async () => {
    vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('failed'));
    mount('?payment_id=55&status=approved&external_reference=don-1');
    expect(await screen.findByRole('heading', { name: 'El pago no se completó' })).toBeInTheDocument();
    expect(screen.queryByText('¡Gracias por tu donación!')).toBeNull();
  });

  test('failed en el backend → "no se completó"', async () => {
    vi.spyOn(api.donaciones, 'get').mockResolvedValue(donation('failed'));
    mount('?external_reference=don-1');
    expect(await screen.findByRole('heading', { name: 'El pago no se completó' })).toBeInTheDocument();
  });

  test('sin external_reference o con una donación que no es suya (404): "No encontramos esta donación"', async () => {
    const get = vi.spyOn(api.donaciones, 'get').mockRejectedValue(new ApiError('Donación no encontrada', 404));
    mount('?payment_id=55');
    expect(await screen.findByRole('heading', { name: 'No encontramos esta donación' })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    mount('?external_reference=ajena');
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'No encontramos esta donación' })).toHaveLength(2));
  });

  test('error de red: aviso con "Reintentar"', async () => {
    vi.spyOn(api.donaciones, 'get').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(donation('completed'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByRole('heading', { name: '¡Gracias por tu donación!' })).toBeInTheDocument();
  });

  test('sin sesión: pide iniciar sesión y no consulta', async () => {
    auth.user = null;
    const get = vi.spyOn(api.donaciones, 'get');
    mount();
    expect(await screen.findByRole('heading', { name: 'Iniciá sesión para ver tu donación' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.openAuthModal).toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  test('mientras se verifica la sesión no consulta ni dice nada definitivo', () => {
    auth.initializing = true;
    const get = vi.spyOn(api.donaciones, 'get');
    mount();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /Gracias|no se completó|Iniciá sesión/ })).toBeNull();
  });
});
