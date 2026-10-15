// src/app/components/NGOEmpleados.test.tsx
//
// NGOEmpleados hacía `fetch` directo (deuda conocida, AI_RULES regla 4; aprobada por el usuario, §98):
//   - sin el respaldo de api.ts: si VITE_API_URL no está definida la URL queda "undefined/ngos/…";
//   - no miraba `res.ok` al listar: un 403 ("Sin acceso") o un 500 se veían como "Sin miembros en el equipo".
// Ahora usa api.ngos.empleados y un error de carga se muestra como error con "Reintentar" (patrón de F9).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../lib/AuthContext', () => {
  const auth = { user: { id: 'u-ngo', name: 'ONG', role: 'ngo' } };
  return { useAuth: () => auth };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, ngos: { ...actual.api.ngos, empleados: { list: vi.fn(), create: vi.fn() } } } };
});

import { api, ApiError } from '../../lib/api';
import { NGOEmpleados } from './NGOEmpleados';

const mount = () => render(
  <MemoryRouter initialEntries={['/ngo/empleados/ngo-1']}>
    <Routes><Route path="/ngo/empleados/:id" element={<NGOEmpleados />} /></Routes>
  </MemoryRouter>
);
const ana = { id: 'e1', nombre: 'Ana', apellido: 'García', email: 'ana@ong.org', rol: 'coordinador' };

beforeEach(() => {
  vi.mocked(api.ngos.empleados.list).mockReset();
  vi.mocked(api.ngos.empleados.create).mockReset();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('NGOEmpleados no debe usar fetch directo'))));
});

describe('NGOEmpleados con api.ts', () => {
  test('lista el equipo con api.ngos.empleados.list(id)', async () => {
    vi.mocked(api.ngos.empleados.list).mockResolvedValue({ empleados: [ana] });
    mount();
    expect(await screen.findByText('Ana García')).toBeInTheDocument();
    expect(api.ngos.empleados.list).toHaveBeenCalledWith('ngo-1');
  });

  test('un error al cargar se ve como error con "Reintentar", no como "Sin miembros"', async () => {
    vi.mocked(api.ngos.empleados.list).mockRejectedValueOnce(new ApiError('Sin acceso', 403)).mockResolvedValueOnce({ empleados: [ana] });
    mount();
    expect(await screen.findByText('Sin acceso')).toBeInTheDocument();
    expect(screen.queryByText('Sin miembros en el equipo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Ana García')).toBeInTheDocument();
  });

  test('agregar usa api.ngos.empleados.create y recarga; un error del servidor se muestra', async () => {
    vi.mocked(api.ngos.empleados.list).mockResolvedValue({ empleados: [] });
    vi.mocked(api.ngos.empleados.create).mockRejectedValueOnce(new ApiError('El email no es válido', 400)).mockResolvedValueOnce({ empleado: ana } as never);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Agregar/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Apellido' }), { target: { value: 'García' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ana@ong.org' } });
    const submit = () => fireEvent.submit(screen.getByRole('textbox', { name: 'Email' }).closest('form')!);
    submit();
    expect(await screen.findByText('El email no es válido')).toBeInTheDocument();
    vi.mocked(api.ngos.empleados.list).mockResolvedValue({ empleados: [ana] });
    submit();
    await waitFor(() => expect(api.ngos.empleados.create).toHaveBeenLastCalledWith('ngo-1',
      { nombre: 'Ana', apellido: 'García', email: 'ana@ong.org', rol: 'coordinador' }));
    expect(await screen.findByText('Ana García')).toBeInTheDocument();
  });
});
