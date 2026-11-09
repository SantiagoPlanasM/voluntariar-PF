// La lógica del formulario de alta y edición de voluntariados, sin la pantalla (§298, PLAN_CIERRE §2: bajar la
// complejidad de CreateVoluntariado.tsx). Son tests de caracterización: fijan lo que ya hacía el componente.
import { describe, test, expect } from 'vitest';
import type { ProjectDetail } from '../../lib/api';
import { EMPTY_FORM, toBody, fromProject, changedFields, validateStep, roleError, reqError, type Form } from './projectForm';

const form = (over: Partial<Form> = {}): Form => ({
  ...EMPTY_FORM, title: 'Limpieza del río', description: 'Juntamos residuos en la costanera', location: 'Córdoba',
  duration: '1 jornada', volunteers_needed: '10', ...over,
});

describe('validateStep', () => {
  test('paso 1: título de 3 a 80 y descripción de 10 a 1000 (recortados)', () => {
    expect(validateStep(1, form(), null)).toEqual({});
    expect(validateStep(1, form({ title: '  ab ', description: 'corta' }), null)).toEqual({ title: 'Mínimo 3 caracteres', description: 'Mínimo 10 caracteres' });
    expect(validateStep(1, form({ title: 'x'.repeat(81), description: 'x'.repeat(1001) }), null))
      .toEqual({ title: 'Máximo 80 caracteres', description: 'Máximo 1000 caracteres' });
    expect(validateStep(1, form({ title: 'x'.repeat(80), description: 'x'.repeat(1000) }), null)).toEqual({});
    // los mínimos justos: 3 y 10 pasan; 2 y 9 no
    expect(validateStep(1, form({ title: 'abc', description: 'x'.repeat(10) }), null)).toEqual({});
    expect(validateStep(1, form({ title: 'ab', description: 'x'.repeat(9) }), null)).toEqual({ title: 'Mínimo 3 caracteres', description: 'Mínimo 10 caracteres' });
  });

  test('paso 2: lugar y pin según la modalidad, duración del fugaz, horas del sostenido y cupos', () => {
    const pin = { lat: -31.4, lng: -64.2 };
    expect(validateStep(2, form(), pin)).toEqual({});
    expect(validateStep(2, form(), null)).toEqual({ coords: 'Marcá el lugar en el mapa: buscá la dirección o tocá el mapa' });
    expect(validateStep(2, form({ modality: 'hibrido' }), null)).toEqual({});
    expect(validateStep(2, form({ modality: 'remoto', location: '' }), null)).toEqual({});
    expect(validateStep(2, form({ location: '  ' }), pin)).toEqual({ location: 'Obligatorio. Indicá la dirección o sede del voluntariado' });
    expect(validateStep(2, form({ duration: ' ' }), pin)).toEqual({ duration: 'Indicá la duración del evento' });
    expect(validateStep(2, form({ type: 'sostenido', hours_per_week: '0' }), pin)).toEqual({ hours_per_week: 'Ingresá horas por semana (mín. 1)' });
    expect(validateStep(2, form({ type: 'sostenido', hours_per_week: '4', duration: '' }), pin)).toEqual({});
    expect(validateStep(2, form({ volunteers_needed: 'x' }), pin)).toEqual({ volunteers_needed: '¿Cuántos voluntarios necesitás?' });
  });

  test('paso 3: no valida nada', () => {
    expect(validateStep(3, form({ title: '' }), null)).toEqual({});
  });
});

describe('roleError y reqError', () => {
  test('roles: vacío, solo letras de 2 a 40, sin repetir', () => {
    expect(roleError('  ', [])).toBe('Escribí un rol');
    expect(roleError('R2D2', [])).toBe('Solo letras, mínimo 2 caracteres');
    expect(roleError('Fotógrafo', ['Fotógrafo'])).toBe('Ya está en la lista');
    expect(roleError('Logística / Ventas', [])).toBe('');
  });
  test('requisitos: vacío, mínimo 3; repetido no da error pero no se agrega', () => {
    expect(reqError(' ', [])).toBe('Escribí un requisito');
    expect(reqError('ab', [])).toBe('Mínimo 3 caracteres');
    expect(reqError('Ropa cómoda', ['Ropa cómoda'])).toBe('duplicate');
    expect(reqError('Ropa cómoda', [])).toBe('');
  });
});

describe('toBody, fromProject y changedFields', () => {
  test('alta: sin valor es undefined; remoto sin lugar es "Remoto" y sin coordenadas', () => {
    const b = toBody(form({ modality: 'remoto', location: '', full_description: ' ' }), ['Guía'], ['Ropa'], { lat: 1, lng: 2 }, false);
    expect(b).toMatchObject({ location: 'Remoto', latitude: undefined, longitude: undefined, full_description: undefined, roles_needed: ['Guía'], requirements: ['Ropa'] });
    expect(b.volunteers_needed).toBe(10);
    expect(b.funding_goal).toBe(0);
  });

  test('edición: sin valor es null (el PUT es parcial); el sostenido manda horas y no duración', () => {
    const b = toBody(form({ type: 'sostenido', hours_per_week: '6', full_description: '' }), [], [], null, true);
    expect(b).toMatchObject({ full_description: null, latitude: null, longitude: null, hours_per_week: 6, duration: undefined });
  });

  test('fromProject precarga el formulario y las coordenadas', () => {
    const p = { title: 'T', description: 'D', category: 'Salud', location: 'Córdoba', modality: 'hibrido', type: 'sostenido',
      hours_per_week: 4, volunteers_needed: 8, funding_goal: 0, cost_per_person: 500, latitude: '-31.4', longitude: -64.2,
      roles_needed: ['Guía'], requirements: [] } as unknown as ProjectDetail;
    const r = fromProject(p);
    expect(r.form).toMatchObject({ title: 'T', modality: 'hibrido', hours_per_week: '4', funding_goal: '', cost_per_person: '500' });
    expect(r.coords).toEqual({ lat: -31.4, lng: -64.2 });
    expect(r.roles).toEqual(['Guía']);
    expect(fromProject({ ...p, latitude: null } as unknown as ProjectDetail).coords).toBeNull();
  });

  test('changedFields: solo lo que cambió (listas comparadas por contenido)', () => {
    expect(changedFields({ title: 'A', roles_needed: ['x'], volunteers_needed: 3 }, { title: 'A', roles_needed: ['x'], volunteers_needed: 2 }))
      .toEqual({ volunteers_needed: 3 });
  });
});

// §315: cuándo es el voluntariado. Todo opcional; las mismas reglas que el backend (routes/projects.js, scheduleError).
describe('fechas y horas del voluntariado', () => {
  const pin = { lat: -31.4, lng: -64.2 };
  const errs = (over: Partial<Form>) => validateStep(2, form(over), pin);

  test('vacío o completo y coherente: sin errores', () => {
    expect(errs({})).toEqual({});
    expect(errs({ start_date: '2026-12-05' })).toEqual({});
    expect(errs({ start_date: '2026-12-05', end_date: '2026-12-05', start_time: '09:00', end_time: '13:30' })).toEqual({});
    expect(errs({ start_date: '2026-12-05', end_date: '2026-12-06', start_time: '18:00', end_time: '12:00' })).toEqual({});
  });

  test('fin sin inicio, fin antes del inicio, horas sin fecha, fin sin hora de inicio y fin antes en el mismo día', () => {
    expect(errs({ end_date: '2026-12-05' })).toEqual({ end_date: 'Primero elegí la fecha de inicio' });
    expect(errs({ start_date: '2026-12-05', end_date: '2026-12-04' })).toEqual({ end_date: 'No puede ser anterior a la fecha de inicio' });
    expect(errs({ start_time: '09:00' })).toEqual({ start_time: 'Elegí también la fecha de inicio' });
    expect(errs({ end_time: '12:00' })).toEqual({ start_time: 'Elegí también la fecha de inicio' });
    expect(errs({ start_date: '2026-12-05', end_time: '12:00' })).toEqual({ end_time: 'Primero elegí la hora de inicio' });
    expect(errs({ start_date: '2026-12-05', start_time: '10:00', end_time: '10:00' })).toEqual({ end_time: 'Tiene que ser después de la hora de inicio' });
    expect(errs({ start_date: '2026-12-05', end_date: '2026-12-05', start_time: '10:00', end_time: '09:00' })).toEqual({ end_time: 'Tiene que ser después de la hora de inicio' });
  });

  test('toBody: al crear, lo vacío no se manda; al editar, va null (para poder borrarlo)', () => {
    const f = form({ start_date: '2026-12-05', start_time: '09:00' });
    const create = toBody(f, [], [], pin, false);
    expect([create.start_date, create.end_date, create.start_time, create.end_time]).toEqual(['2026-12-05', undefined, '09:00', undefined]);
    const edit = toBody(f, [], [], pin, true);
    expect([edit.start_date, edit.end_date, edit.start_time, edit.end_time]).toEqual(['2026-12-05', null, '09:00', null]);
  });

  test('fromProject: precarga las fechas, y "" si no hay', () => {
    const p = { title: 'X', type: 'fugaz', start_date: '2026-12-05', end_date: null, start_time: '09:00', end_time: null } as unknown as ProjectDetail;
    const f = fromProject(p).form;
    expect([f.start_date, f.end_date, f.start_time, f.end_time]).toEqual(['2026-12-05', '', '09:00', '']);
    const full = fromProject({ ...p, end_date: '2026-12-06', end_time: '12:00' } as unknown as ProjectDetail).form;
    expect([full.end_date, full.end_time]).toEqual(['2026-12-06', '12:00']);
  });
});
