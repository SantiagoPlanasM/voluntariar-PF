// src/app/components/LoadError.test.tsx
//
// Estado de error compartido para pantallas que cargan un recurso por id (REVISION.md F7). Antes, ante
// cualquier error, ProjectDetails / NGOPublicProfile / CompanyPublicProfile / NGOProjectDetail hacían
// `navigate(-1)` y `return null`: abierto desde un link compartido (sin historial) quedaba en blanco.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LoadError, describeLoadError } from './LoadError';
import { ApiError } from '../../lib/api';

describe('describeLoadError', () => {
  const notFound = 'No encontramos este proyecto';

  test('404 → el mensaje de "no existe", sin reintentar', () => {
    expect(describeLoadError(new ApiError('Proyecto no encontrado', 404), notFound))
      .toEqual({ message: notFound, retry: false });
  });

  test('403 → el mensaje del servidor, sin reintentar (reintentar no lo arregla)', () => {
    expect(describeLoadError(new ApiError('Sin permiso sobre este proyecto', 403), notFound))
      .toEqual({ message: 'Sin permiso sobre este proyecto', retry: false });
  });

  test('500 / 502 → el mensaje del servidor, con reintentar', () => {
    expect(describeLoadError(new ApiError('Error al obtener proyecto', 500), notFound))
      .toEqual({ message: 'Error al obtener proyecto', retry: true });
  });

  test('sin red (TypeError de fetch) → mensaje en español, con reintentar', () => {
    expect(describeLoadError(new TypeError('Failed to fetch'), notFound))
      .toEqual({ message: 'No pudimos conectarnos con el servidor. Revisá tu conexión.', retry: true });
  });
});

describe('<LoadError />', () => {
  afterEach(() => { window.history.replaceState(null, ''); });

  const mount = (props: Partial<Parameters<typeof LoadError>[0]> = {}) =>
    render(<MemoryRouter><LoadError message="Algo falló" home="/feed" {...props} /></MemoryRouter>);

  test('muestra el mensaje y "Reintentar" llama a onRetry', () => {
    const onRetry = vi.fn();
    mount({ onRetry });
    expect(screen.getByText('Algo falló')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('sin onRetry no hay botón de reintentar', () => {
    mount();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  test('sin historial (link abierto en otra pestaña) ofrece ir al inicio, no "Volver"', () => {
    window.history.replaceState({ idx: 0 }, '');
    mount();
    expect(screen.getByRole('link', { name: /Ir al inicio/ })).toHaveAttribute('href', '/feed');
    expect(screen.queryByRole('button', { name: /Volver/ })).not.toBeInTheDocument();
  });

  test('con historial ofrece "Volver"', () => {
    window.history.replaceState({ idx: 2 }, '');
    mount();
    expect(screen.getByRole('button', { name: /Volver/ })).toBeInTheDocument();
  });
});
