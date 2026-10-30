// src/app/components/NGOTransparency.tsx — "Datos de transparencia" de una ONG (§285).
//
// Pedido en la entrevista a FONBEC (la confianza se gana con balances públicos y la personería al día) y en la
// encuesta (el 65 % pidió verificar a las ONG). Los datos los carga la propia ONG: la sección lo dice, para no hacerlos
// pasar por una verificación que la plataforma no hace. Sin datos, no se muestra.
import { ExternalLink, ShieldCheck } from 'lucide-react';

export function NGOTransparency({ cuit, url }: { cuit?: string | null; url?: string | null }) {
  if (!cuit && !url) return null;
  return (
    <section aria-labelledby="transparencia" className="mx-4 mb-4 rounded-xl border border-hairline bg-surface p-4 flex flex-col gap-2">
      <h2 id="transparencia" className="flex items-center gap-2 text-[15px] font-bold">
        <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />Datos de transparencia
      </h2>
      {cuit && <p className="text-[13px] text-ink-soft">CUIT <span className="font-semibold text-ink">{cuit}</span></p>}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline underline-offset-2">
          Ver balances y documentos<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
        </a>
      )}
      <p className="text-xs text-ink-muted">Los carga la organización; VoluntariAR no los verifica.</p>
    </section>
  );
}
