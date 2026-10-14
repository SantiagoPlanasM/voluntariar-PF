// src/app/components/PostComposer.test.tsx
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PostComposer } from './PostComposer';
import { makePost, deferred } from '../../test/postFixtures';
import type { Post, User } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: { ...actual.api, posts: { ...actual.api.posts, eligibleProjects: vi.fn(), create: vi.fn() } },
  };
});
// Se conservan las constantes reales (tipos aceptados, 8 MB); solo la compresión (que necesita canvas) es un doble.
vi.mock('../../lib/imageCompress', async () => {
  const actual = await vi.importActual<typeof import('../../lib/imageCompress')>('../../lib/imageCompress');
  return { ...actual, compressImage: vi.fn() };
});

import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompress';

const volunteer: User = { id: 'u1', name: 'María', email: 'm@x.com', role: 'volunteer' };
const ngo: User = { id: 'u2', name: 'Fundación Verde', email: 'f@x.com', role: 'ngo' };
const asViewer = (user: User) =>
  vi.mocked(useAuth).mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);

const TWO_PROJECTS = [
  { id: 'proj-1', title: 'Reforestación Urbana' },
  { id: 'proj-2', title: 'Comedor Comunitario' },
];
const photo = (name: string, type = 'image/jpeg') => new File(['x'], name, { type });

let urlCounter = 0;
beforeEach(() => {
  urlCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${++urlCounter}`);
  URL.revokeObjectURL = vi.fn();
  asViewer(volunteer);
  vi.mocked(api.posts.eligibleProjects).mockReset().mockResolvedValue({ projects: TWO_PROJECTS });
  vi.mocked(api.posts.create).mockReset().mockResolvedValue({ post: makePost({ id: 'nuevo' }) });
  vi.mocked(compressImage).mockReset().mockImplementation(async (f: File) => new File(['c'], `c-${f.name}`, { type: 'image/jpeg' }));
});
afterEach(() => { vi.restoreAllMocks(); });

async function renderOpen(props: Partial<React.ComponentProps<typeof PostComposer>> = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const utils = render(<PostComposer onClose={onClose} onCreated={onCreated} {...props} />);
  await screen.findByLabelText('Voluntariado');
  return { onClose, onCreated, ...utils };
}

const addPhotos = (...files: File[]) =>
  fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files } });
const choose = (id: string) =>
  fireEvent.change(screen.getByLabelText('Voluntariado'), { target: { value: id } });
const publishBtn = () => screen.getByRole('button', { name: /^(Publicar|Publicando…|Preparando fotos…)$/ });

describe('<PostComposer /> — carga de proyectos', () => {
  test('es un diálogo modal con título y trae los proyectos elegibles', async () => {
    await renderOpen();
    expect(screen.getByRole('dialog', { name: 'Compartir un momento' })).toHaveAttribute('aria-modal', 'true');
    expect(api.posts.eligibleProjects).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('option', { name: 'Reforestación Urbana' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Comedor Comunitario' })).toBeInTheDocument();
  });

  test('mientras carga muestra un estado de carga y no se puede publicar', async () => {
    const d = deferred<{ projects: { id: string; title: string }[] }>();
    vi.mocked(api.posts.eligibleProjects).mockReturnValue(d.promise);
    render(<PostComposer onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(screen.queryByLabelText('Voluntariado')).not.toBeInTheDocument();
    await act(async () => { d.resolve({ projects: TWO_PROJECTS }); });
    expect(await screen.findByLabelText('Voluntariado')).toBeInTheDocument();
  });

  test('con varios proyectos no preselecciona ninguno', async () => {
    await renderOpen();
    expect((screen.getByLabelText('Voluntariado') as HTMLSelectElement).value).toBe('');
  });

  test('con un solo proyecto lo deja preseleccionado', async () => {
    vi.mocked(api.posts.eligibleProjects).mockResolvedValue({ projects: [TWO_PROJECTS[0]] });
    await renderOpen();
    expect((screen.getByLabelText('Voluntariado') as HTMLSelectElement).value).toBe('proj-1');
  });

  test('un voluntario sin proyectos elegibles ve por qué y no puede publicar', async () => {
    vi.mocked(api.posts.eligibleProjects).mockResolvedValue({ projects: [] });
    render(<PostComposer onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(await screen.findByText(/inscripción aprobada/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agregar fotos')).not.toBeInTheDocument();
  });

  test('una ONG sin proyectos ve un mensaje propio (crear un voluntariado)', async () => {
    asViewer(ngo);
    vi.mocked(api.posts.eligibleProjects).mockResolvedValue({ projects: [] });
    render(<PostComposer onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(await screen.findByText(/Creá un voluntariado/i)).toBeInTheDocument();
    expect(screen.queryByText(/inscripción aprobada/i)).not.toBeInTheDocument();
  });

  test('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(api.posts.eligibleProjects)
      .mockRejectedValueOnce(new Error('Error del servidor'))
      .mockResolvedValueOnce({ projects: TWO_PROJECTS });
    render(<PostComposer onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Voluntariado')).toBeInTheDocument();
    expect(api.posts.eligibleProjects).toHaveBeenCalledTimes(2);
  });

  test('un fallo de red al cargar no muestra "Failed to fetch"', async () => {
    vi.mocked(api.posts.eligibleProjects).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<PostComposer onClose={vi.fn()} onCreated={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('Failed to fetch');
    expect(alert.textContent).toMatch(/conexión/i);
  });

  test('muestra el aviso de subir solo fotos propias o con permiso', async () => {
    await renderOpen();
    expect(screen.getByText(/solo fotos tuyas o que tengas permiso/i)).toBeInTheDocument();
  });
});

describe('<PostComposer /> — fotos', () => {
  test('al elegir fotos muestra una vista previa de cada una y el contador', async () => {
    await renderOpen();
    addPhotos(photo('a.jpg'), photo('b.png', 'image/png'));
    expect(screen.getByRole('img', { name: 'Foto 1 seleccionada' })).toHaveAttribute('src', 'blob:preview-1');
    expect(screen.getByRole('img', { name: 'Foto 2 seleccionada' })).toHaveAttribute('src', 'blob:preview-2');
    expect(screen.getByText('2/5 fotos')).toBeInTheDocument();
  });

  test('las fotos nuevas se suman a las que ya estaban', async () => {
    await renderOpen();
    addPhotos(photo('a.jpg'));
    addPhotos(photo('b.jpg'), photo('c.jpg'));
    expect(screen.getByText('3/5 fotos')).toBeInTheDocument();
  });

  test('acepta como máximo 5 fotos: las que sobran se descartan y se avisa', async () => {
    await renderOpen();
    addPhotos(...[1, 2, 3, 4, 5, 6, 7].map((n) => photo(`f${n}.jpg`)));
    expect(screen.getByText('5/5 fotos')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /seleccionada/ })).toHaveLength(5);
    expect(screen.getByRole('alert')).toHaveTextContent('hasta 5 fotos');
  });

  test('el tope de 5 también rige cuando se agregan de a poco', async () => {
    await renderOpen();
    addPhotos(photo('a.jpg'), photo('b.jpg'), photo('c.jpg'), photo('d.jpg'));
    addPhotos(photo('e.jpg'), photo('f.jpg'));
    expect(screen.getByText('5/5 fotos')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('hasta 5 fotos');
  });

  test('con 5 fotos ya no se pueden agregar más (el selector se deshabilita)', async () => {
    await renderOpen();
    addPhotos(...[1, 2, 3, 4, 5].map((n) => photo(`f${n}.jpg`)));
    expect(screen.getByLabelText('Agregar fotos')).toBeDisabled();
  });

  test('un archivo que no es JPEG/PNG/WebP se rechaza con un mensaje', async () => {
    await renderOpen();
    addPhotos(photo('doc.pdf', 'application/pdf'));
    expect(screen.queryByRole('img', { name: /seleccionada/ })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG o WebP');
  });

  test('entre archivos válidos e inválidos se quedan solo los válidos', async () => {
    await renderOpen();
    addPhotos(photo('a.jpg'), photo('x.gif', 'image/gif'), photo('b.webp', 'image/webp'));
    expect(screen.getByText('2/5 fotos')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, PNG o WebP');
  });

  test('se puede quitar una foto: desaparece su vista previa y se libera su URL', async () => {
    await renderOpen();
    addPhotos(photo('a.jpg'), photo('b.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    expect(screen.getByText('1/5 fotos')).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:preview-2');
    // quedó la segunda
    expect(screen.getByRole('img', { name: 'Foto 1 seleccionada' })).toHaveAttribute('src', 'blob:preview-2');
  });

  test('al cerrar el compositor se liberan todas las URLs de vista previa', async () => {
    const { unmount } = await renderOpen();
    addPhotos(photo('a.jpg'), photo('b.jpg'));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
  });

  test('después de elegir, el selector se vacía (si no, el navegador no avisa al re-elegir el mismo archivo)', async () => {
    await renderOpen();
    const input = screen.getByLabelText('Agregar fotos') as HTMLInputElement;
    Object.defineProperty(input, 'value', { writable: true, value: 'C:\\fakepath\\a.jpg' });
    fireEvent.change(input, { target: { files: [photo('a.jpg')] } });
    expect(input.value).toBe('');
  });

  test('quitar fotos permite volver a agregar', async () => {
    await renderOpen();
    addPhotos(...[1, 2, 3, 4, 5].map((n) => photo(`f${n}.jpg`)));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 5' }));
    expect(screen.getByLabelText('Agregar fotos')).not.toBeDisabled();
  });
});

describe('<PostComposer /> — texto', () => {
  test('el contador arranca en 0/500 y sigue lo que se escribe', async () => {
    await renderOpen();
    expect(screen.getByText('0/500')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: 'Hola' } });
    expect(screen.getByText('4/500')).toBeInTheDocument();
  });

  test('no deja pasar de 500 caracteres', async () => {
    await renderOpen();
    const box = screen.getByLabelText('Descripción (opcional)') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'a'.repeat(600) } });
    expect(box.value).toHaveLength(500);
    expect(screen.getByText('500/500')).toBeInTheDocument();
  });
});

describe('<PostComposer /> — publicar', () => {
  test('"Publicar" está deshabilitado hasta tener proyecto Y al menos una foto', async () => {
    await renderOpen();
    expect(publishBtn()).toBeDisabled();
    choose('proj-1');
    expect(publishBtn()).toBeDisabled();           // falta la foto
    addPhotos(photo('a.jpg'));
    expect(publishBtn()).not.toBeDisabled();
    choose('');
    expect(publishBtn()).toBeDisabled();           // se volvió a quitar el proyecto
  });

  test('sin foto pero con proyecto y texto sigue deshabilitado', async () => {
    await renderOpen();
    choose('proj-1');
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: 'Hola' } });
    expect(publishBtn()).toBeDisabled();
  });

  test('comprime cada foto y sube un FormData con project_id, caption (sin espacios sobrantes) y las fotos comprimidas EN ORDEN', async () => {
    const { onCreated } = await renderOpen();
    choose('proj-2');
    addPhotos(photo('a.jpg'), photo('b.jpg'));
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: '  Un día genial  ' } });
    fireEvent.click(publishBtn());

    await waitFor(() => expect(api.posts.create).toHaveBeenCalledTimes(1));
    expect(compressImage).toHaveBeenCalledTimes(2);

    const form = vi.mocked(api.posts.create).mock.calls[0][0] as FormData;
    expect(form.get('project_id')).toBe('proj-2');
    expect(form.get('caption')).toBe('Un día genial');
    expect(form.getAll('photos').map((f) => (f as File).name)).toEqual(['c-a.jpg', 'c-b.jpg']);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onCreated.mock.calls[0][0].id).toBe('nuevo');
  });

  test('sin texto (o solo espacios) NO manda el campo caption', async () => {
    await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: '   ' } });
    fireEvent.click(publishBtn());
    await waitFor(() => expect(api.posts.create).toHaveBeenCalled());
    const form = vi.mocked(api.posts.create).mock.calls[0][0] as FormData;
    expect(form.has('caption')).toBe(false);
  });

  test('mientras sube: botón en "Publicando…" deshabilitado, no se puede cerrar y un segundo clic no manda otro pedido', async () => {
    const d = deferred<{ post: ReturnType<typeof makePost> }>();
    vi.mocked(api.posts.create).mockReturnValue(d.promise);
    const { onClose } = await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.click(publishBtn());

    await waitFor(() => expect(api.posts.create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    // Si el confirm se contestara que sí, un cierre mal bloqueado cerraría: se lo deja listo para detectarlo.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publicando…' }));
    expect(api.posts.create).toHaveBeenCalledTimes(1);

    await act(async () => { d.resolve({ post: makePost() }); });
  });

  test('mientras comprime muestra "Preparando fotos…"', async () => {
    const d = deferred<File>();
    vi.mocked(compressImage).mockReturnValue(d.promise);
    await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.click(publishBtn());
    expect(await screen.findByRole('button', { name: 'Preparando fotos…' })).toBeDisabled();
    expect(api.posts.create).not.toHaveBeenCalled();
    await act(async () => { d.resolve(photo('c.jpg')); });
    await waitFor(() => expect(api.posts.create).toHaveBeenCalled());
  });

  test('si una foto no se puede comprimir: muestra el motivo, NO sube nada y conserva el formulario', async () => {
    vi.mocked(compressImage)
      .mockResolvedValueOnce(photo('c1.jpg'))
      .mockRejectedValueOnce(new Error('No pudimos leer esa foto. Probá con otra.'));
    const { onCreated } = await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'), photo('b.jpg'));
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: 'Mi texto' } });
    fireEvent.click(publishBtn());

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos leer esa foto');
    expect(api.posts.create).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByText('2/5 fotos')).toBeInTheDocument();
    expect((screen.getByLabelText('Descripción (opcional)') as HTMLTextAreaElement).value).toBe('Mi texto');
    expect(publishBtn()).not.toBeDisabled();
  });

  test('si el servidor rechaza: muestra su mensaje, conserva todo y se puede reintentar', async () => {
    vi.mocked(api.posts.create)
      .mockRejectedValueOnce(new Error('Llegaste al límite de publicaciones por hora'))
      .mockResolvedValueOnce({ post: makePost({ id: 'ok' }) });
    const { onCreated } = await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: 'Mi texto' } });
    fireEvent.click(publishBtn());

    expect(await screen.findByRole('alert')).toHaveTextContent('Llegaste al límite de publicaciones por hora');
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByText('1/5 fotos')).toBeInTheDocument();
    expect((screen.getByLabelText('Descripción (opcional)') as HTMLTextAreaElement).value).toBe('Mi texto');
    expect((screen.getByLabelText('Voluntariado') as HTMLSelectElement).value).toBe('proj-1');

    fireEvent.click(publishBtn());
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    // el aviso de error del intento anterior ya no está
    expect(screen.queryByText(/Llegaste al límite/)).not.toBeInTheDocument();
  });

  test('una vez publicado, el botón queda bloqueado hasta que quien lo abrió lo cierre (no se publica dos veces)', async () => {
    const { onCreated } = await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.click(publishBtn());
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    expect(publishBtn()).toBeDisabled();
    fireEvent.click(publishBtn());
    await act(async () => { await Promise.resolve(); });
    expect(api.posts.create).toHaveBeenCalledTimes(1);
  });

  test('un fallo de red al subir muestra un mensaje en español', async () => {
    vi.mocked(api.posts.create).mockRejectedValue(new TypeError('Failed to fetch'));
    await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.click(publishBtn());
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('Failed to fetch');
    expect(alert.textContent).toMatch(/conexión/i);
  });
});

describe('<PostComposer /> — cerrar', () => {
  test('sin nada cargado, "Cancelar", "Cerrar" y Escape cierran sin preguntar', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { onClose } = await renderOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(confirm).not.toHaveBeenCalled();
  });

  test('con fotos cargadas pregunta antes de descartar; si dice que no, no cierra', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onClose } = await renderOpen();
    addPhotos(photo('a.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('con texto escrito también pregunta, y si confirma cierra', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onClose } = await renderOpen();
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: 'algo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('otras teclas no cierran', async () => {
    const { onClose } = await renderOpen();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('<PostComposer /> — modal accesible (REVISION F12, <Modal> común)', () => {
  test('al abrir el foco entra; Escape funciona aunque el foco esté afuera', async () => {
    const { onClose } = await renderOpen();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clic en el fondo NO cierra (se perderían las fotos)', async () => {
    const { onClose } = await renderOpen();
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  test('mientras publica, Escape no cierra', async () => {
    const d = deferred<{ post: Post }>();
    vi.mocked(api.posts.create).mockReturnValue(d.promise);
    const { onClose } = await renderOpen();
    choose('proj-1');
    addPhotos(photo('a.jpg'));
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    await screen.findByRole('button', { name: /Publicando|Preparando/ });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { d.resolve({ post: makePost({ id: 'x' }) }); });
  });
});
