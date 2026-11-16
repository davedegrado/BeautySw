/** Grafici SVG leggeri, senza dipendenze, nello stile del brand. */
export function BarChart({ data, format = (v) => String(v), height = 200, width = 600 }: { data: { label: string; value: number; title?: string }[]; format?: (v: number) => string; height?: number; width?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = width;
  const pad = { top: 12, bottom: 22, left: 4, right: 4 };
  const innerH = height - pad.top - pad.bottom;
  const slot = (W - pad.left - pad.right) / Math.max(1, data.length);
  const bw = Math.min(26, slot * 0.62);
  const every = Math.ceil(data.length / (W >= 500 ? 10 : 5));
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Grafico a barre">
      <defs>
        <linearGradient id="goldbar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ead9b0" />
          <stop offset="1" stopColor="#b3935a" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.left} x2={W - pad.right} y1={pad.top + innerH * (1 - f)} y2={pad.top + innerH * (1 - f)} stroke="#f3eee2" strokeWidth="1" />
      ))}
      <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="#e7dfce" />
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max(2, (d.value / max) * innerH) : 0;
        const x = pad.left + slot * i + (slot - bw) / 2;
        return (
          <g key={i}>
            <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent">
              <title>{`${d.title ?? d.label}: ${format(d.value)}`}</title>
            </rect>
            <rect x={x} y={pad.top + innerH - h} width={bw} height={h} rx="2" fill="url(#goldbar)" className="pointer-events-none" />
            {i % every === 0 && (
              <text x={pad.left + slot * i + slot / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#74747e">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function RankList({ items, unit = "" }: { items: { label: string; value: number; color?: string }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-smoke">Nessun dato nel periodo selezionato.</p>;
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              <span className="mr-2 font-serif text-lg text-gold-deep">{i + 1}</span>
              {it.label}
            </span>
            <span className="shrink-0 text-smoke">
              {it.value}
              {unit}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? "linear-gradient(90deg,#ead9b0,#b3935a)" }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
