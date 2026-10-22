// src/app/components/PostCard.test.tsx
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PostCard } from './PostCard';
import { makePost, makePhoto, deferred } from '../../test/postFixtures';
import type { User } from '../../lib/api';

// useAuth se reemplaza entero: el componente solo necesita saber quién mira y poder abrir el modal de login.
vi.mock('../../lib/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    api: { ...actual.api, posts: { ...actual.api.posts, like: vi.fn(), unlike: vi.fn(), remove: vi.fn() } },
  };
});

import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';

const openAuthModal = vi.fn();
const volunteer: User = { id: 'user-9', name: 'Juan Pérez', email: 'j@x.com', role: 'volunteer' };

function asViewer(user: User | null) {
  vi.mocked(useAuth).mockReturnValue({ user, openAuthModal } as unknown as ReturnType<typeof useAuth>);
}

/** "Borrar publicación" vive en el menú "···" (Más opciones). */
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
const deleteButton = () => { if (!screen.queryByRole('menuitem', { name: 'Borrar publicación' })) openMenu(); return screen.getByRole('menuitem', { name: 'Borrar publicación' }); };

function renderCard(post = makePost(), onDeleted = vi.fn()) {
  render(
    <MemoryRouter>
      <PostCard post={post} onDeleted={onDeleted} />
    </MemoryRouter>,
  );
  return { onDeleted };
}

beforeEach(() => {
  openAuthModal.mockReset();
  vi.mocked(api.posts.like).mockReset();
  vi.mocked(api.posts.unlike).mockReset();
  vi.mocked(api.posts.remove).mockReset();
  asViewer(volunteer);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('<PostCard /> — contenido', () => {
  test('muestra autor, proyecto, hace cuánto se publicó y las fotos', () => {
    renderCard();
    expect(screen.getAllByText('María García')[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reforestación Urbana' })).toHaveAttribute('href', '/project/proj-1');
    expect(screen.getByText('5 min')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Reforestación Urbana' })).toHaveAttribute('src', 'https://img.test/p1.jpg');
  });

  test('con varias fotos usa el carrusel', () => {
    renderCard(makePost({ photos: [makePhoto(1), makePhoto(2)] }));
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  test('si el autor es voluntario, su nombre enlaza a su perfil público con el id de USUARIO', () => {
    renderCard(makePost({ author: { id: 'user-1', name: 'María García', avatar: null, role: 'volunteer' } }));
    expect(screen.getByRole('link', { name: 'María García' })).toHaveAttribute('href', '/volunteer/user-1');
  });

  test('si el autor es una ONG, el nombre NO es un enlace a un perfil de voluntario', () => {
    renderCard(makePost({ author: { id: 'user-ngo', name: 'Fundación Verde', avatar: null, role: 'ngo' } }));
    expect(screen.getAllByText('Fundación Verde')[0]).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => h?.startsWith('/volunteer/'))).toBe(false);
    expect(hrefs.some((h) => h?.includes('user-ngo'))).toBe(false);
    // Rediseño: no hay insignia "ONG"; una organización se reconoce por el avatar cuadrado (radio 28 %).
    expect(screen.getByText('FV')).toHaveStyle({ borderRadius: '28%' });
  });

  test('un voluntario no muestra la insignia "ONG"', () => {
    renderCard();
    expect(screen.queryByText('ONG')).not.toBeInTheDocument();
  });

  test('con avatar usa la imagen; sin avatar, la inicial del nombre', () => {
    renderCard(makePost({ author: { id: 'u', name: 'María García', avatar: 'https://img.test/a.png', role: 'volunteer' } }));
    expect(document.querySelector('img[src="https://img.test/a.png"]')).not.toBeNull();
  });

  test('sin avatar muestra la inicial', () => {
    renderCard(makePost({ author: { id: 'u', name: 'zulema', avatar: null, role: 'volunteer' } }));
    expect(screen.getByText('ZU')).toBeInTheDocument();
  });

  test('sin texto (caption null) no muestra párrafo de texto', () => {
    renderCard(makePost({ caption: null }));
    expect(screen.queryByText('Un día increíble')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  test('un texto corto se muestra completo y sin "Ver más"', () => {
    renderCard();
    expect(screen.getByText('Un día increíble')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  test('un texto largo se recorta con "Ver más", se expande y se puede volver a recortar', () => {
    const long = 'Plantamos muchísimos árboles nativos en el parque. '.repeat(10).trim();
    renderCard(makePost({ caption: long }));
    expect(screen.queryByText(long)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(screen.getByText(long)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(screen.queryByText(long)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver más' })).toBeInTheDocument();
  });

  test('el texto conserva los saltos de línea (whitespace-pre-line)', () => {
    renderCard(makePost({ caption: 'línea 1\nlínea 2' }));
    expect(screen.getByText(/línea 1/).className).toContain('whitespace-pre-line');
  });

  test('el texto del usuario se muestra como texto, nunca como HTML', () => {
    renderCard(makePost({ caption: '<img src=x onerror=alert(1)> hola' }));
    expect(screen.getByText('<img src=x onerror=alert(1)> hola')).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });
});

describe('<PostCard /> — me gusta', () => {
  test('muestra la cantidad de me gusta; con 0 no muestra el contador', () => {
    const { unmount } = render(<MemoryRouter><PostCard post={makePost({ likes_count: 3 })} /></MemoryRouter>);
    expect(screen.getByLabelText('3 me gusta')).toBeInTheDocument();
    unmount();
    render(<MemoryRouter><PostCard post={makePost({ likes_count: 0 })} /></MemoryRouter>);
    expect(screen.queryByLabelText(/^\d+ me gusta$/)).not.toBeInTheDocument();
  });

  test('con 1 me gusta dice "1 me gusta"', () => {
    renderCard(makePost({ likes_count: 1 }));
    expect(screen.getByLabelText('1 me gusta')).toBeInTheDocument();
  });

  test('refleja liked_by_me: botón "Quitar me gusta" presionado', () => {
    renderCard(makePost({ liked_by_me: true }));
    expect(screen.getByRole('button', { name: 'Quitar me gusta' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('el like es OPTIMISTA: la UI cambia al instante y después se ajusta al número del servidor', async () => {
    const d = deferred<{ liked: boolean; likes_count: number }>();
    vi.mocked(api.posts.like).mockReturnValue(d.promise);
    renderCard(makePost({ likes_count: 3 }));

    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));

    // el servidor todavía no respondió
    expect(api.posts.like).toHaveBeenCalledWith('post-1');
    expect(screen.getByLabelText('4 me gusta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar me gusta' })).toHaveAttribute('aria-pressed', 'true');

    // otro usuario también dio like mientras tanto: manda el número del servidor
    await act(async () => { d.resolve({ liked: true, likes_count: 6 }); });
    expect(screen.getByLabelText('6 me gusta')).toBeInTheDocument();
  });

  test('quitar el me gusta llama a unlike y resta', async () => {
    vi.mocked(api.posts.unlike).mockResolvedValue({ liked: false, likes_count: 2 });
    renderCard(makePost({ likes_count: 3, liked_by_me: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Quitar me gusta' }));
    expect(screen.getByLabelText('2 me gusta')).toBeInTheDocument();
    await waitFor(() => expect(api.posts.unlike).toHaveBeenCalledWith('post-1'));
    expect(api.posts.like).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Me gusta' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('si falla, se REVIERTE al estado anterior y se avisa', async () => {
    const d = deferred<{ liked: boolean; likes_count: number }>();
    vi.mocked(api.posts.like).mockReturnValue(d.promise);
    renderCard(makePost({ likes_count: 3, liked_by_me: false }));

    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    expect(screen.getByLabelText('4 me gusta')).toBeInTheDocument();

    await act(async () => { d.reject(new Error('Error del servidor')); });

    expect(screen.getByLabelText('3 me gusta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Me gusta' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos registrar tu me gusta');
  });

  test('si falla al QUITAR el me gusta, vuelve a quedar con me gusta', async () => {
    vi.mocked(api.posts.unlike).mockRejectedValue(new Error('x'));
    renderCard(makePost({ likes_count: 3, liked_by_me: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar me gusta' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText('3 me gusta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar me gusta' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('el aviso de error se va cuando el siguiente intento sale bien', async () => {
    vi.mocked(api.posts.like).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ liked: true, likes_count: 4 });
    renderCard(makePost({ likes_count: 3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByLabelText('4 me gusta')).toBeInTheDocument();
  });

  test('un doble clic mientras el pedido está en vuelo NO manda un segundo pedido', async () => {
    const d = deferred<{ liked: boolean; likes_count: number }>();
    vi.mocked(api.posts.like).mockReturnValue(d.promise);
    renderCard(makePost({ likes_count: 3 }));

    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar me gusta' }));   // el segundo clic, ya con la UI cambiada

    expect(api.posts.like).toHaveBeenCalledTimes(1);
    expect(api.posts.unlike).not.toHaveBeenCalled();
    await act(async () => { d.resolve({ liked: true, likes_count: 4 }); });
    expect(screen.getByLabelText('4 me gusta')).toBeInTheDocument();
  });

  test('terminado el pedido se puede volver a tocar', async () => {
    vi.mocked(api.posts.like).mockResolvedValue({ liked: true, likes_count: 4 });
    vi.mocked(api.posts.unlike).mockResolvedValue({ liked: false, likes_count: 3 });
    renderCard(makePost({ likes_count: 3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    await waitFor(() => expect(screen.getByLabelText('4 me gusta')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Quitar me gusta' }));
    await waitFor(() => expect(api.posts.unlike).toHaveBeenCalledTimes(1));
  });

  test('sin sesión: abre el modal de ingreso y NO llama a la API ni cambia nada', () => {
    asViewer(null);
    renderCard(makePost({ likes_count: 3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    expect(openAuthModal).toHaveBeenCalledTimes(1);
    expect(openAuthModal.mock.calls[0][0]).toMatch(/me gusta/i);
    expect(api.posts.like).not.toHaveBeenCalled();
    expect(screen.getByLabelText('3 me gusta')).toBeInTheDocument();
  });

  test('una empresa también puede dar me gusta (cualquier rol)', async () => {
    asViewer({ id: 'c1', name: 'Empresa', email: 'e@x.com', role: 'company' });
    vi.mocked(api.posts.like).mockResolvedValue({ liked: true, likes_count: 4 });
    renderCard(makePost({ likes_count: 3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    await waitFor(() => expect(api.posts.like).toHaveBeenCalledWith('post-1'));
  });
});

describe('<PostCard /> — borrar (según can_delete del servidor)', () => {
  test('can_delete=false: no hay botón de borrar', () => {
    renderCard(makePost({ can_delete: false }));
    expect(screen.queryByRole('button', { name: 'Más opciones' })).not.toBeInTheDocument();
  });

  test('can_delete=true: aparece el botón, aunque el autor sea otro (es la ONG dueña moderando)', () => {
    asViewer({ id: 'user-ngo-dueña', name: 'ONG Dueña', email: 'o@x.com', role: 'ngo' });
    renderCard(makePost({ can_delete: true, author: { id: 'user-1', name: 'María García', avatar: null, role: 'volunteer' } }));
    expect(deleteButton()).toBeInTheDocument();
  });

  test('can_delete=false NO muestra el botón ni siquiera si el viewer coincide con el autor (manda el servidor)', () => {
    asViewer({ id: 'user-1', name: 'María García', email: 'm@x.com', role: 'volunteer' });
    renderCard(makePost({ can_delete: false }));
    expect(screen.queryByRole('button', { name: 'Más opciones' })).not.toBeInTheDocument();
  });

  test('si el usuario cancela la confirmación no se borra nada', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onDeleted } = renderCard(makePost({ can_delete: true }));
    fireEvent.click(deleteButton());
    expect(api.posts.remove).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  test('si confirma, llama a la API y avisa con el id de la publicación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.posts.remove).mockResolvedValue({ message: 'ok' });
    const { onDeleted } = renderCard(makePost({ id: 'post-77', can_delete: true }));
    fireEvent.click(deleteButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('post-77'));
    expect(api.posts.remove).toHaveBeenCalledWith('post-77');
  });

  test('la confirmación del propio autor habla de "tu publicación"', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    asViewer({ id: 'user-1', name: 'María García', email: 'm@x.com', role: 'volunteer' });
    renderCard(makePost({ can_delete: true }));
    fireEvent.click(deleteButton());
    expect(confirm.mock.calls[0][0]).toMatch(/tu publicación/);
  });

  test('la confirmación de la ONG que modera nombra al autor de la publicación', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    asViewer({ id: 'user-ngo', name: 'ONG Dueña', email: 'o@x.com', role: 'ngo' });
    renderCard(makePost({ can_delete: true }));
    fireEvent.click(deleteButton());
    expect(confirm.mock.calls[0][0]).toMatch(/de María García/);
    expect(confirm.mock.calls[0][0]).not.toMatch(/tu publicación/);
  });

  test('si el borrado falla muestra el mensaje del servidor, no avisa que se borró y se puede reintentar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.posts.remove).mockRejectedValue(new Error('No tenés permiso para borrar esta publicación'));
    const { onDeleted } = renderCard(makePost({ can_delete: true }));
    fireEvent.click(deleteButton());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para borrar esta publicación'));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleteButton()).not.toBeDisabled();
  });

  test('un fallo de red al borrar muestra un mensaje en español (no "Failed to fetch")', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.posts.remove).mockRejectedValue(new TypeError('Failed to fetch'));
    renderCard(makePost({ can_delete: true }));
    fireEvent.click(deleteButton());
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).not.toHaveTextContent('Failed to fetch');
  });

  test('mientras se borra, el botón queda deshabilitado (no se manda dos veces)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const d = deferred<{ message: string }>();
    vi.mocked(api.posts.remove).mockReturnValue(d.promise);
    renderCard(makePost({ can_delete: true }));
    fireEvent.click(deleteButton());
    // La confirmación es asíncrona (diálogo propio): se espera a que arranque el borrado.
    await waitFor(() => expect(deleteButton()).toBeDisabled());
    fireEvent.click(deleteButton());
    expect(api.posts.remove).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve({ message: 'ok' }); });
  });
});
