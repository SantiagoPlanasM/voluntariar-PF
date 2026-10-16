// src/app/components/DonateModal.test.tsx
//
// Modal "Donar" (PLAN_FALTANTE.md, Etapa 9, §172): monto en pesos enteros (atajos y campo libre), validación igual
// que el backend, y al confirmar redirige al checkout de Mercado Pago (`checkout_url`). La redirección se inyecta
// (`go`) para poder probarla: jsdom no navega.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ApiError } from '../../lib/api';
import { DonateModal } from './DonateModal';

const mount = (over: Partial<Parameters<typeof DonateModal>[0]> = {}) => {
  const props = { projectId: 'proj-1', projectTitle: 'Reforestación', onClose: vi.fn(), go: vi.fn(), ...over };
  render(<DonateModal {...props} />);
  return props;
};
const amount = () => screen.getByLabelText('Monto en pesos') as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Ir a pagar' }));

beforeEach(() => vi.restoreAllMocks());

describe('<DonateModal />', () => {
  test('es un diálogo con nombre, dice a qué proyecto y que el pago es en Mercado Pago (modo prueba)', () => {
    mount();
    expect(screen.getByRole('dialog', { name: 'Donar a Reforestación' })).toBeInTheDocument();
    expect(screen.getByText(/Mercado Pago/)).toBeInTheDocument();
    expect(screen.getByText(/modo prueba/i)).toBeInTheDocument();
    expect(amount()).toHaveAttribute('inputmode', 'numeric');
  });

  test('los atajos ponen el monto', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '$5.000' }));
    expect(amount().value).toBe('5000');
    fireEvent.click(screen.getByRole('button', { name: '$1.000' }));
    expect(amount().value).toBe('1000');
  });

  test('confirmar: crea la donación con el monto entero y redirige al checkout', async () => {
    const create = vi.spyOn(api.donaciones, 'create').mockResolvedValue({ donation_id: 'd1', checkout_url: 'https://sandbox.mp/checkout?pref=1' });
    const { go } = mount();
    fireEvent.change(amount(), { target: { value: '1500' } });
    submit();
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://sandbox.mp/checkout?pref=1'));
    expect(create).toHaveBeenCalledWith({ project_id: 'proj-1', amount: 1500 });
  });

  test('monto inválido: aviso y no se llama a la API', () => {
    const create = vi.spyOn(api.donaciones, 'create');
    mount();
    fireEvent.change(amount(), { target: { value: '50' } });
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('El monto mínimo es de $100');
    fireEvent.change(amount(), { target: { value: '100.5' } });
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('El monto tiene que ser un número entero de pesos');
    expect(create).not.toHaveBeenCalled();
  });

  test('mientras se prepara el pago: botón deshabilitado con "Preparando el pago…"', async () => {
    let resolve!: (v: { donation_id: string; checkout_url: string }) => void;
    vi.spyOn(api.donaciones, 'create').mockReturnValue(new Promise((r) => { resolve = r; }));
    mount();
    fireEvent.change(amount(), { target: { value: '1500' } });
    submit();
    expect(await screen.findByRole('button', { name: 'Preparando el pago…' })).toBeDisabled();
    resolve({ donation_id: 'd1', checkout_url: 'https://x' });
  });

  test('error del servidor: muestra su mensaje, no redirige y se puede reintentar', async () => {
    vi.spyOn(api.donaciones, 'create')
      .mockRejectedValueOnce(new ApiError('No pudimos iniciar el pago. Probá de nuevo en un momento.', 502))
      .mockResolvedValueOnce({ donation_id: 'd2', checkout_url: 'https://x2' });
    const { go } = mount();
    fireEvent.change(amount(), { target: { value: '1500' } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos iniciar el pago. Probá de nuevo en un momento.');
    expect(go).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://x2'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('sin red: mensaje de conexión', async () => {
    vi.spyOn(api.donaciones, 'create').mockRejectedValue(new TypeError('Failed to fetch'));
    mount();
    fireEvent.change(amount(), { target: { value: '1500' } });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i);
  });

  test('"Cancelar" cierra', () => {
    const { onClose } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
