// src/app/components/MercadoPagoAccount.test.tsx
//
// Marketplace (PROJECT_ANALYSIS.md §218): la ONG vincula su cuenta de Mercado Pago para recibir donaciones.
//   - <MercadoPagoAccountSection />: en el perfil de la ONG (/ngo/profile#mercadopago). Estado de la cuenta, Vincular,
//     Volver a vincular y Desvincular (con confirmación en la página, sin window.confirm).
//   - <MercadoPagoBanner />: el cartel del panel. Aparece si la ONG no vinculó la cuenta o hay que volver a vincularla
//     (decisión del usuario: sin cuenta no recibe donaciones, y la ONG tiene que verlo).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, ApiError, MpAccountState } from '../../lib/api';
import { MercadoPagoAccountSection, MercadoPagoBanner } from './MercadoPagoAccount';

const state = (account: MpAccountState['account'], oauth_available = true): MpAccountState => ({ account, oauth_available });
const active = { mp_user_id: '3772556008', status: 'active' as const, origin: 'oauth' as const, expires_at: '2027-04-16T00:00:00.000Z' };

beforeEach(() => { vi.restoreAllMocks(); });

describe('<MercadoPagoAccountSection />', () => {
  const mount = (go = vi.fn()) => { render(<MemoryRouter><MercadoPagoAccountSection go={go} /></MemoryRouter>); return go; };

  test('sin cuenta: explica que sin ella no recibe donaciones y "Vincular" lleva a Mercado Pago', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(null));
    const connect = vi.spyOn(api.ngos.mercadopago, 'connect').mockResolvedValue({ authorization_url: 'https://auth.mercadopago.com/authorization?x=1' });
    const go = mount();
    expect(await screen.findByText(/tus proyectos no reciben donaciones/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular Mercado Pago' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://auth.mercadopago.com/authorization?x=1'));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  test('la sección tiene el ancla #mercadopago (el cartel del panel apunta ahí)', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(null));
    const { container } = render(<MemoryRouter><MercadoPagoAccountSection /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Vincular Mercado Pago' });
    expect(container.querySelector('section#mercadopago')).not.toBeNull();
  });

  test('con #mercadopago en la URL (el link del cartel): hace scroll hasta la sección cuando carga', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(null));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<MemoryRouter initialEntries={['/ngo/profile#mercadopago']}><MercadoPagoAccountSection /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Vincular Mercado Pago' });
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockClear();
    render(<MemoryRouter initialEntries={['/ngo/profile']}><MercadoPagoAccountSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Vincular Mercado Pago' })).toHaveLength(2));
    expect(scroll).not.toHaveBeenCalled();
  });

  test('el scroll espera a que cargue, y no se repite cuando la sección se recarga (después de desvincular)', async () => {
    let resolve!: (v: MpAccountState) => void;
    vi.spyOn(api.ngos.mercadopago, 'get')
      .mockReturnValueOnce(new Promise((r) => { resolve = r; }))
      .mockResolvedValueOnce(state(null));
    vi.spyOn(api.ngos.mercadopago, 'disconnect').mockResolvedValue({ disconnected: true });
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<MemoryRouter initialEntries={['/ngo/profile#mercadopago']}><MercadoPagoAccountSection /></MemoryRouter>);
    await Promise.resolve();
    expect(scroll).not.toHaveBeenCalled();
    resolve(state(active));
    fireEvent.click(await screen.findByRole('button', { name: 'Desvincular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }));
    await screen.findByRole('button', { name: 'Vincular Mercado Pago' });
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  test('si falla iniciar la vinculación: muestra el error del backend y no navega', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(null));
    vi.spyOn(api.ngos.mercadopago, 'connect').mockRejectedValue(new ApiError('La vinculación con Mercado Pago no está disponible por el momento', 503));
    const go = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Vincular Mercado Pago' }));
    expect(await screen.findByText('La vinculación con Mercado Pago no está disponible por el momento')).toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
  });

  test('sin OAuth disponible: lo dice y no ofrece el botón', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(null, false));
    mount();
    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vincular Mercado Pago' })).toBeNull();
  });

  test('vinculada: muestra la cuenta y que recibe donaciones; Desvincular pide confirmación y después desvincula', async () => {
    const get = vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValueOnce(state(active)).mockResolvedValueOnce(state(null));
    const disconnect = vi.spyOn(api.ngos.mercadopago, 'disconnect').mockResolvedValue({ disconnected: true });
    mount();
    expect(await screen.findByText(/3772556008/)).toBeInTheDocument();
    expect(screen.getByText(/recibís las donaciones/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vincular Mercado Pago' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    expect(disconnect).not.toHaveBeenCalled();
    expect(screen.getByText(/dejás de recibir donaciones/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(/dejás de recibir donaciones/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }));
    expect(await screen.findByRole('button', { name: 'Vincular Mercado Pago' })).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('si falla desvincular: muestra el error y la cuenta sigue', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(active));
    vi.spyOn(api.ngos.mercadopago, 'disconnect').mockRejectedValue(new ApiError('No pudimos desvincular la cuenta', 500));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Desvincular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }));
    expect(await screen.findByText('No pudimos desvincular la cuenta')).toBeInTheDocument();
    expect(screen.getByText(/3772556008/)).toBeInTheDocument();
  });

  test('cargada a mano (origin manual): lo aclara', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state({ ...active, origin: 'manual', expires_at: null }));
    mount();
    expect(await screen.findByText(/cargada a mano/i)).toBeInTheDocument();
  });

  test('requiere reconexión: avisa y ofrece "Volver a vincular"', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state({ ...active, status: 'needs_reconnect' }));
    vi.spyOn(api.ngos.mercadopago, 'connect').mockResolvedValue({ authorization_url: 'https://mp/auth' });
    const go = mount();
    expect(await screen.findByText(/dejó de funcionar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a vincular' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://mp/auth'));
  });

  test('requiere reconexión pero el OAuth no está disponible: avisa, sin "Volver a vincular"', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state({ ...active, status: 'needs_reconnect' }, false));
    mount();
    expect(await screen.findByText(/dejó de funcionar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver a vincular' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Desvincular' })).toBeInTheDocument();
  });

  test('si no carga: error con "Reintentar"', async () => {
    const get = vi.spyOn(api.ngos.mercadopago, 'get')
      .mockRejectedValueOnce(new ApiError('Error al obtener la cuenta de Mercado Pago', 500))
      .mockResolvedValueOnce(state(null));
    mount();
    expect(await screen.findByText('Error al obtener la cuenta de Mercado Pago')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('button', { name: 'Vincular Mercado Pago' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('<MercadoPagoBanner /> (panel de la ONG)', () => {
  const mount = () => render(<MemoryRouter><MercadoPagoBanner /></MemoryRouter>);

  test('sin cuenta: "Configurá tu cuenta…" con link al perfil', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(null));
    mount();
    expect(await screen.findByText(/Configurá tu cuenta de Mercado Pago para recibir donaciones/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar' })).toHaveAttribute('href', '/ngo/profile#mercadopago');
  });

  test('requiere reconexión: lo dice', async () => {
    vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state({ ...active, status: 'needs_reconnect' }));
    mount();
    expect(await screen.findByText(/Volvé a vincular tu cuenta de Mercado Pago/)).toBeInTheDocument();
  });

  test('con la cuenta activa, o si no se pudo consultar: no muestra nada', async () => {
    const get = vi.spyOn(api.ngos.mercadopago, 'get').mockResolvedValue(state(active));
    const { container, unmount } = mount();
    await waitFor(() => expect(get).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    unmount();
    get.mockRejectedValue(new ApiError('x', 500));
    const second = mount();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(second.container).toBeEmptyDOMElement();
  });
});
