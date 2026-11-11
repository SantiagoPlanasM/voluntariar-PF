// src/lib/ngoValidation.test.ts — validación de la ONG en el frontend (§317).
// Criterio de aceptación (antes de escribir el código): las personerías son las cinco que acepta el backend
// (lib/ngoValidation.js, LEGAL_TYPES), con nombre en castellano; los estados tienen la etiqueta de DESIGN.md
// ("Sin validar", "En revisión", "Validada", "Rechazada"); los PDF y el motivo del rechazo se chequean con los mismos
// topes y mensajes que el backend, antes de mandar nada.
import { describe, test, expect } from 'vitest';
import {
  LEGAL_TYPE_OPTIONS, legalTypeLabel, STATUS_LABEL, DOC_MAX_BYTES, checkValidationDoc, checkRejectReason,
} from './ngoValidation';

const file = (type: string, size = 10, name = 'doc.pdf') => new File([new Uint8Array(size)], name, { type });

describe('personerías', () => {
  test('las cinco del backend, en este orden y con nombre en castellano', () => {
    expect(LEGAL_TYPE_OPTIONS).toEqual([
      { value: 'civil_association', label: 'Asociación civil' },
      { value: 'foundation', label: 'Fundación' },
      { value: 'cooperative', label: 'Cooperativa' },
      { value: 'mutual', label: 'Mutual' },
      { value: 'other', label: 'Otra' },
    ]);
  });
  test('legalTypeLabel: el nombre, o el valor tal cual si no lo conoce', () => {
    expect(legalTypeLabel('foundation')).toBe('Fundación');
    expect(legalTypeLabel('nueva' as never)).toBe('nueva');
  });
});

test('estados con la etiqueta de DESIGN.md', () => {
  expect(STATUS_LABEL).toEqual({ none: 'Sin validar', pending: 'En revisión', approved: 'Validada', rejected: 'Rechazada' });
});

describe('checkValidationDoc: el mismo mensaje que daría el backend', () => {
  test('sin archivo → "Falta …"', () => {
    expect(checkValidationDoc('statute', null)).toBe('Falta el estatuto (PDF)');
    expect(checkValidationDoc('registration', undefined)).toBe('Falta la constancia de inscripción (PDF)');
  });
  test('otro tipo → "… no es un PDF válido"', () => {
    expect(checkValidationDoc('statute', file('image/png'))).toBe('El estatuto no es un PDF válido');
    expect(checkValidationDoc('registration', file('text/plain'))).toBe('La constancia de inscripción no es un PDF válido');
  });
  test('5 MB justos pasan; uno más → "Cada PDF puede pesar hasta 5 MB"', () => {
    expect(DOC_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(checkValidationDoc('statute', file('application/pdf', DOC_MAX_BYTES))).toBeNull();
    expect(checkValidationDoc('statute', file('application/pdf', DOC_MAX_BYTES + 1))).toBe('Cada PDF puede pesar hasta 5 MB');
  });
});

// Como checkText del backend (lib/inputs.js): el mínimo cuenta sin los espacios de los bordes; el máximo, el texto entero.
describe('checkRejectReason: de 10 a 500 caracteres, como checkText del backend', () => {
  const msg = 'Escribí el motivo del rechazo (de 10 a 500 caracteres)';
  test('el mínimo, sin los espacios de los bordes', () => {
    expect(checkRejectReason('123456789')).toBe(msg);
    expect(checkRejectReason('  123456789  ')).toBe(msg);
    expect(checkRejectReason('1234567890')).toBeNull();
  });
  test('el máximo, con todo', () => {
    expect(checkRejectReason('x'.repeat(500))).toBeNull();
    expect(checkRejectReason('x'.repeat(501))).toBe(msg);
    expect(checkRejectReason(` ${'x'.repeat(500)}`)).toBe(msg);
  });
});
