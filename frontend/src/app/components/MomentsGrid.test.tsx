// src/app/components/MomentsGrid.test.tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MomentsGrid } from './MomentsGrid';
import { makePost, makePhoto, deferred } from '../../test/postFixtures';
import type { Post, PostsPage } from '../../lib/api';

vi.mock('../../lib/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, posts: { ...actual.api.posts, list: vi.fn() } } };
});
vi.mock('./PostCard', async () => {
  const React = await import('react');
  return {
    PostCard: ({ post, onDeleted }: { post: Post; onDeleted?: (id: string) => void }) =>
      React.createElement('div', { 'data-testid': 'card' }, `card:${post.id}`,
        React.createElement('button', { onClick: () => onDeleted?.(post.id) }, 'borrar-desde-modal'),
        React.createElement('button', { onClick: () => onDeleted?.('id-que-no-esta') }, 'borrar-fantasma')),
  };
});
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';

const list = () => vi.mocked(api.posts.list);
const page = (ids: string[], has_more = false): PostsPage => ({ posts: ids.map((id) => makePost({ id })), has_more });
const thumbs = () => screen.queryAllByRole('button', { name: /^Ver momento/ });

beforeEach(() => {
  list().mockReset();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } } as unknown as ReturnType<typeof useAuth>);
});

describe('<MomentsGrid />', () => {
  test('pide la primera página con los filtros y muestra una miniatura por publicación', async () => {
    list().mockResolvedValue(page(['a', 'b']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    await waitFor(() => expect(thumbs()).toHaveLength(2));
    expect(list()).toHaveBeenCalledWith({ project_id: 'p1', limit: 9, offset: 0 });
    expect(document.querySelector('img[src="https://img.test/t1.jpg"]')).not.toBeNull();   // usa thumb_url
  });

  test('una publicación con varias fotos lo indica', async () => {
    list().mockResolvedValue({ posts: [makePost({ id: 'a', photos: [makePhoto(1), makePhoto(2), makePhoto(3)] })], has_more: false });
    render(<MomentsGrid filters={{ user_id: 'u9' }} />);
    expect(await screen.findByText('3 fotos')).toBeInTheDocument();
  });

  test('sin publicaciones muestra un texto vacío; con error, un aviso con reintento', async () => {
    list().mockResolvedValueOnce(page([])).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(page(['a']));
    const { unmount } = render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    expect(await screen.findByText('Todavía no hay momentos.')).toBeInTheDocument();
    unmount();
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los momentos');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(thumbs()).toHaveLength(1));
  });

  test('tocar una miniatura abre la publicación en un modal y se cierra', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Ver momento/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('card:a')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('Escape cierra el modal', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Ver momento/ }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('borrar desde el modal lo cierra y saca la miniatura', async () => {
    list().mockResolvedValue(page(['a', 'b']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    fireEvent.click((await screen.findAllByRole('button', { name: /^Ver momento/ }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'borrar-desde-modal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(thumbs()).toHaveLength(1);
  });

  test('"Ver más" pide con offset = lo recibido, deduplica y se oculta al terminar', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['b', 'c'], false));
    render(<MomentsGrid filters={{ project_id: 'p1' }} pageSize={2} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(thumbs()).toHaveLength(3));
    expect(list()).toHaveBeenNthCalledWith(2, { project_id: 'p1', limit: 2, offset: 2 });
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  test('recarga si cambia el id del usuario o el filtro', async () => {
    list().mockResolvedValue(page(['a']));
    const { rerender } = render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    await screen.findAllByRole('button', { name: /^Ver momento/ });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u2' } } as unknown as ReturnType<typeof useAuth>);
    rerender(<MomentsGrid filters={{ project_id: 'p1' }} />);
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    rerender(<MomentsGrid filters={{ project_id: 'p2' }} />);
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(3));
  });

  test('el filtro por autor (user_id) viaja en el pedido y no se mezcla con el de proyecto', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ user_id: 'u9' }} />);
    await screen.findAllByRole('button', { name: /^Ver momento/ });
    expect(list()).toHaveBeenCalledWith({ user_id: 'u9', limit: 9, offset: 0 });
  });

  test('una publicación de UNA sola foto no muestra el indicador de cantidad', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    await screen.findAllByRole('button', { name: /^Ver momento/ });
    expect(screen.queryByText(/fotos$/)).not.toBeInTheDocument();
  });

  test('el offset de cada página suma lo que devolvió el servidor (también en la tercera)', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['b', 'c'], true)).mockResolvedValueOnce(page(['d'], false));
    render(<MomentsGrid filters={{ project_id: 'p1' }} pageSize={2} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(thumbs()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(thumbs()).toHaveLength(4));
    expect(list()).toHaveBeenNthCalledWith(3, { project_id: 'p1', limit: 2, offset: 4 });
  });

  test('dos toques en "Ver más" en la misma pasada piden una sola página', async () => {
    const d = deferred<PostsPage>();
    list().mockResolvedValueOnce(page(['a'], true)).mockReturnValueOnce(d.promise);
    render(<MomentsGrid filters={{ project_id: 'p1' }} pageSize={1} />);
    const btn = await screen.findByRole('button', { name: 'Ver más' });
    act(() => { btn.click(); btn.click(); });
    expect(list()).toHaveBeenCalledTimes(2);
    await act(async () => { d.resolve(page(['b'], false)); });
    expect(thumbs()).toHaveLength(2);
  });

  test('si falla "Ver más" se conserva la grilla, se avisa, y reintentar limpia el aviso con el MISMO offset', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(page(['c'], false));
    render(<MomentsGrid filters={{ project_id: 'p1' }} pageSize={2} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar más momentos');
    expect(thumbs()).toHaveLength(2);
    expect(screen.queryByText('No pudimos cargar los momentos.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(thumbs()).toHaveLength(3));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(list()).toHaveBeenNthCalledWith(3, { project_id: 'p1', limit: 2, offset: 2 });
  });

  test('borrar desde el modal corre el offset de "Ver más"; un aviso de un id que no está, no', async () => {
    list().mockResolvedValueOnce(page(['a', 'b'], true)).mockResolvedValueOnce(page(['c'], false));
    render(<MomentsGrid filters={{ project_id: 'p1' }} pageSize={2} />);
    await waitFor(() => expect(thumbs()).toHaveLength(2));
    fireEvent.click(thumbs()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'borrar-fantasma' }));
    expect(thumbs()).toHaveLength(2);                                   // no desapareció nada
    fireEvent.click(thumbs()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'borrar-desde-modal' }));
    expect(thumbs()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    expect(list()).toHaveBeenNthCalledWith(2, { project_id: 'p1', limit: 2, offset: 1 });
  });

  test('recargar (cambio de usuario) cierra el modal abierto, que mostraba datos del usuario anterior', async () => {
    list().mockResolvedValue(page(['a']));
    const { rerender } = render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    fireEvent.click((await screen.findAllByRole('button', { name: /^Ver momento/ }))[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u2' } } as unknown as ReturnType<typeof useAuth>);
    rerender(<MomentsGrid filters={{ project_id: 'p1' }} />);
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('una respuesta vieja de la carga inicial, que llega tarde, no pisa la del filtro actual', async () => {
    const slow = deferred<PostsPage>();
    list().mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page(['nuevo']));
    const { rerender } = render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    rerender(<MomentsGrid filters={{ project_id: 'p2' }} />);
    await waitFor(() => expect(thumbs()).toHaveLength(1));
    await act(async () => { slow.resolve(page(['v1', 'v2', 'v3'])); });
    expect(thumbs()).toHaveLength(1);
  });

  test('una página de "Ver más" del filtro anterior, que llega tarde, no se agrega al filtro nuevo', async () => {
    const slowMore = deferred<PostsPage>();
    list().mockResolvedValueOnce(page(['a'], true)).mockReturnValueOnce(slowMore.promise).mockResolvedValueOnce(page(['x'], false));
    const { rerender } = render(<MomentsGrid filters={{ project_id: 'p1' }} pageSize={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    rerender(<MomentsGrid filters={{ project_id: 'p2' }} pageSize={1} />);
    await waitFor(() => expect(list()).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(thumbs()).toHaveLength(1));
    await act(async () => { slowMore.resolve(page(['viejo'], true)); });
    expect(thumbs()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });
});

describe('<MomentsGrid /> — modal accesible (REVISION F12, <Modal> común)', () => {
  test('diálogo "Momento": el foco entra, Escape cierra aunque el foco esté afuera y vuelve a la miniatura', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    const thumb = await screen.findByRole('button', { name: /^Ver momento/ });
    thumb.focus();
    fireEvent.click(thumb);
    const d = screen.getByRole('dialog', { name: 'Momento' });
    expect(d.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(thumb);
  });

  test('Tab queda adentro del modal', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Ver momento/ }));
    const last = screen.getByRole('button', { name: 'borrar-fantasma' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });

  test('clic en el fondo no cierra el visor (se mantiene el comportamiento anterior)', async () => {
    list().mockResolvedValue(page(['a']));
    render(<MomentsGrid filters={{ project_id: 'p1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Ver momento/ }));
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(screen.getByRole('dialog', { name: 'Momento' })).toBeInTheDocument();
  });
});
