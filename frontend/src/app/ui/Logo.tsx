// Logo de VoluntariAR (DESIGN.md → Logo): una "V" de trazo grueso, blanca, sobre un cuadrado `brand`
// con el radio de las organizaciones (28 %). Reemplaza al corazón, que queda solo para "me gusta".

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center bg-brand flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '28%' }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6l7 12 7-12" />
      </svg>
    </span>
  );
}

export function Logo({ size = 28, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {withWord && <span className="text-[18px] font-extrabold tracking-[-0.4px] text-ink">VoluntariAR</span>}
    </span>
  );
}
