// src/app/components/PhotoCarousel.test.tsx
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoCarousel, carouselAspect } from './PhotoCarousel';
import { makePhoto } from '../../test/postFixtures';

const three = [makePhoto(1), makePhoto(2), makePhoto(3)];
const shownSrc = () => (screen.getByRole('img') as HTMLImageElement).getAttribute('src');

describe('carouselAspect', () => {
  test('usa la proporción de la primera foto', () => {
    expect(carouselAspect([makePhoto(1, { width: 1600, height: 1200 })])).toBeCloseTo(4 / 3, 5);
  });

  test('una foto muy vertical no pasa de 4:5 (0,8), como en Instagram', () => {
    expect(carouselAspect([makePhoto(1, { width: 1000, height: 3000 })])).toBe(0.8);
  });

  test('una foto muy panorámica no pasa de 1,91:1', () => {
    expect(carouselAspect([makePhoto(1, { width: 4000, height: 1000 })])).toBe(1.91);
  });

  test('sin medidas (null) o sin fotos, cuadrada', () => {
    expect(carouselAspect([makePhoto(1, { width: null, height: null })])).toBe(1);
    expect(carouselAspect([])).toBe(1);
  });

  test('con una medida en cero no divide por cero', () => {
    expect(carouselAspect([makePhoto(1, { width: 0, height: 0 })])).toBe(1);
  });
});

describe('<PhotoCarousel />', () => {
  test('una sola foto: se ve y no hay controles ni contador', () => {
    render(<PhotoCarousel photos={[makePhoto(1)]} alt="Reforestación" />);
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Reforestación');
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Foto anterior' })).not.toBeInTheDocument();
    expect(screen.queryByText(/ \/ /)).not.toBeInTheDocument();
  });

  test('sin fotos no muestra ninguna imagen', () => {
    render(<PhotoCarousel photos={[]} alt="x" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('varias fotos: arranca en la primera, con contador y sin botón "anterior"', () => {
    render(<PhotoCarousel photos={three} alt="Reforestación" />);
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Foto anterior' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Foto siguiente' })).toBeInTheDocument();
  });

  test('el alt de cada foto dice cuál es (para lectores de pantalla)', () => {
    render(<PhotoCarousel photos={three} alt="Reforestación" />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Reforestación (foto 1 de 3)');
  });

  test('"siguiente" y "anterior" navegan y actualizan el contador', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(shownSrc()).toBe('https://img.test/p2.jpg');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(shownSrc()).toBe('https://img.test/p3.jpg');
    // en la última ya no hay "siguiente"
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(shownSrc()).toBe('https://img.test/p2.jpg');
  });

  test('las flechas del teclado también navegan, y no pasan de los extremos', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    const region = screen.getByRole('group');
    fireEvent.keyDown(region, { key: 'ArrowLeft' });          // ya está en la primera
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });         // ya está en la última
    expect(shownSrc()).toBe('https://img.test/p3.jpg');
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(shownSrc()).toBe('https://img.test/p2.jpg');
  });

  test('deslizar hacia la izquierda avanza y hacia la derecha retrocede', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    const region = screen.getByRole('group');
    fireEvent.touchStart(region, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(shownSrc()).toBe('https://img.test/p2.jpg');

    fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 220, clientY: 100 }] });
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
  });

  test('un toque corto o un movimiento chico no cambia de foto', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    const region = screen.getByRole('group');
    fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 70, clientY: 100 }] });   // 30 px
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
  });

  test('un gesto más vertical que horizontal es scroll de la página: no cambia de foto', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    const region = screen.getByRole('group');
    fireEvent.touchStart(region, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 120, clientY: 400 }] });
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
  });

  test('deslizar hacia atrás en la primera foto no hace nada (no se sale del rango)', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    const region = screen.getByRole('group');
    fireEvent.touchStart(region, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  test('si la lista se achica y la foto actual ya no existe, muestra la última que queda', () => {
    const { rerender } = render(<PhotoCarousel photos={three} alt="x" />);
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));   // en la 3
    rerender(<PhotoCarousel photos={[makePhoto(1)]} alt="x" />);
    expect(shownSrc()).toBe('https://img.test/p1.jpg');
  });

  test('las fotos usan carga diferida (no bajan todas juntas al abrir el feed)', () => {
    render(<PhotoCarousel photos={three} alt="x" />);
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  });
});
