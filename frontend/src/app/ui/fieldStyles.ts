// Estilo de los campos de "Editar perfil" (ONG, empresa y voluntario), antes copiado en las tres pantallas (§286).
// Visto en producción: con `border-transparent` sobre el mismo fondo que la tarjeta, el campo en reposo no se veía (solo
// el que tenía el foco). Ahora tiene borde `hairline` siempre y `ink` con el foco.
export const PROFILE_FIELD =
  'w-full h-12 px-3.5 rounded-[10px] bg-surface-soft text-[15px] border-[1.5px] border-hairline focus:bg-surface focus:border-ink outline-none';
