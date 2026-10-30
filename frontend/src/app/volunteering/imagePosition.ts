// El encuadre de la foto del voluntariado (§297): qué parte se ve cuando la tarjeta la recorta. Lo elige la ONG al
// subirla (ProjectPhotoField); lo usan la tarjeta de Explorar, la del inicio y la cabecera del detalle.
import type { ImagePosition } from '../../lib/api';

const CLASS: Record<ImagePosition, string> = { top: 'object-top', center: 'object-center', bottom: 'object-bottom' };

export const imagePositionClass = (position?: ImagePosition) =>
  (position && Object.hasOwn(CLASS, position) ? CLASS[position] : 'object-center');

export const IMAGE_POSITIONS: { key: ImagePosition; label: string }[] = [
  { key: 'top', label: 'Arriba' },
  { key: 'center', label: 'Centro' },
  { key: 'bottom', label: 'Abajo' },
];
