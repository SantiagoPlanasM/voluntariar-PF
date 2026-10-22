// src/app/components/DonationReturn.tsx
//
// /donaciones/vuelta: adonde vuelve el comprador desde Mercado Pago (PLAN_FALTANTE.md, Etapa 9, §172). Le pregunta al
// backend por la donación (external_reference) con el pago (payment_id): el backend concilia con Mercado Pago (§171).
// Lo que se muestra lo decide el BACKEND; el `status` de la URL solo cambia el texto mientras sigue "pending" (para
// decir "no se completó" en vez de "confirmando" cuando Mercado Pago avisó un rechazo o que no hubo pago).
// Mientras está pendiente, vuelve a preguntar hasta 5 veces cada 3 segundos (el aviso puede tardar) y después ofrece
// "Actualizar".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { api, ApiError, Donation } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { formatPesos, readReturnParams } from '../../lib/donations';
import { InlineError } from './LoadError';

const POLL_MS = 3000;
const MAX_TRIES = 5;
const NOT_PAID = new Set(['rejected', 'cancelled', 'failure', 'null']);

export function DonationReturn() {
  const { user, initializing, openAuthModal } = useAuth();
  const { search } = useLocation();
  const { donationId, paymentId, mpStatus } = readReturnParams(search);
  const [donation, setDonation] = useState<Donation | null>(null);
  const [notFound, setNotFound] = useState(!donationId);
  const [error, setError] = useState('');
  const tries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!donationId) return;
    tries.current += 1;
    setError('');
    try {
      const { donation: d } = await api.donaciones.get(donationId, paymentId ?? undefined);
      setDonation(d);
      if (d.status === 'pending' && tries.current < MAX_TRIES && !NOT_PAID.has(mpStatus ?? 'null')) {
        timer.current = setTimeout(load, POLL_MS);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : 'No pudimos conectarnos con el servidor. Revisá tu conexión.');
    }
  }, [donationId, paymentId, mpStatus]);

  useEffect(() => {
    if (initializing || !user || !donationId) return;
    tries.current = 0;
    load();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [initializing, user, donationId, load]);

  const refresh = () => { tries.current = MAX_TRIES - 1; load(); };   // un pedido más, sin volver a encadenar

  const box = (icon: React.ReactNode, title: string, body: React.ReactNode, actions?: React.ReactNode) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-3">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      <div className="text-sm text-gray-600">{body}</div>
      {actions && <div className="flex flex-wrap justify-center gap-2 pt-1">{actions}</div>}
    </div>
  );
  const toProject = donation?.project_id && (
    <Link to={`/project/${donation.project_id}`}
      className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
      Volver al proyecto
    </Link>
  );

  let content: React.ReactNode = <Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" aria-label="Cargando" />;
  if (initializing) {
    // se espera a saber si hay sesión
  } else if (!user) {
    content = box(<Clock className="w-10 h-10 text-gray-300" />, 'Iniciá sesión para ver tu donación',
      'Tu pago quedó registrado en Mercado Pago. Iniciá sesión con la misma cuenta para ver si se confirmó.',
      <button onClick={() => openAuthModal('Iniciá sesión para ver tu donación')}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700">Iniciar sesión</button>);
  } else if (notFound) {
    content = box(<XCircle className="w-10 h-10 text-gray-300" />, 'No encontramos esta donación',
      'Revisá que hayas iniciado sesión con la cuenta con la que donaste.',
      <Link to="/" className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700">Ir al inicio</Link>);
  } else if (error) {
    content = <InlineError message={error} onRetry={refresh} />;
  } else if (donation?.status === 'completed') {
    content = box(<CheckCircle className="w-10 h-10 text-emerald-500" />, '¡Gracias por tu donación!',
      <>Donaste <strong>{formatPesos(donation.amount)}</strong>{donation.project_title ? <> a <strong>{donation.project_title}</strong></> : null}. Gracias por apoyar este proyecto.</>,
      toProject);
  } else if (donation && (donation.status === 'failed' || donation.status === 'refunded' || NOT_PAID.has(mpStatus ?? 'null'))) {
    content = box(<XCircle className="w-10 h-10 text-red-400" />, 'El pago no se completó',
      'No se cobró nada. Podés intentarlo de nuevo desde el proyecto.', toProject);
  } else if (donation) {
    content = box(<Clock className="w-10 h-10 text-amber-400" />, 'Estamos confirmando tu pago',
      'Mercado Pago todavía no nos avisó. Suele tardar unos segundos.',
      <>
        <button onClick={refresh} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Actualizar</button>
        {toProject}
      </>);
  }

  return <div className="min-h-screen bg-gray-50 px-4 py-16 max-w-md mx-auto">{content}</div>;
}
