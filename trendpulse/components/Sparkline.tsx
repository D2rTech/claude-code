export default function Sparkline({ data, color = "#4f46e5", w = 120, h = 36, fill = true }:
  { data: number[]; color?: string; w?: number; h?: number; fill?: boolean }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="trend chart" className="overflow-visible">
      {fill && <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={color} opacity={0.1} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({ data, labels, color = "#4f46e5" }: { data: number[]; labels?: string[]; color?: string }) {
  const w = 600, h = 200, pad = 24;
  const min = 0, max = Math.max(...data) * 1.1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="area chart">
      {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={w - pad} y1={y(max * t / 1.1)} y2={y(max * t / 1.1)} stroke="#e2e8f0" />)}
      <path d={`${line} L${x(data.length - 1)} ${h - pad} L${x(0)} ${h - pad} Z`} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {labels?.map((l, i) => (i % 2 === 0 ? <text key={i} x={x(i)} y={h - 6} fontSize="10" textAnchor="middle" fill="#64748b">{l}</text> : null))}
    </svg>
  );
}
