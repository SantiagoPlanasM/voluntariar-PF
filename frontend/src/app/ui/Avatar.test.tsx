// src/app/ui/Avatar.test.tsx — tanda T6 de la revisión contra DESIGN.md (§330, hallazgo C8).
//
// "Nada por debajo de 12px": las iniciales de los avatares chicos (26 y 32 px) salían a 11 px.
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from './Avatar';

const fontSize = (size: number) => {
  const { container } = render(<Avatar name="Ana Pérez" size={size} />);
  return Number.parseFloat((container.querySelector('[data-initial]') as HTMLElement).style.fontSize);
};

describe('Avatar: tamaño de las iniciales', () => {
  test.each([20, 26, 32, 35])('con %i px de avatar las iniciales miden 12 px', size => {
    expect(fontSize(size)).toBe(12);
  });

  test('desde 36 px crecen con el avatar (34 %)', () => {
    expect(fontSize(36)).toBe(12);
    expect(fontSize(44)).toBe(15);
    expect(fontSize(96)).toBe(33);
  });
});
