// test/integration/faqs-ui-names.test.js
//
// D24 (Issue #25, sesión exploratoria §245): después del rediseño del frontend (§240), 3 de las 8 respuestas del
// asistente nombraban la interfaz vieja: "Mi Participación" (ahora "Mis voluntariados"), "el ícono de lápiz" (ahora
// "Editar perfil") y "Nuevo Voluntariado" en el panel (ahora "Crear voluntariado"). Las respuestas viven en
// scripts/migrate.js, que solo insertaba las FAQs que no existían: en una base ya migrada (producción) el texto
// viejo se quedaba aunque se cambiara el código.
// Criterio: (1) ninguna respuesta nombra algo que ya no existe y las tres nombran lo que hay hoy; (2) migrar una base
// con las respuestas viejas las actualiza, sin tocar lo demás de la fila (por ejemplo, una FAQ desactivada sigue así).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { setupTestServer } = require('./helpers');

const OLD = {
  '¿Cómo cancelo mi inscripción?': 'Desde "Mi Participación" podés ver tus inscripciones activas y cancelarlas si todavía no empezó el voluntariado.',
  '¿Cómo edito mi perfil?': 'Andá a tu perfil y tocá el ícono de lápiz para editar tu foto, descripción, ubicación y habilidades.',
  '¿Cómo creo un nuevo voluntariado?': 'Desde el panel de tu ONG, tocá "Nuevo Voluntariado" y completá el formulario con título, descripción, cupos y categoría.',
};
const STALE = [/Mi Participación/, /lápiz/, /"Nuevo Voluntariado"/];
const CURRENT = {
  '¿Cómo cancelo mi inscripción?': /"Mis voluntariados".*"Cancelar postulación"/,
  '¿Cómo edito mi perfil?': /"Editar perfil"/,
  '¿Cómo creo un nuevo voluntariado?': /"Crear voluntariado"/,
};

describe('FAQs: las respuestas nombran la interfaz actual (D24)', () => {
  let server;
  let db;

  before(async () => {
    server = await setupTestServer();
    db = require('../../src/db');
  });

  after(async () => {
    if (server) await server.close();
  });

  const answers = async () => {
    const rows = await db.all('SELECT pregunta, respuesta, activo FROM faqs');
    return new Map(rows.map(r => [r.pregunta, r]));
  };

  test('ninguna respuesta nombra pantallas o botones que ya no existen, y las tres nombran los de hoy', async () => {
    // Act
    const faqs = await answers();

    // Assert
    for (const { pregunta, respuesta } of faqs.values()) {
      for (const re of STALE) assert.doesNotMatch(respuesta, re, `"${pregunta}" todavía dice ${re}`);
    }
    for (const [pregunta, re] of Object.entries(CURRENT)) assert.match(faqs.get(pregunta).respuesta, re, pregunta);
  });

  test('migrar una base que tiene las respuestas viejas las actualiza y no reactiva una FAQ desactivada', async () => {
    // Arrange: la base queda como en producción antes del arreglo; una de las tres, además, desactivada
    for (const [pregunta, respuesta] of Object.entries(OLD)) {
      await db.run('UPDATE faqs SET respuesta = $1 WHERE pregunta = $2', [respuesta, pregunta]);
    }
    await db.run('UPDATE faqs SET activo = false WHERE pregunta = $1', ['¿Cómo edito mi perfil?']);

    // Act: migrar otra vez, como en un deploy
    execFileSync('node', [path.join(__dirname, '../../scripts/migrate.js')], { env: { ...process.env }, stdio: 'pipe' });

    // Assert
    const faqs = await answers();
    for (const [pregunta, re] of Object.entries(CURRENT)) assert.match(faqs.get(pregunta).respuesta, re, pregunta);
    assert.equal(Boolean(faqs.get('¿Cómo edito mi perfil?').activo), false);
    assert.equal(faqs.size, 8, 'migrar dos veces no duplica FAQs');
  });
});
