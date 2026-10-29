// src/lib/calendar.test.ts — "Agregar al calendario" de una entrevista (§268).
//
// Criterio: la fecha y la hora son de Argentina (UTC-3 todo el año) y el evento va en UTC (10/11/2026 18:00 → 21:00 Z),
// con una hora de duración. El .ics es un VCALENDAR/VEVENT válido (CRLF, UID, DTSTAMP) con título, lugar, link y nota,
// y escapa `\`, `;`, `,` y los saltos de línea. El link de Google Calendar lleva las mismas fechas y textos.
import { describe, test, expect } from 'vitest';
import { interviewEvent, toIcs, googleCalendarUrl } from './calendar';

const iv = { id: 'int-1', date: '2026-11-10', time: '18:00', link: 'https://meet.google.com/abc', place: 'Sede; piso 2, oficina', note: 'Traé el DNI\nY el CV' };

describe('calendario de la entrevista', () => {
  test('el evento: de 18:00 de Argentina a 19:00, en UTC, con título, lugar y descripción', () => {
    const e = interviewEvent(iv, 'Limpieza del lago', 'ONG Verde');
    expect(e.start).toBe('20261110T210000Z');
    expect(e.end).toBe('20261110T220000Z');
    expect(e.title).toBe('Entrevista: Limpieza del lago (ONG Verde)');
    expect(e.location).toBe('Sede; piso 2, oficina');
    expect(e.description).toBe('Link: https://meet.google.com/abc\nTraé el DNI\nY el CV');
  });

  test('cruzar la medianoche en UTC cambia el día (23:30 de Argentina → 02:30 Z del día siguiente)', () => {
    const e = interviewEvent({ ...iv, date: '2026-12-31', time: '23:30' }, 'X', 'Y');
    expect([e.start, e.end]).toEqual(['20270101T023000Z', '20270101T033000Z']);
  });

  test('sin lugar, la ubicación es el link; sin link ni nota, la descripción queda vacía', () => {
    const e = interviewEvent({ ...iv, place: null, note: null }, 'X', 'Y');
    expect(e.location).toBe('https://meet.google.com/abc');
    expect(interviewEvent({ ...iv, link: null, note: null }, 'X', 'Y').description).toBe('');
  });

  test('el .ics: líneas con CRLF, VEVENT con UID y DTSTAMP, y el texto escapado', () => {
    const ics = toIcs(interviewEvent(iv, 'Limpieza del lago', 'ONG Verde'), 'int-1', new Date('2026-10-29T12:00:00Z'));
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('UID:entrevista-int-1@voluntariar');
    expect(lines).toContain('DTSTAMP:20261029T120000Z');
    expect(lines).toContain('DTSTART:20261110T210000Z');
    expect(lines).toContain('DTEND:20261110T220000Z');
    expect(lines).toContain('SUMMARY:Entrevista: Limpieza del lago (ONG Verde)');
    expect(lines).toContain('LOCATION:Sede\\; piso 2\\, oficina');
    expect(lines).toContain('DESCRIPTION:Link: https://meet.google.com/abc\\nTraé el DNI\\nY el CV');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(lines.at(-1)).toBe(''); // termina en CRLF
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  test('una barra invertida se escapa', () => {
    const ics = toIcs({ ...interviewEvent(iv, 'A\\B', 'C'), location: '' }, 'x', new Date(0));
    expect(ics).toContain('SUMMARY:Entrevista: A\\\\B (C)');
  });

  test('Google Calendar: action=TEMPLATE con las fechas y los textos codificados', () => {
    const url = new URL(googleCalendarUrl(interviewEvent(iv, 'Limpieza del lago', 'ONG Verde')));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261110T210000Z/20261110T220000Z');
    expect(url.searchParams.get('text')).toBe('Entrevista: Limpieza del lago (ONG Verde)');
    expect(url.searchParams.get('location')).toBe('Sede; piso 2, oficina');
    expect(url.searchParams.get('details')).toContain('Traé el DNI');
  });
});
