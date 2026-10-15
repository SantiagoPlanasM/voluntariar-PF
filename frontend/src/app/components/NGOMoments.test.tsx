// src/app/components/NGOMoments.test.tsx
//
// REVISION S2: el panel de la ONG mostraba el feed de TODA la plataforma bajo "Fotos de tus voluntariados".
// Ahora pide el id de su ONG (`api.ngos.me`) y le pasa `ngo_id` a MomentsFeed. Mientras ese id no está, o si
// la carga falla, NO se muestra el feed (sería el general): se muestra carga o un error con "Reintentar".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NGOMoments } from './NGOMoments';
import { deferred } from '../../test/postFixtures';
import type { NGO } from '../../lib/api';

vi.mock('./MomentsFeed', async () => {
  const React = await import('react');
  return {
    MomentsFeed: (props: { showComposer?: boolean; filters?: Record<string, string> }) =>
      React.createElement('div', {
        'data-testid': 'moments-feed',
        'data-show-composer': String(props.showComposer ?? true),
        'data-filters': JSON.stringify(props.filters ?? null),
      }),
  };
});
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, ngos: { ...actual.api.ngos, me: vi.fn() } } };
});

import { api } from '../../lib/api';

type MeResponse = Awaited<ReturnType<typeof api.ngos.me>>;
const me = () => vi.mocked(api.ngos.me);
const ngo: NGO = { id: 'ngo-1', user_id: 'user-ngo-1', name: 'Sustentando', followers: 0 };
const meOk = (): MeResponse => ({ ngo } as unknown as MeResponse);

beforeEach(() => {
  me().mockReset();
  me().mockResolvedValue(meOk());
});

describe('<NGOMoments />', () => {
  test('muestra el título y el feed de momentos (con el botón para publicar, que es de MomentsFeed)', async () => {
    render(<NGOMoments />);
    expect(screen.getByRole('heading', { name: 'Momentos' })).toBeInTheDocument();
    expect(await screen.findByTestId('moments-feed')).toBeInTheDocument();
  });

  test('el feed de la ONG sí permite publicar (el compositor no se oculta)', async () => {
    render(<NGOMoments />);
    expect(await screen.findByTestId('moments-feed')).toHaveAttribute('data-show-composer', 'true');
  });

  test('no muestra las pestañas Proyectos | Momentos (la ONG tiene su propio menú)', async () => {
    render(<NGOMoments />);
    await screen.findByTestId('moments-feed');
    expect(screen.queryByRole('navigation', { name: 'Secciones del feed' })).not.toBeInTheDocument();
  });

  test('pide el feed filtrado por el id de SU ONG (no el feed general de la plataforma)', async () => {
    render(<NGOMoments />);
    const feed = await screen.findByTestId('moments-feed');
    expect(JSON.parse(feed.getAttribute('data-filters') ?? 'null')).toEqual({ ngo_id: 'ngo-1' });
    expect(me()).toHaveBeenCalledTimes(1);
  });

  test('mientras no tiene el id de la ONG no muestra ningún feed (sería el de toda la plataforma)', async () => {
    const d = deferred<MeResponse>();
    me().mockReturnValue(d.promise);
    render(<NGOMoments />);
    expect(screen.getByRole('status', { name: 'Cargando momentos' })).toBeInTheDocument();
    expect(screen.queryByTestId('moments-feed')).not.toBeInTheDocument();
    d.resolve(meOk());
    expect(await screen.findByTestId('moments-feed')).toBeInTheDocument();
  });

  test('si no se puede obtener la ONG: error con "Reintentar", sin feed; reintentar lo carga', async () => {
    me().mockRejectedValueOnce(new Error('Perfil ONG no encontrado'));
    render(<NGOMoments />);
    expect(await screen.findByText('Perfil ONG no encontrado')).toBeInTheDocument();
    expect(screen.queryByTestId('moments-feed')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    const feed = await screen.findByTestId('moments-feed');
    expect(JSON.parse(feed.getAttribute('data-filters') ?? 'null')).toEqual({ ngo_id: 'ngo-1' });
    await waitFor(() => expect(me()).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Perfil ONG no encontrado')).not.toBeInTheDocument();
  });

  test('al reintentar, mientras carga, se va el error y vuelve el indicador de carga', async () => {
    const d = deferred<MeResponse>();
    me().mockRejectedValueOnce(new Error('Perfil ONG no encontrado')).mockReturnValueOnce(d.promise);
    render(<NGOMoments />);
    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/ }));
    expect(screen.queryByText('Perfil ONG no encontrado')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando momentos' })).toBeInTheDocument();
    d.resolve(meOk());
    expect(await screen.findByTestId('moments-feed')).toBeInTheDocument();
  });

  test('un error de red se explica con un mensaje propio (no el TypeError del navegador)', async () => {
    me().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<NGOMoments />);
    expect(await screen.findByText(/No pudimos cargar los momentos de tu organización/)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});
