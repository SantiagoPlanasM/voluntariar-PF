// El encuadre de la foto del voluntariado (§297) como clase de Tailwind, para las tarjetas y el detalle.
import { describe, test, expect } from 'vitest';
import { imagePositionClass } from './imagePosition';

describe('imagePositionClass', () => {
  test('arriba, centro y abajo', () => {
    expect(imagePositionClass('top')).toBe('object-top');
    expect(imagePositionClass('center')).toBe('object-center');
    expect(imagePositionClass('bottom')).toBe('object-bottom');
  });
  test('sin dato (o uno raro de una versión vieja): al centro', () => {
    expect(imagePositionClass(undefined)).toBe('object-center');
    expect(imagePositionClass('left' as never)).toBe('object-center');
  });
});
