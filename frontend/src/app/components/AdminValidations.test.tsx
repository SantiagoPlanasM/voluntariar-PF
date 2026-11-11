// src/app/components/AdminValidations.test.tsx — panel de administración: validaciones de ONG (/admin/validaciones, §317).
// Criterio de aceptación (antes de escribir la pantalla; DESIGN.md → Validación de ONGs, "Revisión"):
//  - sin sesión: el aviso y "Iniciar sesión"; quien no es admin (403 de la API): "solo para el equipo de VoluntariAR"
//    (la guarda real es la API, regla 15);
//  - lista las que están en revisión (la ONG con link a su perfil, CUIT, personería, cuándo se envió); "Todas" pide
//    ?status=all; sin ninguna, lo dice;
//  - los dos PDF se abren con el link firmado del admin;
//  - "Aprobar" pregunta antes; si confirma, la fila queda "Validada" y sin botones; si no, nada;
//  - "Rechazar" pide el motivo (de 10 a 500, como el backend): corto → el error y no sale nada; bien → la fila queda
//    "Rechazada" con el motivo;
//  - si la decisión falla (p. ej. 409: otro admin ya decidió), el mensaje y la fila sigue igual.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api, ApiError, AdminValidation } from '../../lib/api';
import { UiProvider } from '../ui/UiProvider';

const { auth } = vi.hoisted(() => ({
  auth: { user: null as null | Record<string, unknown>, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/cv', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cv')>('../../lib/cv');
  return { ...actual, openSignedLink: vi.fn() };
});
import { openSignedLink } from '../../lib/cv';
import { AdminValidations } from './AdminValidations';

const item = (over: Partial<AdminValidation> = {}): AdminValidation => ({
  id: 'v1', ngo_id: 'n1', ngo_name: 'Manos Unidas', status: 'pending', cuit: '30-71234567-1',
  legal_type: 'civil_association', reason: null, submitted_at: '2026-11-10 12:00:00', reviewed_at: null, ...over,
});
const lists = (validations: AdminValidation[]) => vi.spyOn(api.admin.validations, 'list').mockResolvedValue({ validations });
const mount = () => render(<MemoryRouter><UiProvider><AdminValidations /></UiProvider></MemoryRouter>);
const row = (name: string) => screen.getByRole('article', { name });

beforeEach(() => {
  vi.restoreAllMocks();
  auth.user = { id: 'u-admin', name: 'Admin', email: 'admin@x.com', role: 'volunteer' };
  auth.openAuthModal.mockReset();
  vi.mocked(openSignedLink).mockReset().mockResolvedValue(undefined);
});

describe('<AdminValidations />: acceso', () => {
  test('sin sesión: el aviso y "Iniciar sesión" abre el ingreso, sin pedir nada', () => {
    auth.user = null;
    const list = vi.spyOn(api.admin.validations, 'list');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.openAuthModal).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  });

  test('quien no es admin (403): la pantalla lo dice', async () => {
    vi.spyOn(api.admin.validations, 'list').mockRejectedValue(new ApiError('Solo para administradores', 403));
    mount();
    expect(await screen.findByText('Esta pantalla es solo para el equipo de VoluntariAR.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  test('otro error: el mensaje y "Reintentar"', async () => {
    const list = vi.spyOn(api.admin.validations, 'list')
      .mockRejectedValueOnce(new ApiError('Error al obtener las validaciones', 500))
      .mockResolvedValueOnce({ validations: [] });
    mount();
    expect(await screen.findByText('Error al obtener las validaciones')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay validaciones en revisión.')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe('<AdminValidations />: la lista', () => {
  test('en revisión: la ONG con link a su perfil, el CUIT, la personería y el estado', async () => {
    const list = lists([item()]);
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    expect(list).toHaveBeenCalledWith(false);
    expect(within(r).getByRole('link', { name: 'Manos Unidas' })).toHaveAttribute('href', '/ngo/n1');
    expect(r).toHaveTextContent('30-71234567-1');
    expect(r).toHaveTextContent('Asociación civil');
    expect(within(r).getByText('En revisión')).toBeInTheDocument();
  });

  test('"Todas" pide ?status=all y muestra el motivo de las rechazadas; sin ninguna en revisión, lo dice', async () => {
    const list = vi.spyOn(api.admin.validations, 'list')
      .mockResolvedValueOnce({ validations: [] })
      .mockResolvedValueOnce({ validations: [item({ status: 'rejected', reason: 'Falta la firma del estatuto' })] });
    mount();
    expect(await screen.findByText('No hay validaciones en revisión.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Todas' }));
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    expect(list).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('radio', { name: 'Todas' })).toHaveAttribute('aria-checked', 'true');
    expect(r).toHaveTextContent('Falta la firma del estatuto');
    expect(within(r).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
  });

  test('"Todas" sin ninguna: "Todavía no hay validaciones."', async () => {
    vi.spyOn(api.admin.validations, 'list').mockResolvedValue({ validations: [] });
    mount();
    await screen.findByText('No hay validaciones en revisión.');
    fireEvent.click(screen.getByRole('radio', { name: 'Todas' }));
    expect(await screen.findByText('Todavía no hay validaciones.')).toBeInTheDocument();
  });

  test('los PDF se abren con el link firmado del admin', async () => {
    lists([item()]);
    vi.spyOn(api.admin.validations, 'document').mockResolvedValue({ url: 'https://x', expires_at: '' });
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Ver estatuto' }));
    await waitFor(() => expect(openSignedLink).toHaveBeenCalledTimes(1));
    await vi.mocked(openSignedLink).mock.calls[0][0]();
    expect(api.admin.validations.document).toHaveBeenCalledWith('v1', 'statute');
    fireEvent.click(within(r).getByRole('button', { name: 'Ver constancia' }));
    await waitFor(() => expect(openSignedLink).toHaveBeenCalledTimes(2));
    await vi.mocked(openSignedLink).mock.calls[1][0]();
    expect(api.admin.validations.document).toHaveBeenLastCalledWith('v1', 'registration');
  });

  test('si un PDF no se puede abrir: el mensaje en la fila', async () => {
    lists([item()]);
    vi.mocked(openSignedLink).mockRejectedValue(new ApiError('Documento no encontrado', 404));
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Ver estatuto' }));
    expect(await within(r).findByRole('alert')).toHaveTextContent('Documento no encontrado');
  });
});

describe('<AdminValidations />: decidir', () => {
  test('"Aprobar" pregunta; si confirma, la fila queda "Validada" y sin botones', async () => {
    lists([item()]);
    const approve = vi.spyOn(api.admin.validations, 'approve').mockResolvedValue({ validation: item({ status: 'approved', reviewed_at: '2026-11-11T10:00:00.000Z' }) });
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Aprobar' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Validar Manos Unidas?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Validar' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('v1'));
    expect(await within(row('Manos Unidas')).findByText('Validada')).toBeInTheDocument();
    expect(within(row('Manos Unidas')).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(within(row('Manos Unidas')).queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  test('"Aprobar" y después "Volver": no aprueba', async () => {
    lists([item()]);
    const approve = vi.spyOn(api.admin.validations, 'approve');
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Aprobar' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(approve).not.toHaveBeenCalled();
    expect(within(r).getByText('En revisión')).toBeInTheDocument();
  });

  test('"Rechazar" pide el motivo: corto → el error y no sale nada; bien → "Rechazada" con el motivo', async () => {
    lists([item()]);
    const reject = vi.spyOn(api.admin.validations, 'reject')
      .mockResolvedValue({ validation: item({ status: 'rejected', reason: 'Falta la firma del estatuto' }) });
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Rechazar' }));
    const reason = within(r).getByLabelText('Motivo del rechazo');
    fireEvent.change(reason, { target: { value: 'corto' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Confirmar rechazo' }));
    expect(await within(r).findByRole('alert')).toHaveTextContent('Escribí el motivo del rechazo (de 10 a 500 caracteres)');
    expect(reject).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: '  Falta la firma del estatuto  ' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Confirmar rechazo' }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith('v1', 'Falta la firma del estatuto'));
    expect(await within(row('Manos Unidas')).findByText('Rechazada')).toBeInTheDocument();
    expect(row('Manos Unidas')).toHaveTextContent('Falta la firma del estatuto');
    expect(within(row('Manos Unidas')).queryByLabelText('Motivo del rechazo')).not.toBeInTheDocument();
  });

  test('"Cancelar" cierra el motivo sin rechazar', async () => {
    lists([item()]);
    const reject = vi.spyOn(api.admin.validations, 'reject');
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Rechazar' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Cancelar' }));
    expect(within(r).queryByLabelText('Motivo del rechazo')).not.toBeInTheDocument();
    expect(reject).not.toHaveBeenCalled();
  });

  test('el campo del motivo cuenta los caracteres (tope 500)', async () => {
    lists([item()]);
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Rechazar' }));
    const reason = within(r).getByLabelText('Motivo del rechazo');
    expect(reason).toHaveAttribute('maxLength', '500');
    fireEvent.change(reason, { target: { value: 'Hola mundo' } });
    expect(within(r).getByText('10/500')).toBeInTheDocument();
  });

  test('si la decisión falla (otro admin ya decidió): el mensaje y la fila sigue en revisión', async () => {
    lists([item()]);
    vi.spyOn(api.admin.validations, 'approve').mockRejectedValue(new ApiError('Esa validación ya no está en revisión', 409));
    mount();
    const r = await screen.findByRole('article', { name: 'Manos Unidas' });
    fireEvent.click(within(r).getByRole('button', { name: 'Aprobar' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Validar' }));
    expect(await within(r).findByRole('alert')).toHaveTextContent('Esa validación ya no está en revisión');
    expect(within(r).getByText('En revisión')).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Aprobar' })).toBeEnabled();
  });
});
