// scripts/migrate.js
require('dotenv').config();
const db = require('../src/db');

async function migrate() {
  console.log('🔧 Ejecutando migraciones...');

  const isPg = db.type === 'postgres';

  const UUID_PK = isPg
    ? 'TEXT PRIMARY KEY DEFAULT gen_random_uuid()'
    : "TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))";
  const NOW  = isPg ? 'TIMESTAMPTZ DEFAULT NOW()' : "DATETIME DEFAULT (datetime('now'))";
  const BOOL = isPg ? 'BOOLEAN' : 'INTEGER';
  const JSONB = isPg ? 'JSONB' : 'TEXT';

  const tables = [

    // ── 1. USUARIOS — base de autenticación ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS users (
      id          ${UUID_PK},
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'volunteer'
                    CHECK(role IN ('volunteer','ngo','company')),
      avatar      TEXT,
      bio         TEXT,
      location    TEXT,
      created_at  ${NOW},
      updated_at  ${NOW}
    )`,

    // ── 2. CATEGORÍAS — tabla normalizada ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS categorias (
      id          ${UUID_PK},
      nombre      TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      icono       TEXT,
      created_at  ${NOW}
    )`,

    // ── 3. HABILIDADES ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS habilidades (
      id          ${UUID_PK},
      nombre      TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      created_at  ${NOW}
    )`,

    // ── 4. ONGs ───────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ngos (
      id              ${UUID_PK},
      user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      nombre          TEXT NOT NULL,
      descripcion     TEXT,
      foto_perfil     TEXT,
      banner          TEXT,
      mision          TEXT,
      alias           TEXT UNIQUE,
      ubicacion       TEXT,
      founded         TEXT,
      followers       INTEGER DEFAULT 0 CHECK(followers >= 0),
      created_at      ${NOW},
      updated_at      ${NOW}
    )`,

    // ── 5. EMPRESAS ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS empresas (
      id              ${UUID_PK},
      user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      nombre          TEXT NOT NULL,
      descripcion     TEXT,
      mision          TEXT,
      ubicacion       TEXT,
      foto_perfil     TEXT,
      banner          TEXT,
      industria       TEXT,
      followers       INTEGER DEFAULT 0 CHECK(followers >= 0),
      created_at      ${NOW},
      updated_at      ${NOW}
    )`,

    // ── 6. VOLUNTARIOS — perfil extendido ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS voluntarios (
      id              ${UUID_PK},
      user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      nombre          TEXT NOT NULL,
      apellido        TEXT NOT NULL,
      descripcion     TEXT,
      ubicacion       TEXT,
      foto_perfil     TEXT,
      banner          TEXT,
      cv_url          TEXT,
      created_at      ${NOW},
      updated_at      ${NOW}
    )`,

    // ── 7. EMPLEADOS DE ONG ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS empleados (
      id              ${UUID_PK},
      ngo_id          TEXT NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
      nombre          TEXT NOT NULL,
      apellido        TEXT NOT NULL,
      email           TEXT NOT NULL,
      foto_perfil     TEXT,
      rol             TEXT NOT NULL DEFAULT 'coordinador'
                        CHECK(rol IN ('coordinador','comunicador','admin','otro')),
      created_at      ${NOW}
    )`,

    // ── 8. VOLUNTARIADOS ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS projects (
      id                  ${UUID_PK},
      ngo_id              TEXT NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
      titulo              TEXT NOT NULL,
      descripcion         TEXT NOT NULL,
      descripcion_full    TEXT,
      foto_perfil         TEXT,
      banner              TEXT,
      alias               TEXT UNIQUE,
      tipo                TEXT NOT NULL DEFAULT 'fugaz'
                            CHECK(tipo IN ('fugaz','sostenido')),
      status              TEXT NOT NULL DEFAULT 'active'
                            CHECK(status IN ('active','completed','cancelled')),
      ubicacion           TEXT NOT NULL,
      fecha_inicio        TEXT,
      fecha_fin           TEXT,
      cupos               INTEGER NOT NULL DEFAULT 0 CHECK(cupos >= 0),
      cupos_ocupados      INTEGER NOT NULL DEFAULT 0 CHECK(cupos_ocupados >= 0),
      meta_financiera     REAL DEFAULT 0 CHECK(meta_financiera >= 0),
      recaudado           REAL DEFAULT 0 CHECK(recaudado >= 0),
      costo               REAL DEFAULT 0 CHECK(costo >= 0),
      horas_semanales     INTEGER CHECK(horas_semanales IS NULL OR horas_semanales > 0),
      duracion            TEXT,
      followers           INTEGER DEFAULT 0 CHECK(followers >= 0),
      created_at          ${NOW},
      updated_at          ${NOW}
    )`,

    // ── 9. REQUISITOS — tabla normalizada (reemplaza JSON) ────────────────
    `CREATE TABLE IF NOT EXISTS requisitos (
      id              ${UUID_PK},
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      descripcion     TEXT NOT NULL,
      cantidad        INTEGER DEFAULT 1 CHECK(cantidad > 0),
      tipo            TEXT DEFAULT 'general',
      created_at      ${NOW}
    )`,

    // ── 10. ROLES DE VOLUNTARIADO (tabla normalizada) ─────────────────────
    `CREATE TABLE IF NOT EXISTS roles (
      id          ${UUID_PK},
      nombre      TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      created_at  ${NOW}
    )`,

    // ── 11. KPIs ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS kpis (
      id              ${UUID_PK},
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      nombre          TEXT NOT NULL,
      descripcion     TEXT,
      valor           REAL,
      tipo_valor      TEXT DEFAULT 'numero'
                        CHECK(tipo_valor IN ('numero','porcentaje','texto','booleano')),
      unidad          TEXT,
      fecha           TEXT,
      created_at      ${NOW}
    )`,

    // ── 12. INSCRIPCIONES (enrollments) ───────────────────────────────────
    `CREATE TABLE IF NOT EXISTS enrollments (
      id              ${UUID_PK},
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','approved','rejected','cancelled')),
      mensaje         TEXT,
      horas_realizadas REAL DEFAULT 0 CHECK(horas_realizadas >= 0),
      created_at      ${NOW},
      updated_at      ${NOW},
      UNIQUE(user_id, project_id)
    )`,

    // ── 13. DONACIONES ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS donaciones (
      id              ${UUID_PK},
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
      ngo_id          TEXT REFERENCES ngos(id) ON DELETE SET NULL,
      monto           REAL NOT NULL CHECK(monto > 0),
      fecha           ${NOW},
      estado          TEXT NOT NULL DEFAULT 'completada'
                        CHECK(estado IN ('pendiente','completada','fallida','reembolsada')),
      created_at      ${NOW}
    )`,

    // ── 14. REUNIONES VIRTUALES ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reuniones (
      id              ${UUID_PK},
      empleado_id     TEXT REFERENCES empleados(id) ON DELETE SET NULL,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      fecha           TEXT NOT NULL,
      horario         TEXT NOT NULL,
      link            TEXT,
      estado          TEXT NOT NULL DEFAULT 'programada'
                        CHECK(estado IN ('programada','realizada','cancelada')),
      created_at      ${NOW}
    )`,

    // ── 15. COMENTARIOS ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS comments (
      id          ${UUID_PK},
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment     TEXT NOT NULL,
      created_at  ${NOW}
    )`,

    // ── 16. CALIFICACIONES ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ratings (
      id          ${UUID_PK},
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  ${NOW},
      UNIQUE(user_id, project_id)
    )`,

    // ── 17. NOTIFICACIONES ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS notifications (
      id          ${UUID_PK},
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      read        ${BOOL} DEFAULT ${isPg ? 'false' : '0'},
      data        ${JSONB},
      created_at  ${NOW}
    )`,

    // ══ TABLAS INTERMEDIAS N:M ════════════════════════════════════════════

    // ── 18. ONG × Categoría ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ngo_categorias (
      ngo_id      TEXT NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
      categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      PRIMARY KEY (ngo_id, categoria_id)
    )`,

    // ── 19. Voluntariado × Categoría ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS project_categorias (
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, categoria_id)
    )`,

    // ── 20. Voluntariado × Roles necesitados ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS project_roles (
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      rol_id      TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      cantidad    INTEGER DEFAULT 1 CHECK(cantidad > 0),
      PRIMARY KEY (project_id, rol_id)
    )`,

    // ── 21. Voluntario × Habilidades ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS voluntario_habilidades (
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      habilidad_id  TEXT NOT NULL REFERENCES habilidades(id) ON DELETE CASCADE,
      nivel         TEXT DEFAULT 'basico'
                      CHECK(nivel IN ('basico','intermedio','avanzado')),
      PRIMARY KEY (user_id, habilidad_id)
    )`,

    // ── 22. Empresa × Voluntariado (patrocinio RSE) ────────────────────────
    `CREATE TABLE IF NOT EXISTS empresa_voluntariados (
      empresa_id  TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      aporte      REAL DEFAULT 0 CHECK(aporte >= 0),
      created_at  ${NOW},
      PRIMARY KEY (empresa_id, project_id)
    )`,

    // ── 23. Seguidores de ONGs ────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ngo_follows (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ngo_id      TEXT NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
      created_at  ${NOW},
      PRIMARY KEY (user_id, ngo_id)
    )`,

    // ── 24. Seguidores de Proyectos ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS project_follows (
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at  ${NOW},
      PRIMARY KEY (user_id, project_id)
    )`,
  ];

  // ── Crear tablas ──────────────────────────────────────────────────────────
  for (const sql of tables) {
    await db.query(sql);
    // Extraer nombre de tabla para el log
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    console.log(`  ✅ Tabla: ${match ? match[1] : '?'}`);
  }

  // ── Índices ───────────────────────────────────────────────────────────────
  console.log('\n🔍 Creando índices...');
  const indexes = [
    // Búsquedas frecuentes en proyectos
    `CREATE INDEX IF NOT EXISTS idx_projects_ngo      ON projects(ngo_id)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_tipo     ON projects(tipo)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_ubicacion ON projects(ubicacion)`,
    // Inscripciones
    `CREATE INDEX IF NOT EXISTS idx_enrollments_user    ON enrollments(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_project ON enrollments(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_status  ON enrollments(status)`,
    // Comentarios y ratings
    `CREATE INDEX IF NOT EXISTS idx_comments_project  ON comments(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_project   ON ratings(project_id)`,
    // Notificaciones
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`,
    // Requisitos y KPIs
    `CREATE INDEX IF NOT EXISTS idx_requisitos_project ON requisitos(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_kpis_project       ON kpis(project_id)`,
    // Donaciones
    `CREATE INDEX IF NOT EXISTS idx_donaciones_user    ON donaciones(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_donaciones_project ON donaciones(project_id)`,
    // Reuniones
    `CREATE INDEX IF NOT EXISTS idx_reuniones_project  ON reuniones(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reuniones_user     ON reuniones(user_id)`,
    // Empleados
    `CREATE INDEX IF NOT EXISTS idx_empleados_ngo      ON empleados(ngo_id)`,
  ];

  for (const idx of indexes) {
    await db.query(idx);
    const match = idx.match(/INDEX IF NOT EXISTS (\w+)/i);
    console.log(`  ✅ Índice: ${match ? match[1] : '?'}`);
  }

  // ── Datos base (categorías y roles predefinidos) ───────────────────────────
  console.log('\n🌱 Insertando datos base...');

  const categorias = [
    { nombre: 'Medio Ambiente', descripcion: 'Proyectos de conservación, reforestación y cuidado ambiental', icono: '🌿' },
    { nombre: 'Educación',      descripcion: 'Apoyo escolar, talleres y capacitaciones', icono: '📚' },
    { nombre: 'Alimentación',   descripcion: 'Bancos de alimentos, comedores y huertos comunitarios', icono: '🍎' },
    { nombre: 'Salud',          descripcion: 'Campañas de salud, asistencia médica y bienestar', icono: '❤️' },
    { nombre: 'Tecnología',     descripcion: 'Inclusión digital, desarrollo y educación tecnológica', icono: '💻' },
    { nombre: 'Animales',       descripcion: 'Rescate, adopción y bienestar animal', icono: '🐾' },
    { nombre: 'Arte y Cultura', descripcion: 'Expresión artística, patrimonio y cultura comunitaria', icono: '🎨' },
    { nombre: 'Deportes',       descripcion: 'Deporte social, inclusión y actividad física', icono: '⚽' },
  ];

  for (const c of categorias) {
    const exists = await db.get('SELECT id FROM categorias WHERE nombre=$1', [c.nombre]);
    if (!exists) {
      await db.run(
        `INSERT INTO categorias (nombre, descripcion, icono) VALUES ($1,$2,$3)`,
        [c.nombre, c.descripcion, c.icono]
      );
    }
  }
  console.log(`  ✅ ${categorias.length} categorías`);

  const roles = [
    { nombre: 'Coordinador',           descripcion: 'Organiza y coordina grupos de voluntarios' },
    { nombre: 'Educador',              descripcion: 'Dicta clases o talleres' },
    { nombre: 'Comunicador',           descripcion: 'Gestiona redes sociales y prensa' },
    { nombre: 'Técnico',               descripcion: 'Tareas técnicas especializadas' },
    { nombre: 'Voluntario general',    descripcion: 'Tareas generales de campo' },
    { nombre: 'Fotógrafo',             descripcion: 'Registro visual del evento' },
    { nombre: 'Conductor',             descripcion: 'Traslado de materiales o personas' },
    { nombre: 'Cocinero',              descripcion: 'Preparación de alimentos' },
    { nombre: 'Médico / Enfermero',    descripcion: 'Atención médica en terreno' },
    { nombre: 'Programador',           descripcion: 'Desarrollo de software o apps' },
  ];

  for (const r of roles) {
    const exists = await db.get('SELECT id FROM roles WHERE nombre=$1', [r.nombre]);
    if (!exists) {
      await db.run(
        `INSERT INTO roles (nombre, descripcion) VALUES ($1,$2)`,
        [r.nombre, r.descripcion]
      );
    }
  }
  console.log(`  ✅ ${roles.length} roles`);

  const habilidades = [
    'Jardinería', 'Cocina', 'Fotografía', 'Programación', 'Diseño gráfico',
    'Enseñanza', 'Idiomas', 'Primeros auxilios', 'Conducción', 'Carpintería',
    'Electricidad', 'Comunicación', 'Administración', 'Contabilidad', 'Redes sociales',
  ];

  for (const h of habilidades) {
    const exists = await db.get('SELECT id FROM habilidades WHERE nombre=$1', [h]);
    if (!exists) {
      await db.run(`INSERT INTO habilidades (nombre) VALUES ($1)`, [h]);
    }
  }
  console.log(`  ✅ ${habilidades.length} habilidades`);

  console.log('\n✅ Migraciones completadas');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Error en migraciones:', err.message);
  process.exit(1);
});
