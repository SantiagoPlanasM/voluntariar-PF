// src/app/components/MercadoPagoReturn.tsx
//
// /ngo/mercadopago/vuelta (Marketplace, PROJECT_ANALYSIS.md §218): adonde vuelve la ONG desde Mercado Pago con
// `?code=…&state=…`. Los manda al backend con su sesión (POST /ngos/me/mercadopago/callback), que comprueba el state y
// cambia el code por los tokens. El code sirve UNA vez: un ref evita el segundo pedido del efecto en StrictMode.
// Sin code o sin state (por ejemplo, la ONG no autorizó) no se llama al backend.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';

export function MercadoPagoReturn() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');
  const valid = Boolean(code && state);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>(valid ? 'loading' : 'error');
  const [error, setError] = useState(
    valid ? '' : params.get('error') ? 'No autorizó la vinculación en Mercado Pago.' : 'El link de vuelta no es válido.');
  const sent = useRef(false);

  useEffect(() => {
    if (!code || !state || sent.current) return;
    sent.current = true;
    api.ngos.mercadopago.callback(code, state)
      .then(() => setStatus('done'))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'No pudimos conectarnos con el servidor. Revisá tu conexión.');
        setStatus('error');
      });
  }, [code, state]);

  const link = 'px-4 py-2 rounded-xl text-sm font-semibold transition-colors';
  let content: React.ReactNode;
  if (status === 'loading') {
    content = <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Vinculando tu cuenta…</p>;
  } else if (status === 'done') {
    content = (
      <>
        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" aria-hidden="true" />
        <h1 className="text-lg font-bold text-gray-900">Tu cuenta de Mercado Pago quedó vinculada</h1>
        <p className="text-sm text-gray-600">Tus proyectos ya pueden recibir donaciones, y la plata te llega a esa cuenta.</p>
        <Link to="/ngo/profile" className={`${link} bg-emerald-600 text-white hover:bg-emerald-700 inline-block`}>Ir a mi perfil</Link>
      </>
    );
  } else {
    content = (
      <>
        <XCircle className="w-10 h-10 text-red-400 mx-auto" aria-hidden="true" />
        <h1 className="text-lg font-bold text-gray-900">No se pudo vincular la cuenta</h1>
        <p className="text-sm text-gray-600">{error}</p>
        <Link to="/ngo/profile#mercadopago" className={`${link} bg-gray-100 text-gray-700 hover:bg-gray-200 inline-block`}>Volver a intentar</Link>
      </>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16 max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-3">{content}</div>
    </div>
  );
}
