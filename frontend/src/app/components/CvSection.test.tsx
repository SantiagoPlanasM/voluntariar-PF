// src/app/components/CvSection.test.tsx
//
// "Mi CV" en el perfil propio del voluntario (PLAN_FALTANTE.md, Etapa 5, §166): saber si hay CV (has_cv de
// /auth/me), subir o reemplazar un PDF, verlo (link que vence) y borrarlo con una confirmación en la pantalla (no
// window.confirm).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api, ApiError } from '../../lib/api';

vi.mock('../../lib/cv', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cv')>('../../lib/cv');
  return { ...actual, openCv: vi.fn() };
});
import { openCv } from '../../lib/cv';
import { CvSection } from './CvSection';

const pdf = (size = 10) => new File([new Uint8Array(size)], 'mi-cv.pdf', { type: 'application/pdf' });
const choose = (file: File) => fireEvent.change(screen.getByLabelText('Elegir un PDF con tu CV'), { target: { files: [file] } });
const me = (has_cv: boolean) => vi.spyOn(api.auth, 'me').mockResolvedValue({ user: { id: 'u-3' } as never, profile: { has_cv } });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openCv).mockReset().mockResolvedValue(undefined);
});

describe('<CvSection />', () => {
  test('sin CV: lo dice, explica quién lo ve y ofrece subirlo', async () => {
    me(false);
    render(<CvSection userId="u-3" />);
    expect(await screen.findByText('Todavía no cargaste tu CV.')).toBeInTheDocument();
    expect(screen.getByText(/Solo lo ven las ONG de los voluntariados a los que te postulaste/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir CV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver CV' })).toBeNull();
    expect(screen.getByLabelText('Elegir un PDF con tu CV')).toHaveAttribute('accept', 'application/pdf');
  });

  test('con CV: "Ver", "Reemplazar" y "Borrar"', async () => {
    me(true);
    render(<CvSection userId="u-3" />);
    expect(await screen.findByText('Tu CV está cargado.')).toBeInTheDocument();
    for (const name of ['Ver CV', 'Reemplazar', 'Borrar CV']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  test('subir: manda el PDF en el campo "cv" y pasa a "cargado"', async () => {
    me(false);
    const up = vi.spyOn(api.voluntarios.cv, 'upload').mockResolvedValue({ has_cv: true });
    render(<CvSection userId="u-3" />);
    await screen.findByText('Todavía no cargaste tu CV.');
    const file = pdf();
    choose(file);
    expect(await screen.findByText('Tu CV está cargado.')).toBeInTheDocument();
    const form = up.mock.calls[0][0];
    expect(form.get('cv')).toBe(file);
    expect(screen.getByRole('status')).toHaveTextContent('CV guardado');
  });

  test('mientras sube: el botón dice "Subiendo…" y está deshabilitado', async () => {
    me(true);
    let finish!: (v: { has_cv: boolean }) => void;
    vi.spyOn(api.voluntarios.cv, 'upload').mockReturnValue(new Promise((r) => { finish = r; }));
    render(<CvSection userId="u-3" />);
    await screen.findByText('Tu CV está cargado.');
    choose(pdf());
    expect(await screen.findByRole('button', { name: 'Subiendo…' })).toBeDisabled();
    finish({ has_cv: true });
    expect(await screen.findByRole('button', { name: 'Reemplazar' })).toBeEnabled();
  });

  test('un archivo que no es PDF o pesa más de 5 MB: aviso y no se sube', async () => {
    me(false);
    const up = vi.spyOn(api.voluntarios.cv, 'upload');
    render(<CvSection userId="u-3" />);
    await screen.findByText('Todavía no cargaste tu CV.');
    choose(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El CV tiene que ser un PDF');
    choose(pdf(5 * 1024 * 1024 + 1));
    expect(await screen.findByRole('alert')).toHaveTextContent('El CV puede pesar hasta 5 MB');
    expect(up).not.toHaveBeenCalled();
  });

  test('el servidor lo rechaza: muestra su mensaje y sigue como estaba', async () => {
    me(false);
    vi.spyOn(api.voluntarios.cv, 'upload').mockRejectedValue(new ApiError('El archivo no es un PDF válido', 400));
    render(<CvSection userId="u-3" />);
    await screen.findByText('Todavía no cargaste tu CV.');
    choose(pdf());
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo no es un PDF válido');
    expect(screen.getByText('Todavía no cargaste tu CV.')).toBeInTheDocument();
  });

  test('sin red: mensaje de conexión', async () => {
    me(false);
    vi.spyOn(api.voluntarios.cv, 'upload').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<CvSection userId="u-3" />);
    await screen.findByText('Todavía no cargaste tu CV.');
    choose(pdf());
    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/i);
  });

  test('ver: abre el link del propio CV', async () => {
    me(true);
    render(<CvSection userId="u-3" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver CV' }));
    expect(openCv).toHaveBeenCalledWith('u-3');
  });

  test('ver falla: muestra el motivo', async () => {
    me(true);
    vi.mocked(openCv).mockRejectedValue(new ApiError('La descarga de archivos no está disponible por el momento', 503));
    render(<CvSection userId="u-3" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver CV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La descarga de archivos no está disponible por el momento');
  });

  test('borrar: pide confirmar en la pantalla; "Cancelar" no borra; "Sí, borrar" borra y pasa a "sin CV"', async () => {
    me(true);
    const rm = vi.spyOn(api.voluntarios.cv, 'remove').mockResolvedValue({ has_cv: false });
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<CvSection userId="u-3" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar CV' }));
    const box = screen.getByRole('group', { name: '¿Borrar tu CV?' });
    fireEvent.click(within(box).getByRole('button', { name: 'Cancelar' }));
    expect(rm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: '¿Borrar tu CV?' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Borrar CV' }));
    fireEvent.click(within(screen.getByRole('group', { name: '¿Borrar tu CV?' })).getByRole('button', { name: 'Sí, borrar' }));
    expect(await screen.findByText('Todavía no cargaste tu CV.')).toBeInTheDocument();
    expect(rm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('CV borrado');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('borrar falla: aviso y el CV sigue', async () => {
    me(true);
    vi.spyOn(api.voluntarios.cv, 'remove').mockRejectedValue(new ApiError('Error al borrar el CV', 500));
    render(<CvSection userId="u-3" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar CV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al borrar el CV');
    expect(screen.getByText('Tu CV está cargado.')).toBeInTheDocument();
  });

  test('si no se puede saber si hay CV: lo dice y no ofrece botones engañosos', async () => {
    vi.spyOn(api.auth, 'me').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<CvSection userId="u-3" />);
    expect(await screen.findByText('No se pudo cargar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subir CV|Ver CV|Borrar CV/ })).toBeNull();
  });

  test('un intento nuevo limpia el aviso anterior', async () => {
    me(false);
    vi.spyOn(api.voluntarios.cv, 'upload')
      .mockRejectedValueOnce(new ApiError('No pudimos subir el CV. Probá de nuevo en un momento.', 502))
      .mockResolvedValueOnce({ has_cv: true });
    render(<CvSection userId="u-3" />);
    await screen.findByText('Todavía no cargaste tu CV.');
    choose(pdf());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    choose(pdf());
    await waitFor(() => expect(screen.getByText('Tu CV está cargado.')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
