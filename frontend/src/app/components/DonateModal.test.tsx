// src/app/components/DonateModal.test.tsx
//
// Modal "Donar" (PLAN_FALTANTE.md, Etapa 9, §172): monto en pesos enteros (atajos y campo libre), validación igual
// que el backend, y al confirmar redirige al checkout de Mercado Pago (`checkout_url`). La redirección se inyecta
// (`go`) para poder probarla: jsdom no navega.
// Rediseño (§240, DESIGN.md → Donación): arranca en $ 2.500, el campo libre aparece con "Otro monto", el botón dice
// el monto ("Donar $ 2.500") y se cierra con la X de la hoja (ya no hay "Cancelar").
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ApiError } from '../../lib/api';
import { DonateModal } from './DonateModal';

const mount = (over: Partial<Parameters<typeof DonateModal>[0]> = {}) => {
  const props = { projectId: 'proj-1', projectTitle: 'Reforestación', onClose: vi.fn(), go: vi.fn(), ...over };
  render(<DonateModal {...props} />);
  return props;
};
/** Los montos van con espacio duro (formatMoney): el nombre accesible lo conserva. */
const pesos = (n: string) => '$ ' + n;
const amount = () => screen.getByLabelText('Monto en pesos') as HTMLInputElement;
/** Abre "Otro monto" y escribe. */
const escribir = (v: string) => {
  if (!screen.queryByLabelText('Monto en pesos')) fireEvent.click(screen.getByRole('button', { name: 'Otro monto' }));
  fireEvent.change(amount(), { target: { value: v } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^Donar/ }));

beforeEach(() => vi.restoreAllMocks());

describe('<DonateModal />', () => {
  test('es un diálogo con nombre, dice a qué proyecto y que el pago es en Mercado Pago (modo prueba)', () => {
    mount();
    expect(screen.getByRole('dialog', { name: 'Donar a Reforestación' })).toBeInTheDocument();
    expect(screen.getByText(/Pagás en Mercado Pago/)).toBeInTheDocument();
    expect(screen.getByText(/modo prueba/i)).toBeInTheDocument();
    expect(screen.getByText(/va directo a la cuenta de Mercado Pago de la ONG/)).toBeInTheDocument();
  });

  test('arranca en $ 2.500 y los atajos cambian el monto (y el botón lo dice)', () => {
    mount();
    expect(screen.getByRole('button', { name: pesos('2.500') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Donar ' + pesos('2.500') })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: pesos('5.000') }));
    expect(screen.getByRole('button', { name: pesos('5.000') })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: pesos('2.500') })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Donar ' + pesos('5.000') })).toBeInTheDocument();
  });

  test('un atajo dona ese monto sin escribir nada', async () => {
    const create = vi.spyOn(api.donaciones, 'create').mockResolvedValue({ donation_id: 'd1', checkout_url: 'https://x' });
    const { go } = mount();
    fireEvent.click(screen.getByRole('button', { name: pesos('1.000') }));
    submit();
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://x'));
    expect(create).toHaveBeenCalledWith({ project_id: 'proj-1', amount: 1000 });
  });

  test('"Otro monto": el campo numérico aparece vacío, ningún atajo queda marcado; elegir un atajo lo esconde', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Otro monto' }));
    expect(amount()).toHaveAttribute('inputmode', 'numeric');
    expect(amount().value).toBe('');
    expect(screen.getByRole('button', { name: 'Otro monto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: pesos('2.500') })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Donar' })).toBeInTheDocument();   // sin monto, sin número
    fireEvent.click(screen.getByRole('button', { name: pesos('10.000') }));
    expect(screen.queryByLabelText('Monto en pesos')).not.toBeInTheDocument();
  });

  test('confirmar: crea la donación con el monto entero y redirige al checkout', async () => {
    const create = vi.spyOn(api.donaciones, 'create').mockResolvedValue({ donation_id: 'd1', checkout_url: 'https://sandbox.mp/checkout?pref=1' });
    const { go } = mount();
    escribir('1500');
    expect(screen.getByRole('button', { name: 'Donar ' + pesos('1.500') })).toBeInTheDocument();
    submit();
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://sandbox.mp/checkout?pref=1'));
    expect(create).toHaveBeenCalledWith({ project_id: 'proj-1', amount: 1500 });
  });

  test('Enter en el campo también confirma', async () => {
    const create = vi.spyOn(api.donaciones, 'create').mockResolvedValue({ donation_id: 'd1', checkout_url: 'https://x' });
    mount();
    escribir('3000');
    fireEvent.submit(amount().closest('form')!);
    await waitFor(() => expect(create).toHaveBeenCalledWith({ project_id: 'proj-1', amount: 3000 }));
  });

  test('monto inválido: aviso y no se llama a la API', () => {
    const create = vi.spyOn(api.donaciones, 'create');
    mount();
    escribir('50');
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('El monto mínimo es de $100');
    escribir('100.5');
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('El monto tiene que ser un número entero de pesos');
    expect(create).not.toHaveBeenCalled();
  });

  test('mientras se prepara el pago: botón deshabilitado con "Preparando el pago…"', async () => {
    let resolve!: (v: { donation_id: string; checkout_url: string }) => void;
    vi.spyOn(api.donaciones, 'create').mockReturnValue(new Promise((r) => { resolve = r; }));
    mount();
    escribir('1500');
    submit();
    expect(await screen.findByRole('button', { name: 'Preparando el pago…' })).toBeDisabled();
    resolve({ donation_id: 'd1', checkout_url: 'https://x' });
  });

  test('error del servidor: muestra su mensaje, no redirige y se puede reintentar', async () => {
    vi.spyOn(api.donaciones, 'create')
      .mockRejectedValueOnce(new ApiError('No pudimos iniciar el pago. Probá de nuevo en un momento.', 502))
      .mockResolvedValueOnce({ donation_id: 'd2', checkout_url: 'https://x2' });
    const { go } = mount();
    escribir('1500');
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
    escribir('1500');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i);
  });

  test('la X cierra', () => {
    const { onClose } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
