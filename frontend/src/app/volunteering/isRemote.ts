// src/app/volunteering/isRemote.ts — un voluntariado remoto no tiene lugar físico: en el detalle no tiene "Cómo llegar"
// y en el mapa no tiene pin (D31, §254). Se mira la modalidad y, para los que no la tienen, si la ubicación dice
// "remoto" o "virtual". Antes vivía solo en ProjectDetails.tsx y el mapa no la usaba.
import type { Project } from '../../lib/api';

export const isRemote = (p: Pick<Project, 'modality' | 'location'>) =>
  p.modality === 'remoto' || !!p.location?.toLowerCase().includes('remoto') || !!p.location?.toLowerCase().includes('virtual');
