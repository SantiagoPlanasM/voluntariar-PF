// src/lib/ngoValidation.ts — validación de la ONG en el frontend (§317; DESIGN.md → Validación de ONGs).
// Los topes y mensajes son los del backend (routes/ngoValidacion.js y routes/admin.js): se chequean antes de mandar
// para no gastar el pedido (el backend tiene un tope de envíos por hora), pero la validación real es la del backend.
import type { LegalType, NgoValidationStatus, ValidationDoc } from './api';

export const DOC_MAX_BYTES = 5 * 1024 * 1024;   // DOC_MAX_BYTES de routes/ngoValidacion.js

/** Las personerías que acepta el backend (LEGAL_TYPES de lib/ngoValidation.js), en el orden del formulario. */
export const LEGAL_TYPE_OPTIONS: { value: LegalType; label: string }[] = [
  { value: 'civil_association', label: 'Asociación civil' },
  { value: 'foundation', label: 'Fundación' },
  { value: 'cooperative', label: 'Cooperativa' },
  { value: 'mutual', label: 'Mutual' },
  { value: 'other', label: 'Otra' },
];
export const legalTypeLabel = (t: LegalType) => LEGAL_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

export const STATUS_LABEL: Record<NgoValidationStatus, string> = {
  none: 'Sin validar', pending: 'En revisión', approved: 'Validada', rejected: 'Rechazada',
};

const DOC_LABEL: Record<ValidationDoc, string> = { statute: 'El estatuto', registration: 'La constancia de inscripción' };
const DOC_MISSING: Record<ValidationDoc, string> = {
  statute: 'Falta el estatuto (PDF)', registration: 'Falta la constancia de inscripción (PDF)',
};

/** null si el archivo se puede mandar; si no, el mismo mensaje que daría el backend. */
export function checkValidationDoc(doc: ValidationDoc, file: File | null | undefined): string | null {
  if (!file) return DOC_MISSING[doc];
  if (file.type !== 'application/pdf') return `${DOC_LABEL[doc]} no es un PDF válido`;
  if (file.size > DOC_MAX_BYTES) return 'Cada PDF puede pesar hasta 5 MB';
  return null;
}

export const REASON_MAX = 500;
/** El motivo del rechazo, como checkText del backend: mínimo 10 sin los bordes, máximo 500 con todo. */
export function checkRejectReason(reason: string): string | null {
  if (reason.trim().length < 10 || reason.length > REASON_MAX) return 'Escribí el motivo del rechazo (de 10 a 500 caracteres)';
  return null;
}
