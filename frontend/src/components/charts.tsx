// Tiny dependency-free SVG charts — themeable, rounded, friendly.

export const CHART_PALETTE = [
  "#4f46e5", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface Slice {
  label: string;
  value: number;
  color?: string;
}

/** Donut with a center label + legend. */
export function Donut({
  data,
  size = 150,
  center,
}: {
  data: Slice[];
  size?: number;
  center?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sw = Math.round(size * 0.18);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * c;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
                  strokeWidth={sw}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </g>
        {center && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="donut-center">
            {center}
          </text>
        )}
      </svg>
      <div className="chart-legend">
        {data.map((d, i) => (
          <span key={i} className="legend-item">
            <i style={{ background: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length] }} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Single progress ring with a big center label. */
export function Ring({
  value,
  max = 100,
  size = 120,
  label,
  color = "var(--primary)",
}: {
  value: number;
  max?: number;
  size?: number;
  label: string;
  color?: string;
}) {
  const sw = Math.round(size * 0.12);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
        />
      </g>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-center">
        {label}
      </text>
    </svg>
  );
}

/** Horizontal labelled bars. */
export function Bars({
  data,
  max,
  unit = "",
}: {
  data: { label: string; value: number }[];
  max?: number;
  unit?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">{d.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: `${(d.value / top) * 100}%`,
                background: CHART_PALETTE[i % CHART_PALETTE.length],
              }}
            />
          </span>
          <span className="bar-val">
            {d.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
