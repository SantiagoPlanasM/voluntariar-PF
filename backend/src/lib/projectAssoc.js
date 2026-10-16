// src/lib/projectAssoc.js
//
// Roles, requisitos y categoría de VARIOS proyectos, en 3 consultas fijas (no 3 por proyecto), escritos en
// cada fila con los nombres que lee fmt() de routes/projects.js: roles_json, requisitos_json, category_name.
// `q` es db o tx. Categoría: la primera que devuelve la base (mismo criterio que el LIMIT 1 del detalle).
//
// Lo usa GET /api/ngos/:id (REVISION A1). El mismo bloque está copiado en el listado SQLite de
// routes/projects.js y en GET /api/follows/project y /feed: se pueden pasar a esto (no se tocaron en A1).
async function attachAssoc(q, rows) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return rows;
  const ph = ids.map((_, i) => `$${i + 1}`).join(',');
  const [allRoles, allReqs, allCats] = await Promise.all([
    q.all(`SELECT pr.project_id, ro.nombre FROM project_roles pr JOIN roles ro ON ro.id=pr.rol_id WHERE pr.project_id IN (${ph})`, ids),
    q.all(`SELECT project_id, descripcion FROM requisitos WHERE project_id IN (${ph})`, ids),
    q.all(`SELECT pc.project_id, c.nombre FROM project_categorias pc JOIN categorias c ON c.id=pc.categoria_id WHERE pc.project_id IN (${ph})`, ids),
  ]);

  const rolesBy = {}, reqsBy = {}, catBy = {};
  for (const r of allRoles) (rolesBy[r.project_id] ||= []).push(r.nombre);
  for (const r of allReqs)  (reqsBy[r.project_id]  ||= []).push(r.descripcion);
  for (const r of allCats)  if (!catBy[r.project_id]) catBy[r.project_id] = r.nombre;

  for (const row of rows) {
    row.roles_json      = JSON.stringify(rolesBy[row.id] || []);
    row.requisitos_json = JSON.stringify(reqsBy[row.id]  || []);
    row.category_name   = catBy[row.id] || '';
  }
  return rows;
}

module.exports = { attachAssoc };
