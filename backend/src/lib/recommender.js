// src/lib/recommender.js — el puntaje de las recomendaciones (GET /api/projects/recommended), en funciones puras.
//
// Sacado de routes/projects.js en §287 para bajar su complejidad (SonarCloud: 342 de complejidad cognitiva, la mayor
// del proyecto, casi toda de este scoring) y poder probar cada señal sin la base. El comportamiento es el mismo: mismos
// umbrales, textos, tags, orden y multiplicadores del arranque en frío. La ruta junta los datos; acá solo se calcula.
//
// Cada señal recibe el proyecto (fila de la base) y el contexto del voluntario, y devuelve { points, reason?, tag? }
// o null. El orden de SIGNALS es el orden de los motivos y tags en la respuesta.
const { toMillis } = require('./time');

// Habilidades del voluntario → roles de proyecto compatibles.
const SKILL_TO_ROLE = {
  'programación':       ['Programador'],
  'fotografía':         ['Fotógrafo'],
  'enseñanza':          ['Educador'],
  'cocina':             ['Cocinero'],
  'conducción':         ['Conductor'],
  'primeros auxilios':  ['Médico / Enfermero'],
  'comunicación':       ['Comunicador'],
  'redes sociales':     ['Comunicador'],
  'electricidad':       ['Técnico'],
  'carpintería':        ['Técnico'],
  'diseño gráfico':     ['Comunicador'],
  'administración':     ['Coordinador'],
  'idiomas':            ['Educador'],
  // §280: estaban en el catálogo sin rol y no sumaban nada (un test exige que toda habilidad tenga uno).
  'contabilidad':       ['Coordinador'],
  'jardinería':         ['Voluntario general'],
};
const MAX_PER_NGO = 2;   // diversidad (§280)
const DAY_MS = 86400000;

/** Los roles compatibles con las habilidades (por nombre) del voluntario. */
function compatibleRoles(skillNames) {
  const roles = new Set();
  for (const name of skillNames) for (const r of SKILL_TO_ROLE[name.toLowerCase()] || []) roles.add(r);
  return roles;
}

/** Puntos según el primer umbral que se alcanza: tiers = [[mínimo, puntos], …] de mayor a menor. */
const tier = (value, tiers) => (tiers.find(([min]) => value >= min) || [null, 0])[1];

// 1) Afinidad temática (máx 30): la categoría con más interés (postulaciones pesadas y voluntariados seguidos).
function affinitySignal(p, ctx) {
  if (!ctx.hasInterests) return null;
  const cats = ctx.catsByProject[p.id] || [];
  const best = cats.reduce((m, c) => Math.max(m, ctx.categoryFreq[c] || 0), 0);
  if (best === 0) return null;
  const name = ctx.catNameById[cats.find((c) => ctx.categoryFreq[c] === best)];
  return { points: tier(best, [[3, 30], [2, 22], [1, 15]]), reason: `Coincide con tu interés en "${name || 'esta categoría'}"`, tag: `💚 ${name}` };
}

// 2) Habilidades (máx 20): roles del proyecto que coinciden con las habilidades del voluntario.
function skillsSignal(p, ctx) {
  const roles = ctx.rolesByProject[p.id] || [];
  if (!ctx.hasSkills || roles.length === 0) return null;
  const matched = roles.filter((r) => ctx.compatibleRoles.has(r));
  if (matched.length === 0) return null;
  return matched.length >= 2
    ? { points: 20, reason: `Busca tus habilidades: ${matched.join(', ')}`, tag: '🎯 Match de habilidades' }
    : { points: 14, reason: `Busca tu habilidad: ${matched[0]}`, tag: '🎯 Match de habilidades' };
}

// 3) ONG (máx 15): seguida directamente, o de un voluntariado seguido.
function ngoSignal(p, ctx) {
  if (ctx.followedNgos.has(p.ngo_id)) return { points: 15, reason: `De ${p.ngo_name}, una ONG que seguís`, tag: `❤️ ${p.ngo_name}` };
  if (ctx.interestedNgos.has(p.ngo_id)) return { points: 10, reason: `De ${p.ngo_name}, que te podría interesar` };
  return null;
}

// 4) Cercanía (máx 10): misma ubicación, la misma ciudad (lo de antes de la coma) o remoto.
function proximitySignal(p, ctx) {
  if (!ctx.myLocation) return null;
  const loc = p.ubicacion?.trim().toLowerCase() || '';
  const city = ctx.myLocation.split(',')[0];
  if (loc === ctx.myLocation) return { points: 10, reason: `En tu zona: ${p.ubicacion}`, tag: '📍 Cerca tuyo' };
  if (city && loc.includes(city.trim())) return { points: 6, reason: `Cerca tuyo, en ${p.ubicacion}` };
  if (p.modalidad === 'remoto' || loc.includes('remoto') || loc.includes('virtual')) return { points: 4, reason: 'Disponible en remoto', tag: '💻 Remoto' };
  return null;
}

// 5) Urgencia de cupos (máx 8; ×2 en arranque en frío).
function urgencySignal(p, ctx) {
  const fill = p.cupos > 0 ? p.cupos_ocupados / p.cupos : 0;
  const m = ctx.isColdStart ? 2 : 1;
  const left = (p.cupos || 0) - (p.cupos_ocupados || 0);
  if (fill >= 0.9) return { points: 8 * m, reason: `¡Últimos ${left} cupo${left === 1 ? '' : 's'}!`, tag: '🔥 Últimos cupos' };
  if (fill >= 0.75) return { points: 5 * m, reason: 'Cupos limitados', tag: '⏳ Cupos limitados' };
  if (fill >= 0.5) return { points: 2 * m };
  return null;
}

// 6) Novedad (máx 7; ×2 en arranque en frío). Fecha: string en SQLite y Date en Postgres, siempre vía toMillis().
// Sin fecha válida no suma (en vez de romper).
function noveltySignal(p, ctx) {
  const created = toMillis(p.created_at);
  const days = created === null ? Infinity : (ctx.now - created) / DAY_MS;
  const m = ctx.isColdStart ? 2 : 1;
  if (days <= 3) return { points: 7 * m, reason: 'Recién publicado', tag: '✨ Nuevo' };
  if (days <= 7) return { points: 5 * m, reason: 'Publicado hace poco', tag: '🆕 Reciente' };
  if (days <= 14) return { points: 2 * m };
  return null;
}

// 7) Valoración (máx 5; ×3 en arranque en frío).
function ratingSignal(p, ctx) {
  const { avg, count } = ctx.ratingByProject[p.id] || { avg: 0, count: 0 };
  const m = ctx.isColdStart ? 3 : 1;
  const reason = `⭐ ${avg.toFixed(1)}/5 (${count} reseñas)`;
  if (avg >= 4.5 && count >= 3) return { points: 5 * m, reason, tag: '⭐ Bien valorado' };
  if (avg >= 4.0 && count >= 2) return { points: 3 * m, reason };
  if (avg >= 3.5 && count >= 1) return { points: 1 * m };
  return null;
}

// 8) Popularidad (máx 5): seguidores del voluntariado.
function popularitySignal(p) {
  const f = p.followers || 0;
  if (f >= 20) return { points: 5, reason: `${f} personas siguen este proyecto`, tag: '🚀 Popular' };
  if (f >= 10) return { points: 3, reason: `${f} seguidores` };
  if (f >= 5) return { points: 1 };
  return null;
}

// 9) Señal social (máx 15; ×1,5 en arranque en frío): voluntarios que sigo y ya participan.
function socialSignal(p, ctx) {
  const names = ctx.socialByProject[p.id] || [];
  const m = ctx.isColdStart ? 1.5 : 1;
  if (names.length >= 3) return { points: Math.round(15 * m), reason: `${names.length} personas que seguís participan acá`, tag: '👥 Tus contactos participan' };
  if (names.length === 2) return { points: Math.round(10 * m), reason: `${names[0]} y ${names[1]} participan acá`, tag: '👥 Tus contactos participan' };
  if (names.length === 1) return { points: Math.round(6 * m), reason: `${names[0]} participa acá`, tag: '👥 Un contacto participa' };
  return null;
}

const SIGNALS = [affinitySignal, skillsSignal, ngoSignal, proximitySignal, urgencySignal, noveltySignal, ratingSignal, popularitySignal, socialSignal];

/** El puntaje, los motivos y los tags de un voluntariado. Sin ningún motivo: "Podría interesarte" (y, en arranque en
 *  frío, el tag "🌟 Destacado"). */
function scoreProject(p, ctx) {
  let score = 0;
  const reasons = [];
  const tags = [];
  for (const signal of SIGNALS) {
    const r = signal(p, ctx);
    if (!r) continue;
    score += r.points;
    if (r.reason) reasons.push(r.reason);
    if (r.tag) tags.push(r.tag);
  }
  if (reasons.length === 0) {
    reasons.push('Podría interesarte');
    if (ctx.isColdStart) tags.push('🌟 Destacado');
  }
  return { project: p, score, reasons, tags };
}

/** Ordena por puntaje (y, a igual puntaje, el más nuevo primero), deja a lo sumo MAX_PER_NGO de la misma ONG adelante
 *  (los que sobran van detrás, en su orden) y corta en `limit`. */
function rankRecommendations(scored, limit) {
  const sorted = [...scored].sort((a, b) => b.score - a.score
    || (toMillis(b.project.created_at) ?? 0) - (toMillis(a.project.created_at) ?? 0));
  const perNgo = {};
  const ahead = [];
  const behind = [];
  for (const s of sorted) {
    const k = s.project.ngo_id;
    if ((perNgo[k] || 0) < MAX_PER_NGO) { perNgo[k] = (perNgo[k] || 0) + 1; ahead.push(s); } else behind.push(s);
  }
  return [...ahead, ...behind].slice(0, limit);
}

module.exports = {
  SKILL_TO_ROLE, MAX_PER_NGO, compatibleRoles, scoreProject, rankRecommendations,
  // Las señales, para probarlas una por una.
  signals: { affinitySignal, skillsSignal, ngoSignal, proximitySignal, urgencySignal, noveltySignal, ratingSignal, popularitySignal, socialSignal },
};
