// src/app/components/NGOValidation.test.tsx — "Validar la ONG" (/ngo/validacion) y su acceso en el Panel (§317).
// Criterio de aceptación (antes de escribir la pantalla; DESIGN.md → Validación de ONGs):
//  - el estado como chip: "Sin validar", "En revisión", "Validada", "Rechazada";
//  - sin pedido o rechazada: los tres pasos (datos, documentación, revisión) y el formulario. Rechazada muestra el motivo
//    y vuelve a llenar el CUIT y la personería; el botón dice "Volver a enviar";
//  - antes de mandar, los mismos chequeos que el backend (CUIT, personería, los dos PDF): con un error no sale nada;
//  - el envío es multipart con cuit, legal_type, statute y registration (los nombres que lee routes/ngoValidacion.js);
//    después queda "En revisión" con el aviso de los 5 días hábiles;
//  - en revisión o validada: sin formulario, con los datos enviados y los PDF para ver (link que vence);
//  - se aclara que sin validar se puede publicar y que las donaciones dependen de Mercado Pago;
//  - si la carga falla: el error y "Reintentar".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, ApiError, NgoValidation } from '../../lib/api';

vi.mock('../../lib/cv', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cv')>('../../lib/cv');
  return { ...actual, openSignedLink: vi.fn() };
});
import { openSignedLink } from '../../lib/cv';
import { NGOValidationScreen, NGOValidationCard } from './NGOValidation';

const pdf = (name: string) => new File([new Uint8Array(10)], name, { type: 'application/pdf' });
const sent = (status: 'pending' | 'approved' | 'rejected', extra: Partial<NgoValidation> = {}): NgoValidation => ({
  status, cuit: '30-71234567-1', legal_type: 'foundation', reason: null,
  submitted_at: '2026-11-10 12:00:00', reviewed_at: null, ...extra,
} as NgoValidation);
const loads = (v: NgoValidation) => vi.spyOn(api.ngos.validation, 'get').mockResolvedValue({ validation: v });
const mount = () => render(<MemoryRouter><NGOValidationScreen /></MemoryRouter>);

const fill = ({ cuit = '30-71234567-1', legal = 'foundation', statute = true, registration = true } = {}) => {
  fireEvent.change(screen.getByLabelText('CUIT'), { target: { value: cuit } });
  fireEvent.change(screen.getByLabelText('Tipo de personería'), { target: { value: legal } });
  if (statute) fireEvent.change(screen.getByLabelText('Estatuto (PDF)'), { target: { files: [pdf('estatuto.pdf')] } });
  if (registration) fireEvent.change(screen.getByLabelText('Constancia de inscripción (PDF)'), { target: { files: [pdf('constancia.pdf')] } });
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openSignedLink).mockReset().mockResolvedValue(undefined);
});

describe('<NGOValidationScreen />: sin pedido', () => {
  test('"Sin validar", los tres pasos y la aclaración de lo que se puede hacer sin validar', async () => {
    loads({ status: 'none' });
    mount();
    expect(await screen.findByText('Sin validar')).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Pasos' });
    expect(within(steps).getAllByRole('listitem').map((li) => li.querySelector('h2')?.textContent)).toEqual(
      ['Datos de la organización', 'Documentación', 'Revisión del equipo de VoluntariAR']);
    expect(screen.getByText(/Tarda hasta 5 días hábiles/)).toBeInTheDocument();
    expect(screen.getByText(/podés publicar voluntariados y recibir postulaciones/)).toBeInTheDocument();
    expect(screen.getByText(/donaciones dependen de Mercado Pago/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar para revisión' })).toBeInTheDocument();
  });

  test('las cinco personerías para elegir, sin ninguna elegida al empezar', async () => {
    loads({ status: 'none' });
    mount();
    const select = await screen.findByLabelText('Tipo de personería') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect([...select.options].map((o) => o.textContent)).toEqual(
      ['Elegí una', 'Asociación civil', 'Fundación', 'Cooperativa', 'Mutual', 'Otra']);
  });

  test.each([
    [{ cuit: '  ' }, 'Escribí el CUIT de la ONG'],
    [{ legal: '' }, 'Elegí el tipo de personería'],
    [{ statute: false }, 'Falta el estatuto (PDF)'],
    [{ registration: false }, 'Falta la constancia de inscripción (PDF)'],
  ])('con un dato faltante (%o) no manda nada y lo dice', async (missing, message) => {
    loads({ status: 'none' });
    const submit = vi.spyOn(api.ngos.validation, 'submit');
    mount();
    await screen.findByLabelText('CUIT');
    fill(missing);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(submit).not.toHaveBeenCalled();
  });

  test('un archivo que no es PDF: lo dice al enviar, con el mismo mensaje que el backend', async () => {
    loads({ status: 'none' });
    const submit = vi.spyOn(api.ngos.validation, 'submit');
    mount();
    await screen.findByLabelText('CUIT');
    fill({ statute: false });
    fireEvent.change(screen.getByLabelText('Estatuto (PDF)'), { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El estatuto no es un PDF válido');
    expect(submit).not.toHaveBeenCalled();
  });

  test('muestra el nombre del archivo elegido', async () => {
    loads({ status: 'none' });
    mount();
    await screen.findByLabelText('CUIT');
    fill();
    expect(screen.getByText('estatuto.pdf')).toBeInTheDocument();
    expect(screen.getByText('constancia.pdf')).toBeInTheDocument();
  });

  test('envía multipart con cuit, legal_type, statute y registration; después queda "En revisión"', async () => {
    loads({ status: 'none' });
    const submit = vi.spyOn(api.ngos.validation, 'submit').mockResolvedValue({ validation: sent('pending') });
    mount();
    await screen.findByLabelText('CUIT');
    fill({ cuit: ' 30-71234567-1 ' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const form = submit.mock.calls[0][0];
    expect(form.get('cuit')).toBe('30-71234567-1');
    expect(form.get('legal_type')).toBe('foundation');
    expect((form.get('statute') as File).name).toBe('estatuto.pdf');
    expect((form.get('registration') as File).name).toBe('constancia.pdf');
    expect(await screen.findByText('En revisión')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar para revisión' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Recibimos la documentación');
  });

  test('si el backend rechaza el envío: su mensaje, y el formulario sigue ahí', async () => {
    loads({ status: 'none' });
    vi.spyOn(api.ngos.validation, 'submit').mockRejectedValue(new ApiError('El CUIT no es válido: son 11 números con el dígito verificador correcto', 400));
    mount();
    await screen.findByLabelText('CUIT');
    fill({ cuit: '30-71234567-2' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El CUIT no es válido');
    expect(screen.getByRole('button', { name: 'Enviar para revisión' })).toBeEnabled();
  });

  test('mientras envía, el botón dice "Enviando…" y no se puede tocar dos veces', async () => {
    loads({ status: 'none' });
    let resolve!: (v: { validation: NgoValidation }) => void;
    const submit = vi.spyOn(api.ngos.validation, 'submit').mockReturnValue(new Promise((r) => { resolve = r; }));
    mount();
    await screen.findByLabelText('CUIT');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }));
    const busy = await screen.findByRole('button', { name: 'Enviando…' });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(submit).toHaveBeenCalledTimes(1);
    resolve({ validation: sent('pending') });
    expect(await screen.findByText('En revisión')).toBeInTheDocument();
  });
});

describe('<NGOValidationScreen />: con pedido', () => {
  test('en revisión: sin formulario, con el CUIT, la personería y los PDF para ver', async () => {
    loads(sent('pending'));
    vi.spyOn(api.ngos.validation, 'document').mockResolvedValue({ url: 'https://x', expires_at: '' });
    mount();
    expect(await screen.findByText('En revisión')).toBeInTheDocument();
    expect(screen.queryByLabelText('CUIT')).not.toBeInTheDocument();
    expect(screen.getByText('30-71234567-1')).toBeInTheDocument();
    expect(screen.getByText('Fundación')).toBeInTheDocument();
    expect(screen.getByText(/Tarda hasta 5 días hábiles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver estatuto' }));
    await waitFor(() => expect(openSignedLink).toHaveBeenCalledTimes(1));
    await vi.mocked(openSignedLink).mock.calls[0][0]();
    expect(api.ngos.validation.document).toHaveBeenCalledWith('statute');
    fireEvent.click(screen.getByRole('button', { name: 'Ver constancia' }));
    await waitFor(() => expect(openSignedLink).toHaveBeenCalledTimes(2));
    await vi.mocked(openSignedLink).mock.calls[1][0]();
    expect(api.ngos.validation.document).toHaveBeenLastCalledWith('registration');
  });

  test('si no se puede abrir un PDF: el mensaje', async () => {
    loads(sent('pending'));
    vi.mocked(openSignedLink).mockRejectedValue(new ApiError('Documento no encontrado', 404));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver estatuto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Documento no encontrado');
  });

  test('validada: "Validada", la insignia y sin formulario', async () => {
    loads(sent('approved', { reviewed_at: '2026-11-11T10:00:00.000Z' }));
    mount();
    expect(await screen.findByText('Validada')).toBeInTheDocument();
    expect(screen.getByText(/Tu ONG está validada/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'ONG validada' })).toBeInTheDocument();
    expect(screen.queryByLabelText('CUIT')).not.toBeInTheDocument();
  });

  test('rechazada: el motivo y el formulario de nuevo, con el CUIT y la personería de antes', async () => {
    loads(sent('rejected', { reason: 'El estatuto no tiene la firma de la comisión' }));
    const submit = vi.spyOn(api.ngos.validation, 'submit').mockResolvedValue({ validation: sent('pending') });
    mount();
    expect(await screen.findByText('Rechazada')).toBeInTheDocument();
    expect(screen.getByText('El estatuto no tiene la firma de la comisión')).toBeInTheDocument();
    expect(screen.getByLabelText('CUIT')).toHaveValue('30-71234567-1');
    expect(screen.getByLabelText('Tipo de personería')).toHaveValue('foundation');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a enviar' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('En revisión')).toBeInTheDocument();
  });

  test('si la carga falla: el error y "Reintentar" vuelve a pedir', async () => {
    const get = vi.spyOn(api.ngos.validation, 'get')
      .mockRejectedValueOnce(new ApiError('Error al obtener la validación', 500))
      .mockResolvedValueOnce({ validation: { status: 'none' } });
    mount();
    expect(await screen.findByText('Error al obtener la validación')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sin validar')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('<NGOValidationCard />: el acceso del Panel', () => {
  const card = () => render(<MemoryRouter><NGOValidationCard /></MemoryRouter>);

  test.each([
    [{ status: 'none' } as NgoValidation, 'Pedí la insignia azul de ONG validada'],
    [sent('pending'), 'En revisión'],
    [sent('approved'), 'Validada'],
    [sent('rejected', { reason: 'x'.repeat(12) }), 'Rechazada: revisá el motivo y volvé a enviarla'],
  ])('lleva a /ngo/validacion y resume el estado (%#)', async (v, detail) => {
    loads(v);
    card();
    const link = screen.getByRole('link', { name: /Validación/ });
    expect(link).toHaveAttribute('href', '/ngo/validacion');
    expect(await within(link).findByText(detail)).toBeInTheDocument();
  });

  test('si la carga falla, el acceso queda igual, sin estado', async () => {
    const get = vi.spyOn(api.ngos.validation, 'get').mockRejectedValue(new Error('red'));
    card();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /Validación/ })).toHaveTextContent(/^Validación$/);
  });
});
