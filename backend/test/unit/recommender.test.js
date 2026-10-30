// test/unit/recommender.test.js — las 9 señales de las recomendaciones, sin base de datos (§287).
//
// El scoring salió de routes/projects.js a src/lib/recommender.js para bajar la complejidad (SonarCloud) sin cambiar el
// comportamiento: la prueba diferencial de §287 comparó 65 recomendaciones del código viejo y el nuevo. Acá se fijan
// los umbrales y los textos de cada señal, el arranque en frío, la suma y el orden con la diversidad.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { signals, scoreProject, rankRecommendations, compatibleRoles, MAX_PER_NGO } = require('../../src/lib/recommender');

const NOW = Date.UTC(2026, 9, 29, 12);
const ctx = (over = {}) => ({
  now: NOW, isColdStart: false, hasInterests: false, hasSkills: false, categoryFreq: {}, catNameById: {}, catsByProject: {},
  rolesByProject: {}, ratingByProject: {}, socialByProject: {}, compatibleRoles: new Set(), myLocation: null,
  followedNgos: new Set(), interestedNgos: new Set(), ...over,
});
const p = (over = {}) => ({ id: 'p1', ngo_id: 'n1', ngo_name: 'Sustentando', ubicacion: 'Córdoba', cupos: 10, cupos_ocupados: 0,
  followers: 0, created_at: new Date(NOW - 60 * 86400000).toISOString(), ...over });
const days = (d) => new Date(NOW - d * 86400000).toISOString();

describe('señales', () => {
  test('afinidad: 30 / 22 / 15 según el interés, con la categoría en el motivo; sin intereses o sin coincidencia, nada', () => {
    const c = (freq) => ctx({ hasInterests: true, categoryFreq: { c1: freq }, catNameById: { c1: 'Educación' }, catsByProject: { p1: ['c1'] } });
    assert.deepEqual(signals.affinitySignal(p(), c(3)), { points: 30, reason: 'Coincide con tu interés en "Educación"', tag: '💚 Educación' });
    assert.equal(signals.affinitySignal(p(), c(2)).points, 22);
    assert.equal(signals.affinitySignal(p(), c(1)).points, 15);
    assert.equal(signals.affinitySignal(p(), c(0)), null);
    assert.equal(signals.affinitySignal(p(), ctx({ categoryFreq: { c1: 3 }, catsByProject: { p1: ['c1'] } })), null);
  });

  test('habilidades: 20 con dos o más roles, 14 con uno; sin habilidades o sin coincidencia, nada', () => {
    const c = ctx({ hasSkills: true, compatibleRoles: new Set(['Educador', 'Coordinador']), rolesByProject: { p1: ['Educador', 'Coordinador', 'Cocinero'] } });
    assert.deepEqual(signals.skillsSignal(p(), c), { points: 20, reason: 'Busca tus habilidades: Educador, Coordinador', tag: '🎯 Match de habilidades' });
    const uno = ctx({ hasSkills: true, compatibleRoles: new Set(['Cocinero']), rolesByProject: { p1: ['Cocinero'] } });
    assert.deepEqual(signals.skillsSignal(p(), uno), { points: 14, reason: 'Busca tu habilidad: Cocinero', tag: '🎯 Match de habilidades' });
    assert.equal(signals.skillsSignal(p(), ctx({ hasSkills: true, compatibleRoles: new Set(['X']), rolesByProject: { p1: ['Y'] } })), null);
    assert.equal(signals.skillsSignal(p(), ctx({ rolesByProject: { p1: ['Cocinero'] }, compatibleRoles: new Set(['Cocinero']) })), null);
  });

  test('ONG: 15 si la sigo, 10 si sigo un voluntariado suyo', () => {
    assert.deepEqual(signals.ngoSignal(p(), ctx({ followedNgos: new Set(['n1']) })),
      { points: 15, reason: 'De Sustentando, una ONG que seguís', tag: '❤️ Sustentando' });
    assert.deepEqual(signals.ngoSignal(p(), ctx({ interestedNgos: new Set(['n1']) })), { points: 10, reason: 'De Sustentando, que te podría interesar' });
    assert.equal(signals.ngoSignal(p(), ctx()), null);
  });

  test('cercanía: 10 misma ubicación, 6 misma ciudad, 4 remoto; sin ubicación, nada', () => {
    assert.deepEqual(signals.proximitySignal(p(), ctx({ myLocation: 'córdoba' })), { points: 10, reason: 'En tu zona: Córdoba', tag: '📍 Cerca tuyo' });
    assert.deepEqual(signals.proximitySignal(p({ ubicacion: 'Córdoba, Barrio Centro' }), ctx({ myLocation: 'córdoba, argentina' })),
      { points: 6, reason: 'Cerca tuyo, en Córdoba, Barrio Centro' });
    assert.deepEqual(signals.proximitySignal(p({ ubicacion: 'Zoom', modalidad: 'remoto' }), ctx({ myLocation: 'rosario' })),
      { points: 4, reason: 'Disponible en remoto', tag: '💻 Remoto' });
    assert.equal(signals.proximitySignal(p({ ubicacion: 'Mendoza' }), ctx({ myLocation: 'rosario' })), null);
    assert.equal(signals.proximitySignal(p(), ctx()), null);
  });

  // Mutación (§287): los bordes que los tests de arriba no fijaban.
  test('cercanía: "remoto" o "virtual" en la ubicación; la ciudad sin espacios; sin ciudad no compara', () => {
    assert.equal(signals.proximitySignal(p({ ubicacion: 'Remoto' }), ctx({ myLocation: 'rosario' })).points, 4);
    assert.equal(signals.proximitySignal(p({ ubicacion: 'Virtual (Meet)' }), ctx({ myLocation: 'rosario' })).points, 4);
    assert.equal(signals.proximitySignal(p({ ubicacion: 'Córdoba, Centro' }), ctx({ myLocation: 'córdoba , argentina' })).points, 6);
    assert.equal(signals.proximitySignal(p({ ubicacion: 'Mendoza' }), ctx({ myLocation: ', argentina' })), null);
  });

  test('cupos: 8 / 5 / 2 según lo lleno (×2 en arranque en frío)', () => {
    assert.deepEqual(signals.urgencySignal(p({ cupos_ocupados: 9 }), ctx()), { points: 8, reason: '¡Últimos 1 cupo!', tag: '🔥 Últimos cupos' });
    assert.equal(signals.urgencySignal(p({ cupos: 20, cupos_ocupados: 18 }), ctx()).reason, '¡Últimos 2 cupos!');
    assert.deepEqual(signals.urgencySignal(p({ cupos_ocupados: 8 }), ctx()), { points: 5, reason: 'Cupos limitados', tag: '⏳ Cupos limitados' });
    assert.deepEqual(signals.urgencySignal(p({ cupos_ocupados: 5 }), ctx()), { points: 2 });
    assert.equal(signals.urgencySignal(p({ cupos_ocupados: 4 }), ctx()), null);
    assert.equal(signals.urgencySignal(p({ cupos_ocupados: 9 }), ctx({ isColdStart: true })).points, 16);
    assert.equal(signals.urgencySignal(p({ cupos: 0 }), ctx()), null);
    assert.equal(signals.urgencySignal(p({ cupos: 0, cupos_ocupados: 1 }), ctx()), null);   // sin cupos no hay urgencia
    assert.equal(signals.urgencySignal(p({ cupos: 4, cupos_ocupados: 3 }), ctx()).points, 5);  // justo 0,75
  });

  test('novedad: 7 / 5 / 2 hasta 3, 7 y 14 días (×2 en arranque en frío); sin fecha, nada', () => {
    assert.deepEqual(signals.noveltySignal(p({ created_at: days(3) }), ctx()), { points: 7, reason: 'Recién publicado', tag: '✨ Nuevo' });
    assert.deepEqual(signals.noveltySignal(p({ created_at: days(7) }), ctx()), { points: 5, reason: 'Publicado hace poco', tag: '🆕 Reciente' });
    assert.deepEqual(signals.noveltySignal(p({ created_at: days(14) }), ctx()), { points: 2 });
    assert.equal(signals.noveltySignal(p({ created_at: days(15) }), ctx()), null);
    assert.equal(signals.noveltySignal(p({ created_at: days(1) }), ctx({ isColdStart: true })).points, 14);
    assert.equal(signals.noveltySignal(p({ created_at: null }), ctx()), null);
  });

  test('valoración: 5 / 3 / 1 (×3 en arranque en frío)', () => {
    const c = (avg, count, cold = false) => ctx({ isColdStart: cold, ratingByProject: { p1: { avg, count } } });
    assert.deepEqual(signals.ratingSignal(p(), c(4.5, 3)), { points: 5, reason: '⭐ 4.5/5 (3 reseñas)', tag: '⭐ Bien valorado' });
    assert.deepEqual(signals.ratingSignal(p(), c(4.5, 2)), { points: 3, reason: '⭐ 4.5/5 (2 reseñas)' });
    assert.deepEqual(signals.ratingSignal(p(), c(4.0, 2)), { points: 3, reason: '⭐ 4.0/5 (2 reseñas)' });
    assert.deepEqual(signals.ratingSignal(p(), c(3.5, 1)), { points: 1 });
    assert.equal(signals.ratingSignal(p(), c(3.4, 5)), null);
    assert.equal(signals.ratingSignal(p(), c(4.6, 3, true)).points, 15);
    assert.equal(signals.ratingSignal(p(), ctx()), null);
  });

  test('popularidad: 5 / 3 / 1 con 20, 10 y 5 seguidores', () => {
    assert.deepEqual(signals.popularitySignal(p({ followers: 20 })), { points: 5, reason: '20 personas siguen este proyecto', tag: '🚀 Popular' });
    assert.deepEqual(signals.popularitySignal(p({ followers: 10 })), { points: 3, reason: '10 seguidores' });
    assert.deepEqual(signals.popularitySignal(p({ followers: 5 })), { points: 1 });
    assert.equal(signals.popularitySignal(p({ followers: 4 })), null);
  });

  test('social: 15 / 10 / 6 con tres, dos o un contacto (×1,5 en arranque en frío, redondeado)', () => {
    const c = (names, cold = false) => ctx({ isColdStart: cold, socialByProject: { p1: names } });
    assert.deepEqual(signals.socialSignal(p(), c(['A', 'B', 'C'])), { points: 15, reason: '3 personas que seguís participan acá', tag: '👥 Tus contactos participan' });
    assert.deepEqual(signals.socialSignal(p(), c(['Ana', 'Beto'])), { points: 10, reason: 'Ana y Beto participan acá', tag: '👥 Tus contactos participan' });
    assert.deepEqual(signals.socialSignal(p(), c(['Ana'])), { points: 6, reason: 'Ana participa acá', tag: '👥 Un contacto participa' });
    assert.equal(signals.socialSignal(p(), c([])), null);
    assert.equal(signals.socialSignal(p(), c(['A', 'B', 'C'], true)).points, 23);   // 22,5 redondeado
    assert.equal(signals.socialSignal(p(), c(['Ana'], true)).points, 9);
  });
});

describe('suma, arranque en frío y orden', () => {
  test('scoreProject suma las señales en orden; sin motivos dice "Podría interesarte" (y "🌟 Destacado" en frío)', () => {
    const r = scoreProject(p({ cupos_ocupados: 9, followers: 20 }), ctx({ followedNgos: new Set(['n1']) }));
    assert.equal(r.score, 15 + 8 + 5);
    assert.deepEqual(r.tags, ['❤️ Sustentando', '🔥 Últimos cupos', '🚀 Popular']);
    assert.deepEqual(scoreProject(p(), ctx()), { project: p(), score: 0, reasons: ['Podría interesarte'], tags: [] });
    assert.deepEqual(scoreProject(p(), ctx({ isColdStart: true })).tags, ['🌟 Destacado']);
  });

  test('scoreProject: una señal sin motivo o sin tag no agrega undefined; con motivo y sin tag no dice "Podría interesarte"', () => {
    const soloPuntos = scoreProject(p({ cupos_ocupados: 5 }), ctx());   // { points: 2 }, sin motivo ni tag
    assert.deepEqual([soloPuntos.score, soloPuntos.reasons, soloPuntos.tags], [2, ['Podría interesarte'], []]);
    const sinTag = scoreProject(p(), ctx({ interestedNgos: new Set(['n1']) }));
    assert.deepEqual([sinTag.reasons, sinTag.tags], [['De Sustentando, que te podría interesar'], []]);
  });

  test('rankRecommendations: a igual puntaje, uno sin fecha válida va después', () => {
    const s = (id, created_at) => ({ project: p({ id, created_at }), score: 10 });
    assert.deepEqual(rankRecommendations([s('sin', null), s('con', days(30))], 10).map((x) => x.project.id), ['con', 'sin']);
  });

  test('rankRecommendations: por puntaje, empate al más nuevo, a lo sumo 2 por ONG adelante y corta en limit', () => {
    const s = (id, ngo, score, d) => ({ project: p({ id, ngo_id: ngo, created_at: days(d) }), score });
    const ids = rankRecommendations([
      s('a1', 'A', 50, 5), s('a2', 'A', 40, 5), s('a3', 'A', 30, 5), s('b1', 'B', 20, 5), s('b2', 'B', 20, 1),
    ], 10).map((x) => x.project.id);
    assert.deepEqual(ids, ['a1', 'a2', 'b2', 'b1', 'a3']);
    assert.equal(rankRecommendations([s('a1', 'A', 1, 1), s('b1', 'B', 2, 1)], 1).length, 1);
    assert.equal(MAX_PER_NGO, 2);
  });

  test('compatibleRoles: de las habilidades (sin importar mayúsculas) a los roles', () => {
    assert.deepEqual([...compatibleRoles(['Enseñanza', 'IDIOMAS', 'Redes sociales', 'Inexistente'])].sort(), ['Comunicador', 'Educador']);
  });
});
