// src/lib/calendar.ts — "Agregar al calendario" de una entrevista (§268): un .ics para cualquier calendario y el link
// de Google Calendar. Sin dependencias. La fecha y la hora de la entrevista son de Argentina (UTC-3 todo el año, como
// en el backend, routes/enrollments.js); el evento va en UTC para que cada calendario lo muestre en su zona.
import type { Interview } from './api';

/** `allDay` (§315): `start`/`end` son fechas sin hora (AAAAMMDD) y `end` es EXCLUSIVO (el día después del último). */
export interface CalendarEvent { title: string; start: string; end: string; location: string; description: string; allDay?: boolean }

const DURATION_MS = 60 * 60 * 1000; // una hora: la entrevista no tiene duración propia

/** Fecha en el formato básico de iCalendar, en UTC: 20261110T210000Z. */
const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function interviewEvent(
  iv: Pick<Interview, 'date' | 'time' | 'link' | 'place' | 'note'>, projectTitle: string, ngoName: string,
): CalendarEvent {
  const start = Date.parse(`${iv.date}T${iv.time}:00-03:00`);
  return {
    title: `Entrevista: ${projectTitle} (${ngoName})`,
    start: icsDate(start),
    end: icsDate(start + DURATION_MS),
    location: iv.place || iv.link || '',
    description: [iv.link && `Link: ${iv.link}`, iv.note].filter(Boolean).join('\n'),
  };
}

/** "AAAA-MM-DD" + días → "AAAAMMDD" (con Date.UTC: sin husos ni horario de verano en el medio). */
const plusDays = (isoDate: string, days: number) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10).replace(/-/g, '');
};

/**
 * El voluntariado como evento (§315). Sin fecha de inicio → null. Con hora de inicio y en un solo día (o con hora de
 * fin), lleva hora: de Argentina, en UTC; sin hora de fin dura una hora, como la entrevista. Si no, es de día
 * completo, de la fecha de inicio a la de fin.
 */
export function projectEvent(
  p: { title: string; ngo_name?: string | null; location?: string | null; start_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null },
  url: string,
): CalendarEvent | null {
  if (!p.start_date) return null;
  const lastDay = p.end_date || p.start_date;
  const base = {
    title: `Voluntariado: ${p.title}${p.ngo_name ? ` (${p.ngo_name})` : ''}`,
    location: p.location || '',
    description: `Más información: ${url}`,
  };
  if (p.start_time && (p.end_time || lastDay === p.start_date)) {
    const start = Date.parse(`${p.start_date}T${p.start_time}:00-03:00`);
    const end = p.end_time ? Date.parse(`${lastDay}T${p.end_time}:00-03:00`) : start + DURATION_MS;
    return { ...base, allDay: false, start: icsDate(start), end: icsDate(end) };
  }
  return { ...base, allDay: true, start: plusDays(p.start_date, 0), end: plusDays(lastDay, 1) };
}

/** Texto de iCalendar (RFC 5545 §3.3.11): se escapan la barra invertida, `;`, `,` y los saltos de línea. */
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// `kind` va en el UID: 'entrevista' (§268) o 'voluntariado' (§315). Un evento de día completo usa VALUE=DATE.
export function toIcs(e: CalendarEvent, uid: string, now = new Date(), kind: 'entrevista' | 'voluntariado' = 'entrevista'): string {
  const date = e.allDay ? ';VALUE=DATE' : '';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VoluntariAR//Entrevistas//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${kind}-${uid}@voluntariar`,
    `DTSTAMP:${icsDate(now.getTime())}`,
    `DTSTART${date}:${e.start}`,
    `DTEND${date}:${e.end}`,
    `SUMMARY:${icsText(e.title)}`,
    `LOCATION:${icsText(e.location)}`,
    `DESCRIPTION:${icsText(e.description)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${e.start}/${e.end}`, location: e.location, details: e.description });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** href para descargar el .ics desde un <a download> (sin crear un Blob ni revocarlo después). */
export const icsHref = (ics: string) => `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
