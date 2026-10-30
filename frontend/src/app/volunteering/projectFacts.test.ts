// Los datos que muestra el detalle de un voluntariado, calculados sin la pantalla (§299, PLAN_CIERRE §2: bajar la
// complejidad de ProjectDetails.tsx). Tests de caracterización: fijan lo que ya hacía el componente.
import { describe, test, expect } from 'vitest';
import type { ProjectDetail } from '../../lib/api';
import { projectFacts, commentError } from './projectFacts';

const p = (over: Partial<ProjectDetail> = {}) => ({
  id: 'p1', type: 'fugaz', duration: '2 días', hours_per_week: undefined, avg_rating: 0, volunteers_needed: 10,
  current_volunteers: 3, status: 'active', funding_goal: 0, current_funding: 0, accepts_donations: true,
  latitude: null, longitude: null, ratings: [], ...over,
}) as unknown as ProjectDetail;

describe('projectFacts', () => {
  test('horas: la duración del fugaz o las horas por semana del sostenido', () => {
    expect(projectFacts(p(), null).hoursLabel).toBe('2 días');
    expect(projectFacts(p({ duration: '' }), null).hoursLabel).toBe('Sin especificar');
    expect(projectFacts(p({ type: 'sostenido', hours_per_week: 4 }), null).hoursLabel).toBe('4 h por semana');
    expect(projectFacts(p({ type: 'sostenido' }), null).hoursLabel).toBe('No especificado');
  });

  test('promedio con coma y un decimal; sin calificaciones, null', () => {
    expect(projectFacts(p({ avg_rating: 4.25 }), null).avg).toBe('4,3');
    expect(projectFacts(p({ avg_rating: '4' as never }), null).avg).toBe('4,0');
    expect(projectFacts(p(), null).avg).toBeNull();
  });

  test('lugares libres nunca negativos', () => {
    expect(projectFacts(p(), null).spotsLeft).toBe(7);
    expect(projectFacts(p({ current_volunteers: 12 }), null).spotsLeft).toBe(0);
  });

  test('donar: activo, no ONG y con Mercado Pago; meta cumplida solo si hay meta', () => {
    expect(projectFacts(p(), 'volunteer').canDonate).toBe(true);
    expect(projectFacts(p(), null).canDonate).toBe(true);
    expect(projectFacts(p(), 'ngo').canDonate).toBe(false);
    expect(projectFacts(p({ status: 'completed' }), 'volunteer').canDonate).toBe(false);
    expect(projectFacts(p({ accepts_donations: false }), 'volunteer').canDonate).toBe(false);
    expect(projectFacts(p({ funding_goal: 100, current_funding: 100 }), null)).toMatchObject({ hasFunding: true, goalMet: true });
    expect(projectFacts(p({ funding_goal: 100, current_funding: 99 }), null).goalMet).toBe(false);
    expect(projectFacts(p(), null)).toMatchObject({ hasFunding: false, goalMet: false });
  });

  test('link al mapa solo con las dos coordenadas', () => {
    expect(projectFacts(p({ latitude: -31.4, longitude: -64.2 }), null).mapsHref)
      .toBe('https://www.google.com/maps/search/?api=1&query=-31.4,-64.2');
    expect(projectFacts(p({ latitude: -31.4 }), null).mapsHref).toBeNull();
    expect(projectFacts(p({ latitude: 0, longitude: 0 }), null).mapsHref).toBe('https://www.google.com/maps/search/?api=1&query=0,0');
  });
});

describe('commentError', () => {
  test('corto, con palabras no permitidas o bien', () => {
    expect(commentError('  ')).toBe('Muy corto');
    expect(commentError('ok')).toBe('Muy corto');
    expect(commentError('Muy lindo')).toBe('');
    expect(commentError('sos un idiota')).toBe('Contiene palabras no permitidas');
  });
});
