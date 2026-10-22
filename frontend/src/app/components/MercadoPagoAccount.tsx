// src/app/components/MercadoPagoAccount.tsx
//
// Marketplace (PROJECT_ANALYSIS.md §218): la ONG vincula su cuenta de Mercado Pago para que las donaciones a sus
// proyectos le lleguen a ella. Sin cuenta vinculada no recibe donaciones (decisión del usuario, §215).
//   - MercadoPagoAccountSection: en el perfil de la ONG (ancla #mercadopago). "Vincular" pide la URL al backend y
//     manda a Mercado Pago; la vuelta la atiende MercadoPagoReturn (/ngo/mercadopago/vuelta).
//   - MercadoPagoBanner: el cartel del panel, solo si falta vincular o hay que volver a hacerlo.
// La confirmación de "Desvincular" es en la página: nada de window.confirm.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AlertTriangle, CheckCircle, Loader2, Wallet } from 'lucide-react';
import { api, ApiError, MpAccountState } from '../../lib/api';
import { InlineError } from './LoadError';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'No pudimos conectarnos con el servidor. Revisá tu conexión.';

export function MercadoPagoAccountSection({ go = (url: string) => window.location.assign(url) }: { go?: (url: string) => void }) {
  const [data, setData] = useState<MpAccountState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try { setData(await api.ngos.mercadopago.get()); }
    catch (err) { setLoadError(errorText(err)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // El cartel del panel enlaza a /ngo/profile#mercadopago, pero react-router no hace scroll al ancla y esta sección
  // aparece después de cargar: el scroll se hace acá, una vez, cuando ya hay datos.
  const { hash } = useLocation();
  const section = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (hash !== '#mercadopago' || !data || scrolled.current) return;
    scrolled.current = true;
    section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [hash, data]);

  const connect = async () => {
    setBusy(true); setActionError('');
    try { go((await api.ngos.mercadopago.connect()).authorization_url); }
    catch (err) { setActionError(errorText(err)); setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true); setActionError('');
    try { await api.ngos.mercadopago.disconnect(); setConfirming(false); await load(); }
    catch (err) { setActionError(errorText(err)); }
    finally { setBusy(false); }
  };

  const btn = 'px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50';
  const connectButton = (label: string) => (
    <button type="button" onClick={connect} disabled={busy} className={`${btn} bg-sky-600 text-white hover:bg-sky-700`}>{label}</button>
  );

  let body: React.ReactNode = <Loader2 className="w-5 h-5 animate-spin text-gray-300" aria-label="Cargando" />;
  if (loadError) {
    body = <InlineError message={loadError} onRetry={() => { void load(); }} />;
  } else if (data && !data.account) {
    body = (
      <>
        <p className="text-sm text-gray-600">
          Vinculá la cuenta de Mercado Pago de tu ONG para que las donaciones te lleguen directamente. Mientras no la
          vincules, tus proyectos no reciben donaciones.
        </p>
        {data.oauth_available
          ? connectButton('Vincular Mercado Pago')
          : <p className="text-xs text-gray-400">La vinculación con Mercado Pago todavía no está disponible.</p>}
      </>
    );
  } else if (data?.account) {
    const a = data.account;
    const needsReconnect = a.status === 'needs_reconnect';
    body = (
      <>
        {needsReconnect ? (
          <p className="text-sm text-amber-700 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            Tu cuenta de Mercado Pago dejó de funcionar y no estás recibiendo donaciones. Volvé a vincularla.</p>
        ) : (
          <p className="text-sm text-gray-600 flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            Cuenta vinculada: recibís las donaciones de tus proyectos en tu cuenta de Mercado Pago.</p>
        )}
        <p className="text-xs text-gray-400">
          Cuenta de Mercado Pago n.º {a.mp_user_id}{a.origin === 'manual' ? ' (cargada a mano por el equipo de VoluntariAR)' : ''}
        </p>
        {confirming ? (
          <div className="bg-red-50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-red-700">Si la desvinculás, dejás de recibir donaciones hasta que vincules una cuenta otra vez.</p>
            <div className="flex gap-2">
              <button type="button" onClick={disconnect} disabled={busy} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Sí, desvincular</button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={`${btn} bg-white text-gray-600 border border-gray-200`}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {needsReconnect && data.oauth_available && connectButton('Volver a vincular')}
            <button type="button" onClick={() => setConfirming(true)} className={`${btn} bg-gray-100 text-gray-600 hover:bg-gray-200`}>Desvincular</button>
          </div>
        )}
      </>
    );
  }

  return (
    <section id="mercadopago" ref={section} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <h2 className="font-bold text-sm text-gray-900 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-sky-600" aria-hidden="true" />Donaciones con Mercado Pago
      </h2>
      {body}
      {actionError && <p role="alert" className="text-xs text-red-600">{actionError}</p>}
    </section>
  );
}

export function MercadoPagoBanner() {
  const [data, setData] = useState<MpAccountState | null>(null);
  useEffect(() => {
    let alive = true;
    api.ngos.mercadopago.get().then((d) => { if (alive) setData(d); }).catch(() => {});   // si falla, no molesta
    return () => { alive = false; };
  }, []);

  if (!data || data.account?.status === 'active') return null;
  const text = data.account
    ? 'Volvé a vincular tu cuenta de Mercado Pago: mientras tanto no recibís donaciones.'
    : 'Configurá tu cuenta de Mercado Pago para recibir donaciones en tus proyectos.';
  return (
    <div className="bg-surface border border-hairline rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-[15px] flex gap-2"><Wallet className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />{text}</p>
      <Link to="/ngo/profile#mercadopago" className="h-10 px-3.5 rounded-[10px] bg-surface-soft hover:bg-surface-pressed text-[13px] font-bold inline-flex items-center flex-shrink-0">Configurar</Link>
    </div>
  );
}
