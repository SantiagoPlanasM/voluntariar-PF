// src/lib/useLatestRequest.ts
//
// "Solo vale la respuesta del último pedido" (REVISION F15, PROJECT_ANALYSIS.md §83 y §89). Una pantalla que
// carga según un parámetro de la URL (o que recarga después de una acción, o con "Reintentar") puede tener
// varios pedidos en vuelo; si uno viejo responde último, pisaba al actual (otro proyecto, otra ONG…).
//
// Uso:
//   const latest = useLatestRequest();
//   const load = async () => {
//     const req = latest.start();
//     const data = await api.algo();
//     if (!latest.isLatest(req)) return;   // también en catch y finally
//     setData(data);
//   };
import { useMemo, useRef } from 'react';

export function useLatestRequest() {
  const last = useRef(0);
  return useMemo(() => ({
    /** Marca el comienzo de un pedido nuevo; los anteriores dejan de ser "el último". */
    start: () => ++last.current,
    /** ¿`req` sigue siendo el último pedido? Si no, su respuesta (o su error) se descarta. */
    isLatest: (req: number) => req === last.current,
  }), []);
}
