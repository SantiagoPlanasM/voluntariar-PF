// scripts/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function seed() {
  console.log('🌱 Insertando datos de prueba...');
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const users = [
    { id: 'user-vol-1', name: 'María García', email: 'maria@example.com', password: hash('Password1'), role: 'volunteer' },
    { id: 'user-vol-2', name: 'Juan Pérez', email: 'juan@example.com', password: hash('Password1'), role: 'volunteer' },
    { id: 'user-vol-3', name: 'Lucía Fernández', email: 'lucia@example.com', password: hash('Password1'), role: 'volunteer' },
    { id: 'user-ngo-1', name: 'Admin Sustentando', email: 'admin@sustentando.org', password: hash('Password1'), role: 'ngo' },
    { id: 'user-ngo-2', name: 'Admin GreenCba', email: 'admin@greencba.org', password: hash('Password1'), role: 'ngo' },
    { id: 'user-ngo-3', name: 'Admin Banco Alimentos', email: 'admin@bancoalimentos.org', password: hash('Password1'), role: 'ngo' },
    { id: 'user-ngo-4', name: 'Admin TechSocial', email: 'admin@techsocial.org', password: hash('Password1'), role: 'ngo' },
    { id: 'user-comp-1', name: 'Admin TechCorp', email: 'admin@techcorp.com', password: hash('Password1'), role: 'company' },
  ];

  for (const u of users) {
    const exists = await db.get('SELECT id FROM users WHERE id=$1', [u.id]);
    if (!exists) {
      const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`;
      await db.run(
        `INSERT INTO users (id, name, email, password, role, avatar) VALUES ($1,$2,$3,$4,$5,$6)`,
        [u.id, u.name, u.email, u.password, u.role, avatar]
      );
    }
  }
  console.log('  ✅ Usuarios');

  // ── Perfiles de voluntarios ───────────────────────────────────────────────
  const voluntarios = [
    { user_id: 'user-vol-1', nombre: 'María', apellido: 'García', ubicacion: 'Córdoba Capital' },
    { user_id: 'user-vol-2', nombre: 'Juan', apellido: 'Pérez', ubicacion: 'Córdoba Capital' },
    { user_id: 'user-vol-3', nombre: 'Lucía', apellido: 'Fernández', ubicacion: 'Alta Gracia, Córdoba' },
  ];
  for (const v of voluntarios) {
    const exists = await db.get('SELECT id FROM voluntarios WHERE user_id=$1', [v.user_id]);
    if (!exists) {
      const u = await db.get('SELECT avatar FROM users WHERE id=$1', [v.user_id]);
      await db.run(
        `INSERT INTO voluntarios (user_id, nombre, apellido, ubicacion, foto_perfil) VALUES ($1,$2,$3,$4,$5)`,
        [v.user_id, v.nombre, v.apellido, v.ubicacion, u?.avatar || null]
      );
    }
  }
  console.log('  ✅ Perfiles voluntarios');

  // ── ONGs ──────────────────────────────────────────────────────────────────
  const ngos = [
    {
      id: 'ngo-1', user_id: 'user-ngo-1', nombre: 'Sustentando',
      descripcion: 'Organización dedicada a la reforestación y educación ambiental en Córdoba.',
      mision: 'Reforestar 10.000 hectáreas para 2030.', founded: '2015',
      ubicacion: 'Córdoba, Argentina', followers: 1240
    },
    {
      id: 'ngo-2', user_id: 'user-ngo-2', nombre: 'Green Córdoba',
      descripcion: 'Conectamos ciudadanos comprometidos con el planeta.',
      mision: 'Ciudad más verde, ciudadanos más felices.', founded: '2018',
      ubicacion: 'Córdoba, Argentina', followers: 890
    },
    {
      id: 'ngo-3', user_id: 'user-ngo-3', nombre: 'Banco de Alimentos Córdoba',
      descripcion: 'Rescatamos alimentos y los distribuimos a familias en vulnerabilidad.',
      mision: 'Cero desperdicio, cero hambre en Córdoba.', founded: '2010',
      ubicacion: 'Córdoba, Argentina', followers: 3400
    },
    {
      id: 'ngo-4', user_id: 'user-ngo-4', nombre: 'TechSocial',
      descripcion: 'Usamos la tecnología como herramienta de inclusión social.',
      mision: 'Reducir la brecha digital en barrios vulnerables.', founded: '2020',
      ubicacion: 'Córdoba, Argentina', followers: 620
    },
  ];

  for (const n of ngos) {
    const exists = await db.get('SELECT id FROM ngos WHERE id=$1', [n.id]);
    if (!exists) {
      const u = await db.get('SELECT avatar FROM users WHERE id=$1', [n.user_id]);
      await db.run(
        `INSERT INTO ngos (id, user_id, nombre, foto_perfil, descripcion, mision, founded, ubicacion, followers)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [n.id, n.user_id, n.nombre, u?.avatar || null, n.descripcion, n.mision, n.founded, n.ubicacion, n.followers]
      );
    }
  }
  console.log('  ✅ ONGs');

  // ── Empresa ───────────────────────────────────────────────────────────────
  const empExists = await db.get('SELECT id FROM empresas WHERE user_id=$1', ['user-comp-1']);
  if (!empExists) {
    const u = await db.get('SELECT avatar FROM users WHERE id=$1', ['user-comp-1']);
    await db.run(
      `INSERT INTO empresas (user_id, nombre, industria, foto_perfil) VALUES ($1,$2,$3,$4)`,
      ['user-comp-1', 'TechCorp', 'Tecnología', u?.avatar || null]
    );
  }
  console.log('  ✅ Empresa');

  // ── Obtener IDs de categorías ─────────────────────────────────────────────
  const getCat = async (nombre) => {
    const c = await db.get('SELECT id FROM categorias WHERE nombre=$1', [nombre]);
    return c?.id || null;
  };
  const getRol = async (nombre) => {
    const r = await db.get('SELECT id FROM roles WHERE nombre=$1', [nombre]);
    return r?.id || null;
  };

  // ── Proyectos ─────────────────────────────────────────────────────────────
  const projects = [
    {
      id: 'proj-1', ngo_id: 'ngo-1',
      titulo: 'Reforestación Urbana',
      descripcion: 'Ayudanos a plantar 500 árboles nativos en el Parque Sarmiento.',
      descripcion_full: 'Plantación de especies nativas como tipa, lapacho y cebil. Incluye capacitación previa y herramientas.',
      foto_perfil: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=600&fit=crop',
      tipo: 'fugaz', status: 'active', ubicacion: 'Parque Sarmiento, Córdoba',
      duracion: '2 días (sábado y domingo)', cupos: 50, cupos_ocupados: 23,
      meta_financiera: 15000, recaudado: 8500, costo: 0,
      categoria: 'Medio Ambiente',
      roles: ['Coordinador', 'Voluntario general', 'Fotógrafo'],
      requisitos: ['Ropa cómoda y cerrada', 'Disponibilidad el fin de semana', 'Traer hidratación'],
    },
    {
      id: 'proj-2', ngo_id: 'ngo-2',
      titulo: 'Limpieza del Río Suquía',
      descripcion: 'Jornada de limpieza en ambas márgenes del Río Suquía.',
      descripcion_full: 'Clasificación de residuos, limpieza de vegetación invasora y registro fotográfico.',
      foto_perfil: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&h=600&fit=crop',
      tipo: 'fugaz', status: 'active', ubicacion: 'Río Suquía, Córdoba',
      duracion: '1 día (8hs a 16hs)', cupos: 80, cupos_ocupados: 67,
      meta_financiera: 8000, recaudado: 5600, costo: 0,
      categoria: 'Medio Ambiente',
      roles: ['Voluntario general', 'Comunicador'],
      requisitos: ['Ropa que pueda ensuciarse', 'Protector solar'],
    },
    {
      id: 'proj-3', ngo_id: 'ngo-3',
      titulo: 'Maratón Solidaria de Donaciones',
      descripcion: 'Jornada de recolección y clasificación de alimentos donados.',
      descripcion_full: 'Traslado, pesaje, clasificación y armado de cajas familiares para distribución.',
      foto_perfil: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop',
      tipo: 'fugaz', status: 'active', ubicacion: 'Galpón Central, Córdoba',
      duracion: '1 día (7hs a 15hs)', cupos: 60, cupos_ocupados: 34,
      meta_financiera: 5000, recaudado: 4200, costo: 0,
      categoria: 'Alimentación',
      roles: ['Voluntario general', 'Conductor'],
      requisitos: ['Fuerza física para carga', 'Puntualidad'],
    },
    {
      id: 'proj-4', ngo_id: 'ngo-4',
      titulo: 'Hackatón Social: Apps para el Bien',
      descripcion: 'Fin de semana de desarrollo para crear soluciones tecnológicas sociales.',
      descripcion_full: '48hs donde equipos crean prototipos para resolver problemas concretos de la comunidad.',
      foto_perfil: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop',
      tipo: 'fugaz', status: 'active', ubicacion: 'Universidad Blas Pascal, Córdoba',
      duracion: '48 horas (viernes a domingo)', cupos: 40, cupos_ocupados: 28,
      meta_financiera: 20000, recaudado: 14000, costo: 0,
      categoria: 'Tecnología',
      roles: ['Programador', 'Técnico'],
      requisitos: ['Laptop propia', 'Disponibilidad completa'],
    },
    {
      id: 'proj-5', ngo_id: 'ngo-1',
      titulo: 'Censo de Árboles Urbanos',
      descripcion: 'Relevamiento y mapeo de árboles en el microcentro de Córdoba.',
      descripcion_full: 'Registro en app del estado de cada árbol para el primer mapa forestal digital de Córdoba.',
      foto_perfil: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop',
      tipo: 'fugaz', status: 'active', ubicacion: 'Microcentro, Córdoba',
      duracion: '1 día (4 horas)', cupos: 30, cupos_ocupados: 12,
      meta_financiera: 3000, recaudado: 1800, costo: 0,
      categoria: 'Medio Ambiente',
      roles: ['Voluntario general', 'Fotógrafo'],
      requisitos: ['Smartphone con batería cargada', 'Calzado cómodo'],
    },
    {
      id: 'proj-6', ngo_id: 'ngo-3',
      titulo: 'Cocina Comunitaria de Navidad',
      descripcion: '500 porciones de comida caliente para familias vulnerables en fiestas.',
      descripcion_full: 'Jornada de cocina masiva: preparación, cocción, emplatado y reparto en puntos del sur de Córdoba.',
      foto_perfil: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
      tipo: 'fugaz', status: 'active', ubicacion: 'Comedor Central, Barrio Müller',
      duracion: '1 día (8hs a 20hs)', cupos: 35, cupos_ocupados: 20,
      meta_financiera: 18000, recaudado: 9500, costo: 0,
      categoria: 'Alimentación',
      roles: ['Cocinero', 'Voluntario general', 'Coordinador'],
      requisitos: ['Disponibilidad 24 de diciembre', 'Buena predisposición'],
    },
    {
      id: 'proj-7', ngo_id: 'ngo-1',
      titulo: 'Huerta Comunitaria Barrio Güemes',
      descripcion: 'Construcción y mantenimiento de una huerta orgánica comunitaria.',
      descripcion_full: 'Huerta de 200m² con agroecología urbana, compostaje y distribución vecinal.',
      foto_perfil: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop',
      tipo: 'sostenido', status: 'active', ubicacion: 'Barrio Güemes, Córdoba',
      horas_semanales: 4, cupos: 20, cupos_ocupados: 8,
      meta_financiera: 25000, recaudado: 12000, costo: 0,
      categoria: 'Alimentación',
      roles: ['Educador', 'Voluntario general'],
      requisitos: ['Compromiso mínimo 3 meses', 'Disponibilidad los sábados'],
    },
    {
      id: 'proj-8', ngo_id: 'ngo-2',
      titulo: 'Reciclaje Educativo en Escuelas',
      descripcion: 'Talleres mensuales de educación ambiental en escuelas primarias.',
      descripcion_full: 'Talleres participativos sobre separación en origen y economía circular en 8 escuelas.',
      foto_perfil: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&h=600&fit=crop',
      tipo: 'sostenido', status: 'active', ubicacion: 'Escuelas de Córdoba Capital',
      horas_semanales: 6, cupos: 15, cupos_ocupados: 5,
      meta_financiera: 10000, recaudado: 3000, costo: 0,
      categoria: 'Educación',
      roles: ['Educador', 'Comunicador'],
      requisitos: ['Disponibilidad en horario escolar', 'Compromiso mínimo 4 meses'],
    },
    {
      id: 'proj-9', ngo_id: 'ngo-4',
      titulo: 'Talleres de Programación para Jóvenes',
      descripcion: 'Clases semanales de programación para adolescentes de barrios vulnerables.',
      descripcion_full: 'Scratch, Python y Arduino para jóvenes de 13 a 18 años de Müller, Liceo y Bella Vista.',
      foto_perfil: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop',
      tipo: 'sostenido', status: 'active', ubicacion: 'Barrios Müller y Liceo, Córdoba',
      horas_semanales: 5, cupos: 12, cupos_ocupados: 7,
      meta_financiera: 30000, recaudado: 18000, costo: 0,
      categoria: 'Tecnología',
      roles: ['Programador', 'Educador'],
      requisitos: ['Conocimientos de programación', 'Compromiso mínimo 6 meses'],
    },
    {
      id: 'proj-10', ngo_id: 'ngo-3',
      titulo: 'Red de Apoyo Escolar',
      descripcion: 'Clases de apoyo gratuitas para niños de comedores comunitarios.',
      descripcion_full: 'Matemáticas, lengua, ciencias e inglés dos veces por semana en comedores del sur.',
      foto_perfil: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=600&fit=crop',
      tipo: 'sostenido', status: 'active', ubicacion: 'Comedores del sur (Remoto disponible)',
      horas_semanales: 4, cupos: 25, cupos_ocupados: 14,
      meta_financiera: 12000, recaudado: 7800, costo: 0,
      categoria: 'Educación',
      roles: ['Educador'],
      requisitos: ['Nivel universitario en curso o completo', 'Disponibilidad martes y jueves'],
    },
    {
      id: 'proj-11', ngo_id: 'ngo-4',
      titulo: 'Digitalización de ONGs',
      descripcion: 'Acompañamos pequeñas organizaciones sociales para incorporar herramientas digitales.',
      descripcion_full: 'Diagnóstico, implementación de Google Workspace y capacitación al equipo de la ONG.',
      foto_perfil: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
      tipo: 'sostenido', status: 'active', ubicacion: 'Remoto + visitas en Córdoba',
      horas_semanales: 3, cupos: 10, cupos_ocupados: 4,
      meta_financiera: 8000, recaudado: 2000, costo: 0,
      categoria: 'Tecnología',
      roles: ['Técnico', 'Comunicador'],
      requisitos: ['Conocimientos de herramientas digitales', 'Compromiso 4 meses'],
    },
    {
      id: 'proj-12', ngo_id: 'ngo-2',
      titulo: 'Monitoreo de Calidad del Aire',
      descripcion: 'Red ciudadana de sensores para mapear la calidad del aire en Córdoba.',
      descripcion_full: 'Instalación de sensores de bajo costo en hogares para crear el primer mapa de calidad del aire.',
      foto_perfil: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&h=600&fit=crop',
      tipo: 'sostenido', status: 'active', ubicacion: 'Toda la Ciudad de Córdoba',
      horas_semanales: 2, cupos: 50, cupos_ocupados: 22,
      meta_financiera: 40000, recaudado: 25000, costo: 0,
      categoria: 'Medio Ambiente',
      roles: ['Técnico', 'Comunicador', 'Voluntario general'],
      requisitos: ['Acceso a internet en el hogar', 'Tener smartphone', 'Compromiso mínimo 6 meses'],
    },
  ];

  for (const p of projects) {
    const exists = await db.get('SELECT id FROM projects WHERE id=$1', [p.id]);
    if (!exists) {
      await db.run(
        `INSERT INTO projects (id, ngo_id, titulo, descripcion, descripcion_full, foto_perfil,
          tipo, status, ubicacion, duracion, cupos, cupos_ocupados, meta_financiera, recaudado,
          costo, horas_semanales)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [p.id, p.ngo_id, p.titulo, p.descripcion, p.descripcion_full, p.foto_perfil,
        p.tipo, p.status, p.ubicacion, p.duracion || null,
        p.cupos, p.cupos_ocupados, p.meta_financiera, p.recaudado, p.costo,
        p.horas_semanales || null]
      );

      // Categoría
      const catId = await getCat(p.categoria);
      if (catId) {
        await db.run(
          'INSERT INTO project_categorias (project_id, categoria_id) VALUES ($1,$2)',
          [p.id, catId]
        ).catch(() => { });
      }

      // Roles
      for (const rolNombre of (p.roles || [])) {
        const rolId = await getRol(rolNombre);
        if (rolId) {
          await db.run(
            'INSERT INTO project_roles (project_id, rol_id) VALUES ($1,$2)',
            [p.id, rolId]
          ).catch(() => { });
        }
      }

      // Requisitos
      for (const desc of (p.requisitos || [])) {
        await db.run(
          'INSERT INTO requisitos (project_id, descripcion) VALUES ($1,$2)',
          [p.id, desc]
        );
      }
    }
  }
  console.log('  ✅ Proyectos (12)');

  // ── Inscripciones ─────────────────────────────────────────────────────────
  const enrollments = [
    { user_id: 'user-vol-1', project_id: 'proj-1', status: 'approved' },
    { user_id: 'user-vol-1', project_id: 'proj-7', status: 'approved' },
    { user_id: 'user-vol-1', project_id: 'proj-9', status: 'pending' },
    { user_id: 'user-vol-2', project_id: 'proj-1', status: 'pending' },
    { user_id: 'user-vol-2', project_id: 'proj-3', status: 'approved' },
    { user_id: 'user-vol-2', project_id: 'proj-8', status: 'approved' },
    { user_id: 'user-vol-3', project_id: 'proj-4', status: 'approved' },
    { user_id: 'user-vol-3', project_id: 'proj-10', status: 'pending' },
  ];

  for (const e of enrollments) {
    const exists = await db.get(
      'SELECT id FROM enrollments WHERE user_id=$1 AND project_id=$2',
      [e.user_id, e.project_id]
    );
    if (!exists) {
      await db.run(
        `INSERT INTO enrollments (user_id, project_id, status) VALUES ($1,$2,$3)`,
        [e.user_id, e.project_id, e.status]
      );
    }
  }
  console.log('  ✅ Inscripciones');

  console.log('\n✅ Seed completado');
  console.log('\n📬 Usuarios de prueba:');
  console.log('  maria@example.com         / Password1  (voluntario)');
  console.log('  juan@example.com          / Password1  (voluntario)');
  console.log('  lucia@example.com         / Password1  (voluntario)');
  console.log('  admin@sustentando.org     / Password1  (ONG)');
  console.log('  admin@greencba.org        / Password1  (ONG)');
  console.log('  admin@bancoalimentos.org  / Password1  (ONG)');
  console.log('  admin@techsocial.org      / Password1  (ONG)');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
