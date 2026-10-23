// src/app/volunteering/cardActions.test.ts — qué botones muestra una tarjeta o la barra del voluntariado (§240).
// Criterio de aceptación (DESIGN.md → Estados de los botones), antes de escribir los casos:
//  - inscribirse: ONG y empresa no lo ven; con inscripción, su estado (pendiente → "Postulado", aprobada →
//    "Vas a ir", rechazada → "No seleccionado") gana sobre todo lo demás; sin inscripción: terminado → "Ver cómo
//    salió", lleno → "Cupos completos", si no → "Inscribirme". Sin cupo pedido (0) nunca está lleno;
//  - donar: solo con meta o con plata recaudada; nunca para una ONG, en un voluntariado terminado o si la ONG no
//    recibe donaciones (`accepts_donations === false`); con la meta alcanzada, "Meta cumplida".
import { describe, test, expect } from 'vitest';
import { cardActions } from './cardActions';

const p = (over: Record<string, unknown> = {}) => ({
  status: 'active', volunteers_needed: 10, current_volunteers: 2, funding_goal: 1000, current_funding: 100, ...over,
}) as Parameters<typeof cardActions>[0];

describe('cardActions: inscribirse', () => {
  test.each(['ngo', 'company'] as const)('%s no ve el botón', (viewer) => {
    expect(cardActions(p(), null, viewer).join).toEqual({ kind: 'hidden' });
    expect(cardActions(p(), 'pending', viewer).join).toEqual({ kind: 'hidden' });
  });

  test.each([
    ['pending', 'pending'],
    ['approved', 'accepted'],
    ['rejected', 'rejected'],
  ] as const)('inscripción %s → %s, aunque esté lleno o terminado', (estado, kind) => {
    expect(cardActions(p(), estado, 'volunteer').join.kind).toBe(kind);
    expect(cardActions(p({ status: 'completed', current_volunteers: 10 }), estado, 'volunteer').join.kind).toBe(kind);
  });

  test('sin inscripción: terminado gana sobre lleno', () => {
    expect(cardActions(p({ status: 'completed', current_volunteers: 10 }), null, 'volunteer').join.kind).toBe('past');
  });

  test('lleno justo en el cupo (10 de 10) y pasado del cupo', () => {
    expect(cardActions(p({ current_volunteers: 10 }), null, 'volunteer').join.kind).toBe('full');
    expect(cardActions(p({ current_volunteers: 12 }), null, null).join.kind).toBe('full');
    expect(cardActions(p({ current_volunteers: 9 }), null, null).join.kind).toBe('join');
  });

  test('sin cupo pedido (0) nunca está lleno', () => {
    expect(cardActions(p({ volunteers_needed: 0, current_volunteers: 5 }), null, 'volunteer').join.kind).toBe('join');
  });

  // §256: la ONG puede cancelar un voluntariado desde el panel. Antes solo se conocía 'completed' y un cancelado
  // ofrecía "Inscribirme" (el backend lo rechazaba recién al tocar).
  test('cancelado sin inscripción: "Cancelado" (gana sobre lleno); con inscripción, su estado', () => {
    expect(cardActions(p({ status: 'cancelled' }), null, 'volunteer').join).toEqual({ kind: 'cancelled' });
    expect(cardActions(p({ status: 'cancelled', current_volunteers: 10 }), null, null).join.kind).toBe('cancelled');
    expect(cardActions(p({ status: 'cancelled' }), 'approved', 'volunteer').join.kind).toBe('accepted');
    expect(cardActions(p({ status: 'cancelled' }), null, 'ngo').join.kind).toBe('hidden');
  });

  test('una inscripción cancelada cuenta como sin inscripción', () => {
    expect(cardActions(p(), 'cancelled', 'volunteer').join.kind).toBe('join');
  });

  test('un visitante (sin sesión) ve "Inscribirme"', () => {
    expect(cardActions(p(), undefined, null).join.kind).toBe('join');
  });
});

describe('cardActions: donar', () => {
  test('con meta y sin alcanzarla: donar (voluntario, empresa o visitante)', () => {
    for (const viewer of ['volunteer', 'company', null] as const) expect(cardActions(p(), null, viewer).donate.kind).toBe('donate');
  });

  test('cancelado: no se dona (aunque tenga meta y la ONG reciba donaciones)', () => {
    expect(cardActions(p({ status: 'cancelled' }), null, 'volunteer').donate.kind).toBe('hidden');
    expect(cardActions(p({ status: 'cancelled', accepts_donations: true }), null, 'company').donate.kind).toBe('hidden');
  });

  test('meta alcanzada justo o pasada: "Meta cumplida"', () => {
    expect(cardActions(p({ current_funding: 1000 }), null, 'volunteer').donate.kind).toBe('goal-met');
    expect(cardActions(p({ current_funding: 1500 }), null, 'volunteer').donate.kind).toBe('goal-met');
    expect(cardActions(p({ current_funding: 999 }), null, 'volunteer').donate.kind).toBe('donate');
  });

  test('sin meta pero con plata recaudada: se puede donar (nunca "Meta cumplida")', () => {
    expect(cardActions(p({ funding_goal: 0, current_funding: 500 }), null, 'volunteer').donate.kind).toBe('donate');
  });

  test('sin meta y sin plata: no hay botón', () => {
    expect(cardActions(p({ funding_goal: 0, current_funding: 0 }), null, 'volunteer').donate.kind).toBe('hidden');
    expect(cardActions(p({ funding_goal: null, current_funding: null }), null, 'volunteer').donate.kind).toBe('hidden');
  });

  test('una ONG no dona; un voluntariado terminado tampoco recibe', () => {
    expect(cardActions(p(), null, 'ngo').donate.kind).toBe('hidden');
    expect(cardActions(p({ status: 'completed' }), null, 'volunteer').donate.kind).toBe('hidden');
  });

  test('la ONG no recibe donaciones (accepts_donations false): no hay botón; sin el dato (listado), sí', () => {
    expect(cardActions(p({ accepts_donations: false }), null, 'volunteer').donate.kind).toBe('hidden');
    expect(cardActions(p({ accepts_donations: true }), null, 'volunteer').donate.kind).toBe('donate');
    expect(cardActions(p(), null, 'volunteer').donate.kind).toBe('donate');
  });
});
