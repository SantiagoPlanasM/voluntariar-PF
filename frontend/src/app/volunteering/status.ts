// src/app/volunteering/status.ts — cómo se nombra un voluntariado que ya no está activo. Lo usan el panel de la ONG
// y el de la empresa (antes cada uno tenía lo suyo, y el de la ONG decía "Completado" también para un cancelado; §256).
export const PROJECT_STATUS_LABEL: Record<string, string> = { completed: 'Finalizado', cancelled: 'Cancelado' };
