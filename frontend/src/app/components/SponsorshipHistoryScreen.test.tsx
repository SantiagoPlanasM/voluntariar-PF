// src/app/components/SponsorshipHistoryScreen.test.tsx — el historial de versiones del acuerdo de patrocinio (§326).
//
// Criterio (paso 3 del rediseño, lienzo del 11/11):
// - la lista de versiones de la más nueva a la más vieja: quién la hizo, qué hizo (agregó, editó o quitó cuántos
//   puntos) y quién la aceptó; arranca elegida la más nueva, que dice "Vigente";
// - el detalle de la elegida: quién y cuándo, si cada parte la aceptó, y cada cambio con su tipo (Agregó, Editó o
//   Quitó en texto, no solo en color), de qué parte es el punto, lo de antes y lo de ahora, con el monto;
// - una versión sin cambios de puntos (la propuesta) lo dice y, si es la 1, muestra el mensaje al proponer;
// - si el historial empieza después de la versión 1 (acuerdos de antes de §324), lo avisa;
// - sin versiones lo dice; si no se puede cargar, el error con la salida; "Volver al acuerdo" lleva al acuerdo.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { api, ApiError, SponsorshipAgreement, SponsorshipVersion } from '../../lib/api';
import { SponsorshipHistoryScreen } from './SponsorshipHistoryScreen';

const agreement = (over: Partial<SponsorshipAgreement> = {}): SponsorshipAgreement => ({
  company_id: 'e1', project_id: 'p1', company_name: 'TechCorp', ngo_name: 'Sustentando', project_title: 'Censo de árboles',
  status: 'propuesto', version: 3, message: 'Queremos acompañar el censo', my_side: 'ngo',
  accepted: { company: true, ngo: false }, accepted_versions: { company: 3, ngo: 2 }, accepted_at: { company: '2026-11-11T18:52:00.000Z', ngo: null },
  points: [], messages: [], ...over,
});
const versions: SponsorshipVersion[] = [
  { version: 3, side: 'ngo', author_name: 'Ana Pérez', created_at: '2026-11-11T18:40:00.000Z',
    accepted_by: [{ side: 'company', author_name: 'Laura Gómez', accepted_at: '2026-11-11T18:52:00.000Z' }],
    changes: [
      { action: 'edit', point_id: 'a', side: 'ngo', before: { type: 'other', detail: 'Informe con horas', amount: null },
        after: { type: 'other', detail: 'Informe con horas y fotos', amount: null } },
      { action: 'remove', point_id: 'b', side: 'ngo', before: { type: 'supplies', detail: 'Bolsas de residuos', amount: null }, after: null },
    ] },
  { version: 2, side: 'company', author_name: 'Laura Gómez', created_at: '2026-11-10T21:02:00.000Z',
    accepted_by: [{ side: 'ngo', author_name: 'Ana Pérez', accepted_at: '2026-11-10T22:10:00.000Z' }],
    changes: [{ action: 'add', point_id: 'c', side: 'company', before: null, after: { type: 'money', detail: 'Plantines', amount: 450000 } }] },
  { version: 1, side: null, author_name: null, created_at: '2026-11-09T19:00:00.000Z',
    accepted_by: [{ side: 'company', author_name: 'Laura Gómez', accepted_at: '2026-11-09T19:00:00.000Z' }], changes: [] },
];

const mount = (a: SponsorshipAgreement | Error = agreement(), v: SponsorshipVersion[] | Error = versions) => {
  const get = vi.spyOn(api.sponsorships, 'get');
  if (a instanceof Error) get.mockRejectedValue(a); else get.mockResolvedValue({ agreement: a });
  const history = vi.spyOn(api.sponsorships, 'history');
  if (v instanceof Error) history.mockRejectedValue(v); else history.mockResolvedValue({ versions: v });
  render(
    <MemoryRouter initialEntries={['/ngo/patrocinios/e1/p1/historial']}><Routes>
      <Route path="/ngo/patrocinios/:empresaId/:projectId/historial" element={<SponsorshipHistoryScreen />} />
      <Route path="/ngo/patrocinios/:empresaId/:projectId" element={<p>El acuerdo</p>} />
    </Routes></MemoryRouter>);
  return { get, history };
};
const lista = () => screen.getByRole('navigation', { name: 'Versiones' });
const detalle = () => screen.getByRole('region', { name: /^Versión \d+/ });
const version = (n: number) => within(lista()).getByRole('button', { name: new RegExp(`^Versión ${n}\\b`) });

beforeEach(() => { vi.restoreAllMocks(); });

describe('Historial de versiones del acuerdo', () => {
  test('la lista: de la más nueva a la más vieja, con quién, qué hizo y quién la aceptó', async () => {
    const { get, history } = mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'Historial de versiones' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('e1', 'p1');
    expect(history).toHaveBeenCalledWith('e1', 'p1');
    expect(screen.getByText(/Censo de árboles/)).toBeInTheDocument();
    const items = within(lista()).getAllByRole('button');
    expect(items.map(b => within(b).getByText(/^Versión \d+$/).textContent)).toEqual(['Versión 3', 'Versión 2', 'Versión 1']);
    expect(version(3)).toHaveTextContent('Ana Pérez: editó 1 punto y quitó 1 punto');
    expect(version(3)).toHaveTextContent('La aceptó TechCorp');
    expect(version(2)).toHaveTextContent('Laura Gómez: agregó 1 punto');
    expect(version(1)).toHaveTextContent('Propuesta de TechCorp');
  });

  test('arranca en la más nueva ("Vigente"): quién, cuándo, quién la aceptó y cada cambio en texto', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Versiones' });
    expect(version(3)).toHaveAttribute('aria-current', 'true');
    const d = detalle();
    expect(within(d).getByRole('heading', { name: 'Versión 3' })).toBeInTheDocument();
    expect(within(d).getByText('Vigente')).toBeInTheDocument();
    expect(within(d).getByText(/^Ana Pérez · /)).toBeInTheDocument();
    expect(within(d).getByText(/^TechCorp la aceptó/)).toBeInTheDocument();
    expect(within(d).getByText('Sustentando no la aceptó')).toBeInTheDocument();
    const cambios = within(d).getAllByRole('listitem');
    expect(within(cambios[0]).getByText('Editó')).toBeInTheDocument();
    expect(within(cambios[0]).getByText('Ofrece Sustentando · Otro')).toBeInTheDocument();
    expect(within(cambios[0]).getByText('Informe con horas')).toBeInTheDocument();          // antes
    expect(within(cambios[0]).getByText('Informe con horas y fotos')).toBeInTheDocument();  // ahora
    expect(within(cambios[1]).getByText('Quitó')).toBeInTheDocument();
    expect(within(cambios[1]).getByText('Bolsas de residuos')).toBeInTheDocument();
    expect(within(cambios[1]).getByText('Ofrece Sustentando · Insumos')).toBeInTheDocument();   // el tipo, de cómo estaba
  });

  test('una versión que nadie aceptó lo dice', async () => {
    mount(agreement(), [{ ...versions[0], accepted_by: [] }, ...versions.slice(1)]);
    expect(await screen.findByRole('button', { name: /^Versión 3\b/ })).toHaveTextContent('Nadie la aceptó');
  });

  test('una versión sin cambios que no es la 1 (historial que empieza tarde) no muestra el mensaje de la propuesta', async () => {
    mount(agreement(), [{ ...versions[2], version: 5 }]);
    expect(await screen.findByText('No hubo cambios de puntos en esta versión.')).toBeInTheDocument();
    expect(screen.queryByText('Queremos acompañar el censo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Versión 5\b/ })).toHaveTextContent('Sin cambios de puntos');
  });

  test('elegir otra versión muestra su detalle, con el monto', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Versión 2\b/ }));
    expect(version(2)).toHaveAttribute('aria-current', 'true');
    expect(version(3)).toHaveAttribute('aria-current', 'false');
    const d = detalle();
    expect(within(d).getByRole('heading', { name: 'Versión 2' })).toBeInTheDocument();
    expect(within(d).queryByText('Vigente')).not.toBeInTheDocument();
    expect(within(d).getByText('Agregó')).toBeInTheDocument();
    expect(within(d).getByText('Aporta TechCorp · Dinero')).toBeInTheDocument();
    expect(within(d).getByText(/450\.000/)).toBeInTheDocument();
    expect(within(d).getByText(/^Sustentando la aceptó/)).toBeInTheDocument();
  });

  // En el celular el detalle queda debajo de la lista: elegir una versión tiene que llevar hasta él (visto en Chrome).
  test('angosto (< 1024 px): elegir una versión baja hasta el detalle; ancho, no', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const real = window.matchMedia;
    for (const wide of [false, true]) {
      window.matchMedia = vi.fn().mockReturnValue({ matches: wide, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
      scroll.mockClear();
      mount();
      fireEvent.click(await screen.findByRole('button', { name: /^Versión 2\b/ }));
      if (wide) expect(scroll).not.toHaveBeenCalled();
      else expect(scroll).toHaveBeenCalledTimes(1);
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    }
    window.matchMedia = real;
  });

  test('la propuesta: sin cambios de puntos y con el mensaje al proponer', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Versión 1\b/ }));
    const d = detalle();
    expect(within(d).getByText('No hubo cambios de puntos en esta versión.')).toBeInTheDocument();
    expect(within(d).getByText('Queremos acompañar el censo')).toBeInTheDocument();
  });

  test('si el historial empieza después de la versión 1, lo avisa', async () => {
    mount(agreement(), versions.slice(0, 2));
    expect(await screen.findByText(/El historial empieza en la versión 2/)).toBeInTheDocument();
  });

  test('sin versiones lo dice', async () => {
    mount(agreement(), []);
    expect(await screen.findByText('Todavía no hay versiones registradas.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Versiones' })).not.toBeInTheDocument();
  });

  test('"Volver al acuerdo" lleva al acuerdo', async () => {
    mount();
    fireEvent.click(await screen.findByRole('link', { name: 'Volver al acuerdo' }));
    expect(await screen.findByText('El acuerdo')).toBeInTheDocument();
  });

  test('si no se puede cargar, el error con la salida', async () => {
    mount(new ApiError('Acuerdo no encontrado', 404));
    expect(await screen.findByText('No encontramos este acuerdo')).toBeInTheDocument();
  });

  test('si falla el historial, también', async () => {
    mount(agreement(), new ApiError('Error al cargar el historial', 500));
    expect(await screen.findByText('Error al cargar el historial')).toBeInTheDocument();
  });
});
