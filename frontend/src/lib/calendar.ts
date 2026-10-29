// src/lib/calendar.ts — "Agregar al calendario" de una entrevista (§268): un .ics para cualquier calendario y el link
// de Google Calendar. Sin dependencias. La fecha y la hora de la entrevista son de Argentina (UTC-3 todo el año, como
// en el backend, routes/enrollments.js); el evento va en UTC para que cada calendario lo muestre en su zona.
import type { Interview } from './api';

export interface CalendarEvent { title: string; start: string; end: string; location: string; description: string }

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

/** Texto de iCalendar (RFC 5545 §3.3.11): se escapan la barra invertida, `;`, `,` y los saltos de línea. */
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function toIcs(e: CalendarEvent, uid: string, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VoluntariAR//Entrevistas//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:entrevista-${uid}@voluntariar`,
    `DTSTAMP:${icsDate(now.getTime())}`,
    `DTSTART:${e.start}`,
    `DTEND:${e.end}`,
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
