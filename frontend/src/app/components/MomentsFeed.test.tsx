// src/app/components/MomentsFeed.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MomentsFeed } from './MomentsFeed';
import { makePost, deferred } from '../../test/postFixtures';
import type { Post, PostsPage, User } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, posts: { ...actual.api.posts, list: vi.fn() } } };
});
// PostCard y PostComposer tienen sus propios tests: acá se reemplazan por dobles mínimos para probar SOLO
// lo que hace el feed (carga, paginación, borrado, alta). `React` se importa dentro de la fábrica porque vi.mock
// se eleva por encima de los imports del archivo.
vi.mock('./PostCard', async () => {
  const React = await import('react');
  return {
    PostCard: ({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) =>
      React.createElement('div', { 'data-testid': 'post' },
        React.createElement('span', null, `post:${post.id}`),
        React.createElement('button', { onClick: () => onDeleted?.(post.id) }, `borrar-${post.id}`),
        // avisa de un id que ya no está en la lista (por ejemplo, un aviso repetido)
        React.createElement('button', { onClick: () => onDeleted?.('id-que-no-esta') }, `borrar-fantasma-${post.id}`)),
  };
});
vi.mock('./PostComposer', async () => {
  const React = await import('react');
  return {
    PostComposer: ({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Post) => void }) =>
      React.createElement('div', { role: 'dialog' },
        React.createElement('button', { onClick: onClose }, 'cerrar-compositor'),
        React.createElement('button', {
          onClick: () => onCreated({
            id: 'nuevo', caption: null, created_at: new Date().toISOString(),
            author: { id: 'u1', name: 'María', avatar: null, role: 'volunteer' },
            project: { id: 'proj-1', title: 'P1' }, photos: [], likes_count: 0, liked_by_me: false, can_delete: true,
          }),
        }, 'publicar-doble'),
        React.createElement('button', {
          onClick: () => onCreated({
            id: 'nuevo-otro', caption: null, created_at: new Date().toISOString(),
            author: { id: 'u1', name: 'María', avatar: null, role: 'volunteer' },
            project: { id: 'proj-OTRO', title: 'P-otro' }, photos: [], likes_count: 0, liked_by_me: false, can_delete: true,
          }),
        }, 'publicar-otro-proyecto')),
  };
});

import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';

const list = () => vi.mocked(api.posts.list);
const volunteer: User = { id: 'u1', name: 'María', email: 'm@x.com', role: 'volunteer' };
const ngo: User = { id: 'u2', name: 'ONG', email: 'o@x.com', role: 'ngo' };
const company: User = { id: 'u3', name: 'Empresa', email: 'e@x.com', role: 'company' };
const asViewer = (user: User | null) =>
  vi.mocked(useAuth).mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);

const page = (ids: string[], has_more = false): PostsPage => ({ posts: ids.map((id) => makePost({ id })), has_more });
const shown = () => screen.queryAllByTestId('post').map((n) => n.textContent?.replace(/borrar-.*/, '').replace('post:', ''));

beforeEach(() => {
  list().mockReset();
  asViewer(volunteer);
});

describe('<MomentsFeed /> — carga inicial', () => {
  test('pide la primera página (limit 12, offset 0) y muestra las publicaciones en orden', async () => {
    list().mockResolvedValue(page(['a', 'b', 'c']));
    render(<MomentsFeed />);
    await waitFor(() => expect(shown()).toEqual(['a', 'b', 'c']));
    expect(list()).toHaveBeenCalledTimes(1);
    expect(list()).toHaveBeenCalledWith({ limit: 12, offset: 0 });
  });

  test('mientras carga muestra un estado de carga accesible', async () => {
    const d = deferred<PostsPage>();
    list().mockReturnValue(d.promise);
    render(<MomentsFeed />);
    expect(screen.getByRole('status', { name: 'Cargando momentos' })).toBeInTheDocument();
    await act(async () => { d.resolve(page(['a'])); });
    expect(screen.queryByRole('status', { name: 'Cargando momentos' })).not.toBeInTheDocument();
  });

  test('pasa los filtros (proyecto / autor) al pedido', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed filters={{ project_id: 'proj-9', user_id: 'user-3' }} />);
    await waitFor(() => expect(list()).toHaveBeenCalled());
    expect(list()).toHaveBeenCalledWith({ project_id: 'proj-9', user_id: 'user-3', limit: 12, offset: 0 });
  });

  test('pasa el filtro por ONG (ngo_id) al pedido, también en "Ver más" (REVISION S2)', async () => {
    list().mockResolvedValueOnce(page(['a'], true)).mockResolvedValueOnce(page(['b']));
    render(<MomentsFeed pageSize={1} filters={{ ngo_id: 'ngo-1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(shown()).toEqual(['a', 'b']));
    expect(list()).toHaveBeenNthCalledWith(1, { ngo_id: 'ngo-1', limit: 1, offset: 0 });
    expect(list()).toHaveBeenNthCalledWith(2, { ngo_id: 'ngo-1', limit: 1, offset: 1 });
  });

  test('respeta pageSize', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed pageSize={5} />);
    await waitFor(() => expect(list()).toHaveBeenCalledWith({ limit: 5, offset: 0 }));
  });

  test('sin publicaciones muestra el estado vacío', async () => {
    list().mockResolvedValue(page([]));
    render(<MomentsFeed />);
    expect(await screen.findByText('Todavía no hay momentos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  test('si falla la carga muestra un error (no el texto técnico) y "Reintentar" vuelve a pedir', async () => {
    list().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(page(['a']));
    render(<MomentsFeed />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar los momentos');
    expect(alert).not.toHaveTextContent('Failed to fetch');
    expect(screen.queryByText('Todavía no hay momentos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(shown()).toEqual(['a']));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(list()).toHaveBeenCalledTimes(2);
  });
});

describe('<MomentsFeed /> — "Ver más"', () => {
  test('solo aparece si el servidor dice que hay más', async () => {
    list().mockResolvedValue(page(['a'], false));
    const { unmount } = render(<MomentsFeed />);
    await screen.findByText('post:a');
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
    unmount();

    list().mockResolvedValue(page(['a'], true));
    render(<MomentsFeed />);
    expect(await screen.findByRole('button', { name: 'Ver más' })).toBeInTheDocument();
  });

  test('pide la página siguiente con offset = lo recibido, la agrega al final y oculta el botón al terminar', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['c', 'd'], false));
    render(<MomentsFeed pageSize={2} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    await waitFor(() => expect(shown()).toEqual(['a', 'b', 'c', 'd']));
    expect(list()).toHaveBeenNthCalledWith(2, { limit: 2, offset: 2 });
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  test('DEDUPLICA por id: una publicación que ya estaba no se muestra dos veces', async () => {
    // entró una publicación nueva mientras se paginaba: la última de la página 1 reaparece en la 2
    list().mockResolvedValueOnce(page(['a', 'b', 'c'], true)).mockResolvedValueOnce(page(['c', 'd', 'e'], false));
    render(<MomentsFeed pageSize={3} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(shown()).toEqual(['a', 'b', 'c', 'd', 'e']));
  });

  test('el offset cuenta lo que DEVOLVIÓ el servidor (aunque haya repetidas), no lo que se muestra', async () => {
    list()
      .mockResolvedValueOnce(page(['a', 'b', 'c'], true))
      .mockResolvedValueOnce(page(['c', 'd', 'e'], true))    // 'c' repetida
      .mockResolvedValueOnce(page(['f'], false));
    render(<MomentsFeed pageSize={3} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(shown()).toHaveLength(5));
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(shown()).toHaveLength(6));
    expect(list()).toHaveBeenNthCalledWith(3, { limit: 3, offset: 6 });   // 3 + 3, y no 3 + 2
  });

  test('mientras carga la siguiente página el botón queda deshabilitado y un segundo clic no repite el pedido', async () => {
    const d = deferred<PostsPage>();
    list().mockResolvedValueOnce(page(['a'], true)).mockReturnValueOnce(d.promise);
    render(<MomentsFeed pageSize={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    const busy = screen.getByRole('button', { name: 'Cargando…' });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(list()).toHaveBeenCalledTimes(2);

    await act(async () => { d.resolve(page(['b'], false)); });
    expect(shown()).toEqual(['a', 'b']);
  });

  test('dos toques en la MISMA pasada (antes de que React deshabilite el botón) piden una sola página', async () => {
    const d = deferred<PostsPage>();
    list().mockResolvedValueOnce(page(['a'], true)).mockReturnValueOnce(d.promise);
    render(<MomentsFeed pageSize={1} />);
    const btn = await screen.findByRole('button', { name: 'Ver más' });
    act(() => { btn.click(); btn.click(); });
    expect(list()).toHaveBeenCalledTimes(2);     // la carga inicial + UNA página más
    await act(async () => { d.resolve(page(['b'], false)); });
    expect(shown()).toEqual(['a', 'b']);
  });

  test('si falla la siguiente página, conserva lo que ya se vio, avisa y permite reintentar con el MISMO offset', async () => {
    list()
      .mockResolvedValueOnce(page(['a', 'b'], true))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page(['c'], false));
    render(<MomentsFeed pageSize={2} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar más momentos');
    expect(shown()).toEqual(['a', 'b']);

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(shown()).toEqual(['a', 'b', 'c']));
    expect(list()).toHaveBeenNthCalledWith(2, { limit: 2, offset: 2 });
    expect(list()).toHaveBeenNthCalledWith(3, { limit: 2, offset: 2 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('los filtros también viajan en "Ver más"', async () => {
    list().mockResolvedValueOnce(page(['a'], true)).mockResolvedValueOnce(page(['b'], false));
    render(<MomentsFeed pageSize={1} filters={{ project_id: 'proj-9' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { project_id: 'proj-9', limit: 1, offset: 1 });
  });
});

describe('<MomentsFeed /> — borrar', () => {
  test('al borrarse una publicación desaparece de la lista', async () => {
    list().mockResolvedValue(page(['a', 'b', 'c']));
    render(<MomentsFeed />);
    await screen.findByText('post:b');
    fireEvent.click(screen.getByRole('button', { name: 'borrar-b' }));
    expect(shown()).toEqual(['a', 'c']);
  });

  test('borrar una publicación corre el offset de "Ver más" (todo lo siguiente se corrió un lugar)', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['c'], false));
    render(<MomentsFeed pageSize={2} />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'borrar-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { limit: 2, offset: 1 });
  });

  test('un aviso de borrado de una publicación que ya no está NO corre el offset', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['c'], false));
    render(<MomentsFeed pageSize={2} />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'borrar-fantasma-a' }));
    expect(shown()).toEqual(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { limit: 2, offset: 2 });
  });

  test('si se borra la última publicación aparece el estado vacío', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'borrar-a' }));
    expect(await screen.findByText('Todavía no hay momentos')).toBeInTheDocument();
  });
});

describe('<MomentsFeed /> — publicar', () => {
  test.each([
    ['voluntario', true, volunteer],
    ['ONG', true, ngo],
    ['empresa', false, company],
    ['visitante', false, null],
  ])('el botón "Compartir un momento" para %s — visible: %s', async (_name, visible, user) => {
    asViewer(user);
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed />);
    await screen.findByText('post:a');
    expect(!!screen.queryByRole('button', { name: 'Compartir un momento' })).toBe(visible);
  });

  test('con showComposer={false} no aparece aunque sea voluntario', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed showComposer={false} />);
    await screen.findByText('post:a');
    expect(screen.queryByRole('button', { name: 'Compartir un momento' })).not.toBeInTheDocument();
  });

  test('el botón abre el compositor y se cierra con su onClose', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed />);
    await screen.findByText('post:a');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-compositor' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('una publicación nueva se agrega ARRIBA de todo y el compositor se cierra', async () => {
    list().mockResolvedValue(page(['a', 'b']));
    render(<MomentsFeed />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    fireEvent.click(screen.getByRole('button', { name: 'publicar-doble' }));
    expect(shown()).toEqual(['nuevo', 'a', 'b']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('una publicación nueva corre el offset de "Ver más" en uno', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['c'], false));
    render(<MomentsFeed pageSize={2} />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    fireEvent.click(screen.getByRole('button', { name: 'publicar-doble' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { limit: 2, offset: 3 });
  });

  test('desde el estado vacío también se puede publicar, y la primera publicación aparece', async () => {
    list().mockResolvedValue(page([]));
    render(<MomentsFeed />);
    await screen.findByText('Todavía no hay momentos');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    fireEvent.click(screen.getByRole('button', { name: 'publicar-doble' }));
    expect(shown()).toEqual(['nuevo']);
    expect(screen.queryByText('Todavía no hay momentos')).not.toBeInTheDocument();
  });

  test('si el feed está filtrado por otro proyecto, la publicación nueva NO se agrega (no corresponde a esta vista)', async () => {
    list().mockResolvedValueOnce(page(['a'], true)).mockResolvedValueOnce(page(['b'], false));
    render(<MomentsFeed pageSize={1} filters={{ project_id: 'proj-1' }} />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    fireEvent.click(screen.getByRole('button', { name: 'publicar-otro-proyecto' }));
    expect(shown()).toEqual(['a']);
    // y el offset no se corrió
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { project_id: 'proj-1', limit: 1, offset: 1 });
  });

  test('si el feed está filtrado por ese mismo proyecto, la nueva sí se agrega', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed filters={{ project_id: 'proj-1' }} />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    fireEvent.click(screen.getByRole('button', { name: 'publicar-doble' }));
    expect(shown()).toEqual(['nuevo', 'a']);
  });

  test('si el feed está filtrado por otro autor, la nueva no se agrega', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsFeed filters={{ user_id: 'otra-persona' }} />);
    await screen.findByText('post:a');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir un momento' }));
    fireEvent.click(screen.getByRole('button', { name: 'publicar-doble' }));
    expect(shown()).toEqual(['a']);
  });
});

describe('<MomentsFeed /> — cambio de filtros', () => {
  test('al cambiar el filtro vuelve a cargar desde el principio', async () => {
    list().mockResolvedValueOnce(page(['a'], true)).mockResolvedValueOnce(page(['x']));
    const { rerender } = render(<MomentsFeed filters={{ project_id: 'p1' }} />);
    await screen.findByText('post:a');
    rerender(<MomentsFeed filters={{ project_id: 'p2' }} />);
    await waitFor(() => expect(shown()).toEqual(['x']));
    expect(list()).toHaveBeenNthCalledWith(2, { project_id: 'p2', limit: 12, offset: 0 });
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  test('una respuesta vieja que llega tarde NO pisa la del filtro actual', async () => {
    const slow = deferred<PostsPage>();
    list().mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page(['nuevo-filtro']));
    const { rerender } = render(<MomentsFeed filters={{ project_id: 'p1' }} />);
    rerender(<MomentsFeed filters={{ project_id: 'p2' }} />);
    await screen.findByText('post:nuevo-filtro');
    await act(async () => { slow.resolve(page(['viejo-filtro'])); });
    expect(shown()).toEqual(['nuevo-filtro']);
  });

  test('una página de "Ver más" del filtro ANTERIOR que llega tarde no se agrega al filtro nuevo', async () => {
    const slowMore = deferred<PostsPage>();
    list()
      .mockResolvedValueOnce(page(['a'], true))        // filtro p1, página 1
      .mockReturnValueOnce(slowMore.promise)           // filtro p1, "Ver más" (lenta)
      .mockResolvedValueOnce(page(['x'], false));      // filtro p2, página 1
    const { rerender } = render(<MomentsFeed pageSize={1} filters={{ project_id: 'p1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    rerender(<MomentsFeed pageSize={1} filters={{ project_id: 'p2' }} />);
    await waitFor(() => expect(shown()).toEqual(['x']));

    await act(async () => { slowMore.resolve(page(['viejo'], true)); });
    expect(shown()).toEqual(['x']);
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();   // y no cambia has_more
  });

  test('al cambiar la ONG del filtro vuelve a cargar con la nueva', async () => {
    list().mockResolvedValueOnce(page(['a'])).mockResolvedValueOnce(page(['x']));
    const { rerender } = render(<MomentsFeed filters={{ ngo_id: 'ngo-1' }} />);
    await screen.findByText('post:a');
    rerender(<MomentsFeed filters={{ ngo_id: 'ngo-2' }} />);
    await waitFor(() => expect(shown()).toEqual(['x']));
    expect(list()).toHaveBeenNthCalledWith(2, { ngo_id: 'ngo-2', limit: 12, offset: 0 });
  });

  test('re-renderizar con los mismos filtros (otro objeto) NO vuelve a pedir', async () => {
    list().mockResolvedValue(page(['a']));
    const { rerender } = render(<MomentsFeed filters={{ project_id: 'p1' }} />);
    await screen.findByText('post:a');
    rerender(<MomentsFeed filters={{ project_id: 'p1' }} />);
    await act(async () => { await Promise.resolve(); });
    expect(list()).toHaveBeenCalledTimes(1);
  });
});

describe('<MomentsFeed /> — cambio de usuario', () => {
  test('si cambia quien mira (inicia o cierra sesión) RECARGA: liked_by_me y can_delete los calcula el servidor según el usuario', async () => {
    list().mockResolvedValue(page(['a']));
    asViewer(null);
    const { rerender } = render(<MomentsFeed />);
    await screen.findByText('post:a');
    expect(list()).toHaveBeenCalledTimes(1);

    asViewer(volunteer);                       // el visitante inicia sesión desde el modal
    rerender(<MomentsFeed />);
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { limit: 12, offset: 0 });
  });

  test('el mismo usuario (aunque sea otro objeto) NO recarga', async () => {
    list().mockResolvedValue(page(['a']));
    asViewer(volunteer);
    const { rerender } = render(<MomentsFeed />);
    await screen.findByText('post:a');
    asViewer({ ...volunteer, name: 'María (editó su nombre)' });
    rerender(<MomentsFeed />);
    await act(async () => { await Promise.resolve(); });
    expect(list()).toHaveBeenCalledTimes(1);
  });
});
