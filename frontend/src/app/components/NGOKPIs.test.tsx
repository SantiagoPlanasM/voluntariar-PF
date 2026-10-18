// src/app/components/NGOKPIs.test.tsx
//
// La fecha de un KPI ("YYYY-MM-DD", columna TEXT) se mostraba un día antes en Córdoba: `new Date(fecha)`
// la interpretaba como medianoche UTC (REVISION.md F2). El componente tiene que usar formatDateOnly.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { KPI } from '../../lib/api';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useParams: () => ({ projectId: 'proj-1' }), useNavigate: () => navigate };
});

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: {
        ...actual.api.projects,
        get: vi.fn(),
        kpis: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      },
    },
  };
});

import { api } from '../../lib/api';
import { NGOKPIs } from './NGOKPIs';

const kpi = {
  id: 'k1', project_id: 'proj-1', nombre: 'Árboles plantados', descripcion: null, valor: 120,
  tipo_valor: 'numero', unidad: 'árboles', fecha: '2026-10-01', created_at: '2026-10-01 12:00:00',
} as unknown as KPI;

describe('<NGOKPIs />: fecha del KPI', () => {
  let prevTZ: string | undefined;
  beforeEach(() => {
    prevTZ = process.env.TZ;
    process.env.TZ = 'America/Argentina/Cordoba';
    vi.mocked(api.projects.get).mockResolvedValue({ project: { title: 'Reforestación Urbana' } } as never);
    vi.mocked(api.projects.kpis.list).mockResolvedValue({ kpis: [kpi] });
  });
  afterEach(() => { if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ; });

  test('"2026-10-01" se muestra como el 1 de octubre, no como el 30 de septiembre', async () => {
    render(<NGOKPIs />);
    await waitFor(() => expect(screen.getAllByText('Árboles plantados').length).toBeGreaterThan(0));
    const expected = new Date(2026, 9, 1).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/^30 sept/)).not.toBeInTheDocument();
  });
});

// REVISION F3 (decisión del usuario: sacar el tipo "texto"). `kpis.valor` es numérica: un KPI de tipo texto
// ("Alta") se guardaba vacío. El formulario ya no lo ofrece; los que existan se siguen viendo y, al editarlos,
// el formulario arranca en "Número" (el backend ya no acepta "texto", §90).
describe('<NGOKPIs />: sin tipo "texto"', () => {
  const textoKpi = { ...kpi, id: 'k2', nombre: 'Nivel de compromiso', valor: null, tipo_valor: 'texto', fecha: null } as unknown as KPI;
  beforeEach(() => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { title: 'Reforestación Urbana' } } as never);
    vi.mocked(api.projects.kpis.list).mockResolvedValue({ kpis: [kpi, textoKpi] });
  });

  test('el selector de tipo no ofrece "Texto" y el valor es numérico', async () => {
    render(<NGOKPIs />);
    fireEvent.click(await screen.findByRole('button', { name: /Agregar KPI/ }));
    const tipo = screen.getByRole('combobox', { name: 'Tipo' });
    const opciones = within(tipo).getAllByRole('option').map((o) => o.getAttribute('value'));
    expect(opciones).toEqual(['numero', 'porcentaje', 'booleano']);
    expect(screen.getByLabelText('Valor')).toHaveAttribute('type', 'number');
  });

  test('un KPI de tipo texto que ya existía se sigue mostrando con su etiqueta', async () => {
    render(<NGOKPIs />);
    expect((await screen.findAllByText('Nivel de compromiso')).length).toBeGreaterThan(0);
    expect(screen.getByText('Texto')).toBeInTheDocument();
  });

  test('al editarlo, el formulario arranca en "Número" (no manda un tipo que el servidor rechaza)', async () => {
    render(<NGOKPIs />);
    vi.mocked(api.projects.kpis.update).mockResolvedValue({ kpi: textoKpi } as never);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar KPI Nivel de compromiso' }));
    // Lo que importa es lo que se MANDA: si el estado quedara en 'texto', el <select> igual mostraría la primera
    // opción (no hay <option> 'texto') y se enviaría un tipo que el servidor rechaza.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.projects.kpis.update).toHaveBeenCalled());
    expect(vi.mocked(api.projects.kpis.update).mock.calls[0][2]).toMatchObject({ tipo_valor: 'numero' });
  });
});


// TP de Calidad, cobertura del frontend (§210). Criterio de aceptación (escrito antes de los casos):
//  - alta: el nombre es obligatorio; se manda el nombre sin espacios de más, el valor como número y los campos
//    vacíos como `undefined` (no ""); al guardar se cierra el formulario y se recarga la lista; si falla, el error;
//  - con tipo "booleano" el valor se pide como "Logrado (1=Sí, 0=No)";
//  - borrar pide confirmación: si se cancela no se borra, si se confirma desaparece, si falla se avisa;
//  - la cruz cierra el formulario; "Volver" vuelve a la pantalla anterior; si no carga el título, los KPIs se ven igual.
describe('<NGOKPIs />: alta, borrado y navegación', () => {
  const abrirFormulario = async () => {
    render(<NGOKPIs />);
    await screen.findAllByText('Árboles plantados');
    fireEvent.click(screen.getByRole('button', { name: /Agregar KPI/ }));
    return screen.getByLabelText('Nombre').closest('form') as HTMLFormElement;
  };
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let alertSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.projects.get).mockReset().mockResolvedValue({ project: { title: 'Reforestación Urbana' } } as never);
    vi.mocked(api.projects.kpis.list).mockReset().mockResolvedValue({ kpis: [kpi] });
    vi.mocked(api.projects.kpis.create).mockReset().mockResolvedValue({ kpi } as never);
    vi.mocked(api.projects.kpis.delete).mockReset().mockResolvedValue({} as never);
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  afterEach(() => { confirmSpy.mockRestore(); alertSpy.mockRestore(); });

  test('alta con todos los campos: manda el cuerpo normalizado, cierra el formulario y recarga', async () => {
    // Arrange
    const form = await abrirFormulario();
    // Act
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Familias asistidas  ' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Por mes' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo' }), { target: { value: 'porcentaje' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '85' } });
    fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'familias' } });
    fireEvent.change(screen.getByLabelText('Fecha de medición'), { target: { value: '2026-10-05' } });
    fireEvent.submit(form);
    // Assert
    await waitFor(() => expect(api.projects.kpis.create).toHaveBeenCalledWith('proj-1', {
      nombre: 'Familias asistidas', descripcion: 'Por mes', valor: 85, tipo_valor: 'porcentaje', unidad: 'familias', fecha: '2026-10-05',
    }));
    await waitFor(() => expect(api.projects.kpis.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });

  test('alta solo con el nombre: los demás campos van como undefined, no ""', async () => {
    const form = await abrirFormulario();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Voluntarios' } });
    fireEvent.submit(form);
    await waitFor(() => expect(api.projects.kpis.create).toHaveBeenCalledWith('proj-1', {
      nombre: 'Voluntarios', descripcion: undefined, valor: undefined, tipo_valor: 'numero', unidad: undefined, fecha: undefined,
    }));
  });

  test('sin nombre (o solo espacios) no se manda y avisa', async () => {
    const form = await abrirFormulario();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(api.projects.kpis.create).not.toHaveBeenCalled();
  });

  test('si el alta falla, muestra el error y el formulario sigue abierto', async () => {
    vi.mocked(api.projects.kpis.create).mockRejectedValue(new Error('No se pudo guardar'));
    const form = await abrirFormulario();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Voluntarios' } });
    fireEvent.submit(form);
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Voluntarios');
  });

  test('tipo "booleano": el valor se pide como "Logrado (1=Sí, 0=No)"', async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo' }), { target: { value: 'booleano' } });
    expect(screen.getByLabelText('Logrado (1=Sí, 0=No)')).toHaveAttribute('placeholder', '1 o 0');
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
  });

  test('la cruz cierra el formulario y lo vacía', async () => {
    await abrirFormulario();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'A medias' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }));
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Agregar KPI/ }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
  });

  test('borrar: si se cancela la confirmación no se borra', async () => {
    confirmSpy.mockReturnValue(false);
    render(<NGOKPIs />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar KPI Árboles plantados' }));
    expect(confirmSpy).toHaveBeenCalledWith('¿Eliminar este KPI?');
    expect(api.projects.kpis.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Borrar KPI Árboles plantados' })).toBeInTheDocument();
  });

  test('borrar: confirmado, se borra y desaparece de la lista', async () => {
    render(<NGOKPIs />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar KPI Árboles plantados' }));
    await waitFor(() => expect(api.projects.kpis.delete).toHaveBeenCalledWith('proj-1', 'k1'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Borrar KPI Árboles plantados' })).not.toBeInTheDocument());
  });

  test('borrar: si falla, avisa con el mensaje y el KPI sigue', async () => {
    vi.mocked(api.projects.kpis.delete).mockRejectedValue(new Error('No autorizado'));
    render(<NGOKPIs />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar KPI Árboles plantados' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('No autorizado'));
    expect(screen.getByRole('button', { name: 'Borrar KPI Árboles plantados' })).toBeInTheDocument();
  });

  test('"Volver" vuelve a la pantalla anterior', async () => {
    render(<NGOKPIs />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  test('si no se puede cargar el título del proyecto, los KPIs se ven igual (sin título)', async () => {
    vi.mocked(api.projects.get).mockReset().mockRejectedValue(new Error('caído'));
    render(<NGOKPIs />);
    expect((await screen.findAllByText('Árboles plantados')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Reforestación Urbana')).not.toBeInTheDocument();
  });
});
