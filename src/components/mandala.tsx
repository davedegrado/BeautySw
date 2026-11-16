/** Mandala geometrico a linee sottili, generato proceduralmente. */
export function Mandala({ className = "", petals = 16, spin = false, stroke = 0.35 }: { className?: string; petals?: number; spin?: boolean; stroke?: number }) {
  const rot = (i: number, n = petals) => `rotate(${(360 / n) * i} 100 100)`;
  const idx = Array.from({ length: petals }, (_, i) => i);
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth={stroke} className={`${className} ${spin ? "animate-spin-slow" : ""}`} aria-hidden>
      <circle cx="100" cy="100" r="98" />
      <circle cx="100" cy="100" r="94" strokeDasharray="0.6 3" />
      <circle cx="100" cy="100" r="72" />
      <circle cx="100" cy="100" r="46" />
      <circle cx="100" cy="100" r="22" />
      <circle cx="100" cy="100" r="8" />
      {idx.map((i) => (
        <g key={i} transform={rot(i)}>
          <path d="M100 6 C112 34 112 50 100 72 C88 50 88 34 100 6Z" />
          <path d="M100 28 C106 42 106 56 100 72 C94 56 94 42 100 28Z" />
          <circle cx="100" cy="3.5" r="1.1" />
        </g>
      ))}
      {idx.map((i) => (
        <g key={`b${i}`} transform={`rotate(${(360 / petals) * (i + 0.5)} 100 100)`}>
          <path d="M100 30 C108 44 108 58 100 72 C92 58 92 44 100 30Z" />
          <path d="M100 54 C104 62 104 70 100 78 C96 70 96 62 100 54Z" />
          <line x1="100" y1="78" x2="100" y2="92" />
        </g>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={`c${i}`} transform={rot(i, 8)}>
          <path d="M100 54 C107 66 107 78 100 92 C93 78 93 66 100 54Z" />
          <path d="M100 78 L104 86 L100 94 L96 86Z" />
        </g>
      ))}
      <polygon points="100,80 117.3,90 117.3,110 100,120 82.7,110 82.7,90" />
      <polygon points="100,84 113.9,108 86.1,108" />
      <polygon points="100,116 86.1,92 113.9,92" />
    </svg>
  );
}

export function Logo({ name = "Aurea", light = false, small = false }: { name?: string; light?: boolean; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mandala className={`${small ? "h-7 w-7" : "h-9 w-9"} text-gold`} petals={8} stroke={1.6} />
      <span className={`font-serif uppercase tracking-[0.32em] ${small ? "text-base" : "text-xl"} ${light ? "text-ivory" : "text-ink"}`}>{name}</span>
    </span>
  );
}
