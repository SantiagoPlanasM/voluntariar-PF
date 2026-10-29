// src/app/components/SponsorshipAgreementScreen.test.tsx — la pantalla del acuerdo de patrocinio (§265, PLAN_PATROCINIO.md etapa 3).
//
// Criterio (la misma pantalla para la empresa y la ONG; el backend decide qué se puede):
// - dos columnas: lo que aporta la empresa y lo que pide u ofrece la ONG, con el tipo, el detalle y el monto (solo en
//   dinero, en pesos); solo en la columna propia hay "Agregar punto", editar y borrar (con confirmación);
// - el formulario de un punto pide el monto solo si el tipo es dinero y manda solo eso;
// - la barra de aceptación dice quién aceptó la versión vigente; "Estoy de acuerdo" manda esa versión; si el backend
//   dice que el acuerdo cambió (409), se ve el mensaje y se recarga; "Rechazar acuerdo" pide confirmación;
// - la charla muestra el mensaje inicial y los mensajes con su autor; "Enviar" manda el texto y limpia el campo;
// - cerrado (aceptado o rechazado): sin formularios ni botones, la charla de solo lectura;
// - si no se puede cargar (404), el error con la salida.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, SponsorshipAgreement } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';
import { SponsorshipAgreementScreen } from './SponsorshipAgreementScreen';

const base = (over: Partial<SponsorshipAgreement> = {}): SponsorshipAgreement => ({
  company_id: 'e1', project_id: 'p1', company_name: 'Acme SA', ngo_name: 'ONG Verde', project_title: 'Limpieza del lago',
  status: 'propuesto', version: 3, message: 'Queremos ayudar', my_side: 'company',
  accepted: { company: false, ngo: true },
  points: [
    { id: 'pt1', side: 'company', type: 'money', detail: 'Aporte para materiales', amount: 200000, created_at: '', updated_at: '' },
    { id: 'pt2', side: 'ngo', type: 'outreach', detail: 'Logo en las remeras', amount: null, created_at: '', updated_at: '' },
  ],
  messages: [{ id: 'm1', side: 'ngo', author_name: 'ONG Verde', body: '¿Pueden ser 15 empleados?', created_at: '2026-10-29T10:00:00.000Z' }],
  ...over,
});

const mount = (a: SponsorshipAgreement | Error = base()) => {
  const get = vi.spyOn(api.sponsorships, 'get');
  if (a instanceof Error) get.mockRejectedValue(a); else get.mockResolvedValue({ agreement: a });
  render(
    <UiProvider><MemoryRouter initialEntries={['/company/patrocinios/e1/p1']}><Routes>
      <Route path="/company/patrocinios/:empresaId/:projectId" element={<SponsorshipAgreementScreen />} />
    </Routes></MemoryRouter></UiProvider>);
  return get;
};
const empresa = () => screen.getByRole('region', { name: 'Lo que aporta Acme SA' });
const ong = () => screen.getByRole('region', { name: 'Lo que pide u ofrece ONG Verde' });
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => { vi.restoreAllMocks(); });

describe('Acuerdo de patrocinio: los puntos', () => {
  test('dos columnas con tipo, detalle y monto; editar y borrar solo en la propia', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Acuerdo de patrocinio' })).toBeInTheDocument();
    expect(screen.getByText('Limpieza del lago')).toBeInTheDocument();
    expect(within(empresa()).getByText('Dinero')).toBeInTheDocument();
    expect(within(empresa()).getByText('Aporte para materiales')).toBeInTheDocument();
    expect(within(empresa()).getByText(/200\.000/)).toBeInTheDocument();
    expect(within(ong()).getByText('Difusión')).toBeInTheDocument();
    expect(within(empresa()).getByRole('button', { name: 'Editar punto: Aporte para materiales' })).toBeInTheDocument();
    expect(within(empresa()).getByRole('button', { name: 'Agregar punto' })).toBeInTheDocument();
    expect(within(ong()).queryByRole('button', { name: /Editar punto|Borrar punto|Agregar punto/ })).not.toBeInTheDocument();
  });

  test('agregar: el monto aparece solo con dinero y se manda como número', async () => {
    const add = vi.spyOn(api.sponsorships, 'addPoint').mockResolvedValue({ agreement: base({ version: 4 }) });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar punto' }));
    fill('Tipo de punto', 'supplies');
    expect(screen.queryByLabelText('Monto en pesos')).not.toBeInTheDocument();
    fill('Tipo de punto', 'money');
    fill('Detalle del punto', '  Para bolsas  ');
    fill('Monto en pesos', '50000');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto' }));
    await waitFor(() => expect(add).toHaveBeenCalledWith('e1', 'p1', { type: 'money', detail: 'Para bolsas', amount: 50000 }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar punto' })).not.toBeInTheDocument());
  });

  test('agregar un punto que no es dinero no manda monto; un error del backend se muestra', async () => {
    const add = vi.spyOn(api.sponsorships, 'addPoint').mockRejectedValue(new ApiError('Hasta 20 puntos por lado', 409));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar punto' }));
    fill('Tipo de punto', 'volunteers');
    fill('Detalle del punto', '10 empleados');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto' }));
    await waitFor(() => expect(add).toHaveBeenCalledWith('e1', 'p1', { type: 'volunteers', detail: '10 empleados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hasta 20 puntos por lado');
  });

  test('editar abre el formulario precargado; borrar pide confirmación', async () => {
    const upd = vi.spyOn(api.sponsorships, 'updatePoint').mockResolvedValue({ agreement: base() });
    const del = vi.spyOn(api.sponsorships, 'deletePoint').mockResolvedValue({ agreement: base({ points: [] }) });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar punto: Aporte para materiales' }));
    expect(screen.getByLabelText('Detalle del punto')).toHaveValue('Aporte para materiales');
    expect(screen.getByLabelText('Monto en pesos')).toHaveValue(200000);
    fill('Monto en pesos', '250000');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto' }));
    await waitFor(() => expect(upd).toHaveBeenCalledWith('e1', 'p1', 'pt1', { type: 'money', detail: 'Aporte para materiales', amount: 250000 }));

    fireEvent.click(await screen.findByRole('button', { name: 'Borrar punto: Aporte para materiales' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Borrar punto' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('e1', 'p1', 'pt1'));
  });
});

describe('Acuerdo de patrocinio: aceptar y rechazar', () => {
  test('la barra dice quién aceptó; "Estoy de acuerdo" manda la versión vigente', async () => {
    const acc = vi.spyOn(api.sponsorships, 'accept').mockResolvedValue({ agreement: base({ status: 'aceptado', accepted: { company: true, ngo: true } }) });
    mount();
    const barra = await screen.findByRole('region', { name: 'Aceptación' });
    expect(within(barra).getByText('Acme SA: pendiente')).toBeInTheDocument();
    expect(within(barra).getByText('ONG Verde: de acuerdo con esta versión')).toBeInTheDocument();
    fireEvent.click(within(barra).getByRole('button', { name: 'Estoy de acuerdo' }));
    await waitFor(() => expect(acc).toHaveBeenCalledWith('e1', 'p1', 3));
    expect(await screen.findByText('Acuerdo cerrado: Aceptado')).toBeInTheDocument();
  });

  test('si el acuerdo cambió (409), se ve el mensaje y se recarga', async () => {
    vi.spyOn(api.sponsorships, 'accept').mockRejectedValue(new ApiError('El acuerdo cambió: revisalo de nuevo', 409));
    const get = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Estoy de acuerdo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El acuerdo cambió: revisalo de nuevo');
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  test('ya acepté: no ofrece aceptar de nuevo; rechazar pide confirmación', async () => {
    const rej = vi.spyOn(api.sponsorships, 'reject').mockResolvedValue({ agreement: base({ status: 'rechazado' }) });
    mount(base({ accepted: { company: true, ngo: false } }));
    expect(await screen.findByText('Ya aceptaste esta versión')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Estoy de acuerdo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar acuerdo' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rechazar acuerdo' }));
    await waitFor(() => expect(rej).toHaveBeenCalledWith('e1', 'p1'));
    expect(await screen.findByText('Acuerdo cerrado: Rechazado')).toBeInTheDocument();
  });
});

describe('Acuerdo de patrocinio: "Volver" en la confirmación no hace nada', () => {
  test('ni borra el punto ni rechaza el acuerdo', async () => {
    const del = vi.spyOn(api.sponsorships, 'deletePoint');
    const rej = vi.spyOn(api.sponsorships, 'reject');
    mount();
    for (const name of ['Borrar punto: Aporte para materiales', 'Rechazar acuerdo']) {
      fireEvent.click(await screen.findByRole('button', { name }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
    expect(del).not.toHaveBeenCalled();
    expect(rej).not.toHaveBeenCalled();
    expect(within(empresa()).getByText('Aporte para materiales')).toBeInTheDocument();
  });
});

describe('Acuerdo de patrocinio: la charla', () => {
  test('muestra el mensaje inicial y los mensajes; enviar manda el texto y limpia el campo', async () => {
    const send = vi.spyOn(api.sponsorships, 'sendMessage').mockResolvedValue({ agreement: base({
      messages: [...base().messages, { id: 'm2', side: 'company', author_name: 'Acme SA', body: 'Dale', created_at: '2026-10-29T10:05:00.000Z' }] }) });
    mount();
    const charla = await screen.findByRole('region', { name: 'Charla' });
    expect(within(charla).getByText('Queremos ayudar')).toBeInTheDocument();
    expect(within(charla).getByText('¿Pueden ser 15 empleados?')).toBeInTheDocument();
    fill('Escribir un mensaje', 'Dale');
    fireEvent.click(within(charla).getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith('e1', 'p1', 'Dale'));
    expect(await within(charla).findByText('Dale')).toBeInTheDocument();
    expect(screen.getByLabelText('Escribir un mensaje')).toHaveValue('');
  });

  test('un mensaje vacío no se manda', async () => {
    const send = vi.spyOn(api.sponsorships, 'sendMessage');
    mount();
    await screen.findByLabelText('Escribir un mensaje');
    fill('Escribir un mensaje', '   ');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('Acuerdo de patrocinio: cerrado y errores', () => {
  test('cerrado: sin formularios ni botones, la charla de solo lectura', async () => {
    mount(base({ status: 'aceptado', accepted: { company: true, ngo: true } }));
    expect(await screen.findByText('Acuerdo cerrado: Aceptado')).toBeInTheDocument();
    for (const name of [/Agregar punto/, /Editar punto/, /Borrar punto/, /Estoy de acuerdo/, /Rechazar acuerdo/, /Enviar/])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Escribir un mensaje')).not.toBeInTheDocument();
    expect(screen.getByText('¿Pueden ser 15 empleados?')).toBeInTheDocument();
  });

  test('404: el error con la salida', async () => {
    mount(new ApiError('Acuerdo no encontrado', 404));
    expect(await screen.findByText('No encontramos este acuerdo')).toBeInTheDocument();
  });
});
