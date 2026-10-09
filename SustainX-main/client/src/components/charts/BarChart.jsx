// Lightweight SVG bar chart. Accepts points [{label, value, tone}].
export default function BarChart({ points = [], height = 180, valueFormatter = (v) => v, name = 'value' }) {
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const chartW = Math.max(points.length * 46, 260);
  const barW = Math.min(34, (chartW / points.length) * 0.5);
  return (
    <div className="barchart-wrap" role="img" aria-label={`Bar chart of ${name}`}>
      <svg viewBox={`0 0 ${chartW} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={chartW}
            y1={height - height * f - 16}
            y2={height - height * f - 16}
            className="chart-gridline"
          />
        ))}
        {points.map((p, i) => {
          const h = Math.max(4, (p.value / max) * (height - 34));
          const x = i * (chartW / points.length) + chartW / points.length / 2 - barW / 2;
          const y = height - 16 - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} rx={5} className={`chart-bar chart-bar-${p.tone || 'primary'}`}>
                <title>{`${p.label}: ${valueFormatter(p.value)}`}</title>
              </rect>
              <text x={x + barW / 2} y={height - 4} textAnchor="middle" className="chart-axis-label">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}