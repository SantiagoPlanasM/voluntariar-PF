// src/app/components/SponsorshipAgreementScreen.test.tsx — la pantalla del acuerdo de patrocinio (§265, rediseño §325).
//
// Criterio (la misma pantalla para la empresa y la ONG; el backend decide qué se puede):
// - una sola lista de puntos (§325, antes dos columnas): cada uno dice de qué parte es, el tipo, el detalle, el monto
//   (solo en dinero, en pesos), quién lo agregó y, si lo editaron, quién y cuándo; filtros por parte con la cantidad
//   y el total de dinero comprometido; solo los puntos propios tienen editar y borrar (con confirmación), y hay
//   "Agregar punto" para la parte propia;
// - el formulario de un punto pide el monto solo si el tipo es dinero y manda solo eso;
// - "cambió desde que aceptaste" (§325): si acepté una versión anterior a la vigente, el historial marca los puntos
//   agregados o editados desde entonces (con lo de antes) y avisa los que se quitaron; si nunca acepté, si acepté la
//   vigente o si está cerrado, no se pide el historial; si el historial falla, la pantalla sigue sin marcas;
// - la barra de aceptación dice quién aceptó la versión vigente (y qué versión había aceptado quien no);
//   "Estoy de acuerdo" manda esa versión; si el backend dice que el acuerdo cambió (409), se ve el mensaje y se
//   recarga; "Rechazar acuerdo" pide confirmación;
// - la charla muestra el mensaje inicial y los mensajes con su autor; "Enviar" manda el texto y limpia el campo;
// - cerrado (aceptado o rechazado): sin formularios ni botones, la charla de solo lectura;
// - si no se puede cargar (404), el error con la salida.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, SponsorshipAgreement, SponsorshipVersion } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';
import { SponsorshipAgreementScreen } from './SponsorshipAgreementScreen';

const base = (over: Partial<SponsorshipAgreement> = {}): SponsorshipAgreement => ({
  company_id: 'e1', project_id: 'p1', company_name: 'Acme SA', ngo_name: 'ONG Verde', project_title: 'Limpieza del lago',
  status: 'propuesto', version: 3, message: 'Queremos ayudar', my_side: 'company',
  accepted: { company: false, ngo: true },
  accepted_versions: { company: 2, ngo: 3 }, accepted_at: { company: null, ngo: '2026-10-29T11:00:00.000Z' },   // §324
  points: [
    { id: 'pt1', side: 'company', type: 'money', detail: 'Aporte para materiales', amount: 200000, created_at: '', updated_at: '',
      created_by_name: 'Laura', edited_by_name: null, edited_at: null },
    { id: 'pt2', side: 'ngo', type: 'outreach', detail: 'Logo en las remeras', amount: null, created_at: '', updated_at: '',
      created_by_name: 'Ana', edited_by_name: 'Ana', edited_at: '2026-10-29T10:30:00.000Z' },
  ],
  messages: [{ id: 'm1', side: 'ngo', author_name: 'ONG Verde', body: '¿Pueden ser 15 empleados?', created_at: '2026-10-29T10:00:00.000Z' }],
  ...over,
});

const v3: SponsorshipVersion = {
  version: 3, side: 'ngo', author_name: 'Ana', created_at: '2026-10-29T10:30:00.000Z', accepted_by: [],
  changes: [
    { action: 'edit', point_id: 'pt2', side: 'ngo', before: { type: 'outreach', detail: 'Logo', amount: null },
      after: { type: 'outreach', detail: 'Logo en las remeras', amount: null } },
    { action: 'remove', point_id: 'pt9', side: 'ngo', before: { type: 'supplies', detail: 'Bolsas de residuos', amount: null }, after: null },
  ],
};
const v2: SponsorshipVersion = {
  version: 2, side: 'company', author_name: 'Laura', created_at: '2026-10-28T10:00:00.000Z',
  accepted_by: [{ side: 'company', author_name: 'Laura', accepted_at: '2026-10-28T10:01:00.000Z' }],
  changes: [{ action: 'add', point_id: 'pt1', side: 'company', before: null, after: { type: 'money', detail: 'Aporte para materiales', amount: 200000 } }],
};

const mount = (a: SponsorshipAgreement | Error = base(), versions: SponsorshipVersion[] | Error = []) => {
  const get = vi.spyOn(api.sponsorships, 'get');
  if (a instanceof Error) get.mockRejectedValue(a); else get.mockResolvedValue({ agreement: a });
  const history = vi.spyOn(api.sponsorships, 'history');
  if (versions instanceof Error) history.mockRejectedValue(versions); else history.mockResolvedValue({ versions });
  render(
    <UiProvider><MemoryRouter initialEntries={['/company/patrocinios/e1/p1']}><Routes>
      <Route path="/company/patrocinios/:empresaId/:projectId" element={<SponsorshipAgreementScreen />} />
    </Routes></MemoryRouter></UiProvider>);
  return { get, history };
};
const lista = () => screen.getByRole('region', { name: 'Puntos del acuerdo' });
const punto = (detail: string) => within(lista()).getByText(detail).closest('li')!;
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => { vi.restoreAllMocks(); });

describe('Acuerdo de patrocinio: la lista de puntos', () => {
  test('una sola lista: de qué parte es cada punto, tipo, detalle, monto y quién lo agregó o editó', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Acuerdo de patrocinio' })).toBeInTheDocument();
    expect(screen.getByText('Limpieza del lago')).toBeInTheDocument();
    const dinero = punto('Aporte para materiales');
    expect(within(dinero).getByText('Aporta Acme SA')).toBeInTheDocument();
    expect(within(dinero).getByText('Dinero')).toBeInTheDocument();
    expect(within(dinero).getByText(/200\.000/)).toBeInTheDocument();
    expect(within(dinero).getByText('Agregado por Laura')).toBeInTheDocument();
    const logo = punto('Logo en las remeras');
    expect(within(logo).getByText('Ofrece ONG Verde')).toBeInTheDocument();
    expect(within(logo).getByText('Difusión')).toBeInTheDocument();
    expect(within(logo).getByText(/^Agregado por Ana · editado por Ana · /)).toBeInTheDocument();
  });

  test('editar y borrar solo en los puntos propios; "Agregar punto" para la parte propia', async () => {
    mount();
    const dinero = await screen.findByText('Aporte para materiales');
    expect(within(dinero.closest('li')!).getByRole('button', { name: 'Editar punto: Aporte para materiales' })).toBeInTheDocument();
    expect(within(punto('Logo en las remeras')).queryByRole('button', { name: /Editar punto|Borrar punto/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar punto' })).toBeInTheDocument();
  });

  test('filtros por parte con la cantidad; el total de dinero comprometido', async () => {
    mount();
    const todos = await screen.findByRole('button', { name: 'Todos · 2' });
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    expect(within(lista()).getByText(/Dinero comprometido/)).toHaveTextContent('200.000');
    fireEvent.click(screen.getByRole('button', { name: 'Ofrece ONG Verde · 1' }));
    expect(screen.getByRole('button', { name: 'Ofrece ONG Verde · 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(todos).toHaveAttribute('aria-pressed', 'false');
    expect(within(lista()).queryByText('Aporte para materiales')).not.toBeInTheDocument();
    expect(within(lista()).getByText('Logo en las remeras')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aporta Acme SA · 1' }));
    expect(within(lista()).queryByText('Logo en las remeras')).not.toBeInTheDocument();
  });

  test('sin dinero no muestra el total; sin puntos lo dice', async () => {
    mount(base({ points: [] }));
    expect(await within(await screen.findByRole('region', { name: 'Puntos del acuerdo' })).findByText('Todavía no hay puntos.')).toBeInTheDocument();
    expect(screen.queryByText(/Dinero comprometido/)).not.toBeInTheDocument();
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

describe('Acuerdo de patrocinio: lo que cambió desde que aceptaste', () => {
  test('acepté la versión 2 y está la 3: marca lo editado (con lo de antes) y avisa lo que se quitó', async () => {
    const { history } = mount(base(), [v3, v2]);
    const aviso = await screen.findByRole('region', { name: 'Cambios desde tu aceptación' });
    expect(history).toHaveBeenCalledWith('e1', 'p1');
    expect(aviso).toHaveTextContent('Cambiaron 2 puntos desde que aceptaste la versión 2.');
    expect(within(aviso).getByText(/Se quitó/)).toHaveTextContent('Bolsas de residuos');
    const logo = punto('Logo en las remeras');
    expect(within(logo).getByText('Cambió desde que aceptaste')).toBeInTheDocument();
    expect(within(logo).getByText('Logo')).toBeInTheDocument();          // lo de antes, tachado
    expect(within(punto('Aporte para materiales')).queryByText(/desde que aceptaste/)).not.toBeInTheDocument();  // v2: ya lo había aceptado
  });

  test('un punto agregado después de mi aceptación se marca como nuevo', async () => {
    const v4: SponsorshipVersion = { ...v3, version: 4, changes: [
      { action: 'add', point_id: 'pt2', side: 'ngo', before: null, after: { type: 'outreach', detail: 'Logo en las remeras', amount: null } }] };
    mount(base({ version: 4, accepted_versions: { company: 3, ngo: null } }), [v4, v3]);
    expect(await screen.findByText('Nuevo desde que aceptaste')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cambios desde tu aceptación' })).toHaveTextContent('Cambió 1 punto desde que aceptaste la versión 3.');
  });

  test('no pide el historial si nunca acepté, si acepté la vigente o si está cerrado', async () => {
    for (const a of [
      base({ accepted_versions: { company: null, ngo: 3 } }),
      base({ accepted: { company: true, ngo: true }, accepted_versions: { company: 3, ngo: 3 } }),
      base({ status: 'rechazado' }),
    ]) {
      const { history, get } = mount(a, [v3, v2]);
      await waitFor(() => expect(get).toHaveBeenCalled());
      await screen.findByRole('region', { name: 'Puntos del acuerdo' });
      expect(history).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: 'Cambios desde tu aceptación' })).not.toBeInTheDocument();
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    }
  });

  test('si después de un cambio el historial falla, se van las marcas viejas (no quedan de otra versión)', async () => {
    const { history } = mount(base(), [v3, v2]);
    expect(await screen.findByText('Cambió desde que aceptaste')).toBeInTheDocument();
    history.mockRejectedValue(new ApiError('Error', 500));
    vi.spyOn(api.sponsorships, 'addPoint').mockResolvedValue({ agreement: base({ version: 4 }) });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar punto' }));
    fill('Detalle del punto', 'Guantes');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto' }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/desde que aceptaste/)).not.toBeInTheDocument());
  });

  test('si el historial falla, la pantalla sigue sin marcas', async () => {
    const { history } = mount(base(), new ApiError('Error', 500));
    await waitFor(() => expect(history).toHaveBeenCalled());
    expect(await screen.findByText('Logo en las remeras')).toBeInTheDocument();
    expect(screen.queryByText(/desde que aceptaste/)).not.toBeInTheDocument();
  });
});

describe('Acuerdo de patrocinio: aceptar y rechazar', () => {
  test('la barra dice quién aceptó; "Estoy de acuerdo" manda la versión vigente', async () => {
    const acc = vi.spyOn(api.sponsorships, 'accept').mockResolvedValue({ agreement: base({ status: 'aceptado', accepted: { company: true, ngo: true } }) });
    mount();
    const barra = await screen.findByRole('region', { name: 'Aceptación' });
    expect(within(barra).getByText('Acme SA: pendiente')).toBeInTheDocument();
    expect(within(barra).getByText('Habías aceptado la versión 2')).toBeInTheDocument();   // §325
    expect(within(barra).getByText('ONG Verde: de acuerdo con esta versión')).toBeInTheDocument();
    fireEvent.click(within(barra).getByRole('button', { name: 'Estoy de acuerdo' }));
    await waitFor(() => expect(acc).toHaveBeenCalledWith('e1', 'p1', 3));
    expect(await screen.findByText('Acuerdo cerrado: Aceptado')).toBeInTheDocument();
  });

  test('si el acuerdo cambió (409), se ve el mensaje y se recarga', async () => {
    vi.spyOn(api.sponsorships, 'accept').mockRejectedValue(new ApiError('El acuerdo cambió: revisalo de nuevo', 409));
    const { get } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Estoy de acuerdo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El acuerdo cambió: revisalo de nuevo');
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  test('ya acepté: no ofrece aceptar de nuevo; rechazar pide confirmación', async () => {
    const rej = vi.spyOn(api.sponsorships, 'reject').mockResolvedValue({ agreement: base({ status: 'rechazado' }) });
    mount(base({ accepted: { company: true, ngo: false }, accepted_versions: { company: 3, ngo: null } }));
    expect(await screen.findByText('Ya aceptaste esta versión')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Estoy de acuerdo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Había aceptado/)).not.toBeInTheDocument();   // la ONG nunca aceptó: sin "versión" vacía
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
    expect(within(lista()).getByText('Aporte para materiales')).toBeInTheDocument();
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
