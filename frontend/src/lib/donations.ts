// src/lib/donations.ts
//
// Donaciones en el frontend (PLAN_FALTANTE.md, Etapa 9, §172). Los topes y mensajes son los de
// backend/src/routes/donaciones.js (POST /api/donaciones): pesos ENTEROS de 100 a 500.000, porque monto y recaudado
// son REAL (float4 en Postgres) y con centavos el control "lo pagado coincide con lo donado" fallaría (§170).

export const DONATION_MIN = 100;
export const DONATION_MAX = 500000;
export const DONATION_PRESETS = [500, 1000, 5000];

/** Valida lo que se escribió en el campo. { amount } si sirve; si no, { error } con el mismo mensaje que el backend. */
export function checkDonationAmount(raw: string): { amount: number } | { error: string } {
  const v = raw.trim();
  if (!/^\d+$/.test(v)) return { error: 'El monto tiene que ser un número entero de pesos' };
  const amount = Number(v);
  if (amount < DONATION_MIN) return { error: 'El monto mínimo es de $100' };
  if (amount > DONATION_MAX) return { error: 'El monto máximo es de $500.000' };
  return { amount };
}

const pesos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const formatPesos = (n: number) => `$${pesos.format(n)}`;

/**
 * Lo que agrega Mercado Pago a la URL de vuelta de Checkout Pro: external_reference (el id de la donación),
 * payment_id o collection_id (el pago) y status o collection_status. Cuando no hubo pago manda el texto "null".
 * El status sirve SOLO para el texto mientras el backend sigue pendiente: nunca decide si se pagó.
 */
export function readReturnParams(search: string): { donationId: string | null; paymentId: string | null; mpStatus: string | null } {
  const q = new URLSearchParams(search);
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = q.get(k);
      if (v && v !== 'null') return v;
    }
    return null;
  };
  return {
    donationId: get('external_reference'),
    paymentId: get('payment_id', 'collection_id'),
    mpStatus: get('status', 'collection_status'),
  };
}
