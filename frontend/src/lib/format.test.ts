// src/lib/format.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo, formatTime } from './format';

describe('timeAgo', () => {
  beforeEach(() => {
    // Fijamos "ahora" en un instante conocido para que los tests sean deterministas
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  test('devuelve string vacío si no hay fecha', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
  });

  test('"ahora" para hace menos de 1 minuto', () => {
    expect(timeAgo('2026-08-10 11:59:30')).toBe('ahora');
  });

  test('minutos', () => {
    expect(timeAgo('2026-08-10 11:55:00')).toBe('5 min');
  });

  test('horas', () => {
    expect(timeAgo('2026-08-10 09:00:00')).toBe('3 h');
  });

  test('días (menos de una semana)', () => {
    expect(timeAgo('2026-08-08 12:00:00')).toBe('2 d');
  });

  test('formato de fecha para más de una semana', () => {
    const result = timeAgo('2026-07-20 12:00:00');
    // No fijamos el string exacto (depende del locale del entorno de test),
    // solo que ya no use el formato relativo "Xd"/"X min"/"X h"
    expect(result).not.toMatch(/^\d+ (min|h|d)$/);
    expect(result).not.toBe('ahora');
  });
});

describe('formatTime', () => {
  test('devuelve una hora en formato HH:MM', () => {
    const result = formatTime('2026-08-10 15:30:00');
    expect(result).toMatch(/^\d{1,2}:\d{2}/);
  });
});
