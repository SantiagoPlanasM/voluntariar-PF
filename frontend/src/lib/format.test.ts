// src/lib/format.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo, formatTime, truncateText, userMessage } from './format';

describe('timeAgo', () => {
  beforeEach(() => {
    // Fijamos "ahora" en un instante conocido para que los tests sean deterministas
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  // La API de Momentos devuelve ISO 8601 completo ("2026-08-10T11:55:00.000Z"); el resto de la app, el formato
  // viejo sin zona ("2026-08-10 11:55:00"). Antes timeAgo le pegaba una "Z" a todo, así que el ISO daba
  // "…000ZZ" = fecha inválida y la tarjeta mostraba "NaN min".
  test('acepta ISO 8601 con Z y milisegundos (lo que devuelve /api/posts)', () => {
    expect(timeAgo('2026-08-10T11:55:00.000Z')).toBe('5 min');
    expect(timeAgo('2026-08-10T09:00:00Z')).toBe('3 h');
  });

  test('acepta ISO con offset horario y lo respeta', () => {
    expect(timeAgo('2026-08-10T08:55:00-03:00')).toBe('5 min');     // = 11:55 UTC
    expect(timeAgo('2026-08-10T14:55:00+03:00')).toBe('5 min');     // = 11:55 UTC
  });

  test('el formato viejo sigue funcionando igual (se asume UTC)', () => {
    expect(timeAgo('2026-08-10 11:55:00')).toBe('5 min');
    expect(timeAgo('2026-08-10T11:55:00')).toBe('5 min');           // ISO sin zona también se asume UTC
  });

  test('un valor que no es una fecha devuelve vacío en vez de "NaN min"', () => {
    expect(timeAgo('esto no es una fecha')).toBe('');
    expect(timeAgo('')).toBe('');
  });

  test('más de una semana: el ISO y el formato viejo dan lo mismo para el mismo instante', () => {
    const iso = timeAgo('2026-07-01T10:00:00.000Z');
    expect(iso).not.toBe('');
    expect(iso).toBe(timeAgo('2026-07-01 10:00:00'));
  });

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

describe('truncateText', () => {
  test('un texto corto queda igual y no se marca como recortado', () => {
    expect(truncateText('Hola mundo', 140)).toEqual({ text: 'Hola mundo', truncated: false });
  });

  test('un texto de exactamente `max` caracteres NO se recorta', () => {
    const t = 'a'.repeat(140);
    expect(truncateText(t, 140)).toEqual({ text: t, truncated: false });
  });

  test('uno que se pasa un caracter se recorta y termina en puntos suspensivos', () => {
    const r = truncateText('a'.repeat(141), 140);
    expect(r.truncated).toBe(true);
    expect(r.text.endsWith('…')).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(141);
  });

  test('corta en el límite de una palabra y no a la mitad de una', () => {
    const r = truncateText('uno dos tres cuatro cinco seis siete ocho', 20);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe('uno dos tres cuatro…');
  });

  test('si el corte cae a la MITAD de una palabra, retrocede hasta el espacio anterior', () => {
    // los primeros 22 caracteres son "uno dos tres cuatro ci": "cinco" queda cortada
    expect(truncateText('uno dos tres cuatro cinco seis', 22)).toEqual({ text: 'uno dos tres cuatro…', truncated: true });
  });

  test('pero si retroceder dejaría un texto cortísimo (palabra enorme al principio), corta duro', () => {
    // retroceder al único espacio dejaría "ab…"; es preferible mostrar más texto
    expect(truncateText('ab ' + 'x'.repeat(50), 10)).toEqual({ text: 'ab xxxxxxx…', truncated: true });
  });

  test('sin espacios (una palabra larguísima) corta duro en `max`', () => {
    expect(truncateText('x'.repeat(50), 10)).toEqual({ text: 'xxxxxxxxxx…', truncated: true });
  });

  test('no deja espacios ni saltos de línea antes de los puntos suspensivos', () => {
    const r = truncateText('hola   \n   mundo cruel y largo', 8);
    expect(r.text).not.toMatch(/\s…$/);
  });

  test('un texto corto pero con muchos saltos de línea se recorta a `maxLines` líneas', () => {
    const r = truncateText('1\n2\n3\n4\n5\n6', 500, 4);
    expect(r).toEqual({ text: '1\n2\n3\n4…', truncated: true });
  });

  test('con exactamente `maxLines` líneas no se recorta', () => {
    expect(truncateText('1\n2\n3\n4', 500, 4)).toEqual({ text: '1\n2\n3\n4', truncated: false });
  });
});

describe('userMessage', () => {
  test('usa el mensaje del servidor (viene en español) cuando es un Error común', () => {
    expect(userMessage(new Error('Podés publicar hasta 10 veces por hora'), 'fallback'))
      .toBe('Podés publicar hasta 10 veces por hora');
  });

  test('un fallo de red (TypeError de fetch, en inglés) se reemplaza por el mensaje de respaldo', () => {
    expect(userMessage(new TypeError('Failed to fetch'), 'No pudimos conectarnos')).toBe('No pudimos conectarnos');
  });

  test('un Error con mensaje vacío usa el respaldo', () => {
    expect(userMessage(new Error(''), 'fallback')).toBe('fallback');
  });

  test('algo que no es un Error usa el respaldo', () => {
    expect(userMessage('boom', 'fallback')).toBe('fallback');
    expect(userMessage(undefined, 'fallback')).toBe('fallback');
  });
});
