// Lightweight SVG line / area chart. points: [{label, value}]
export default function LineChart({ points = [], height = 180, stroke = 'var(--clr-green)', fill = true, valueFormatter = (v) => v, name = 'value' }) {
  if (points.length < 2) return null;
  const w = 360;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = w / Math.max(points.length - 1, 1);
  const Y = (v) => height - 24 - (v / max) * (height - 40);
  const coords = points.map((p, i) => [i * stepX, Y(p.value)]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <div className="linechart-wrap" role="img" aria-label={`Line chart of ${name}`}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={height - (height - 24) * f - 12} y2={height - (height - 24) * f - 12} className="chart-gridline" />
        ))}
        {fill && <path d={area} className="chart-area" />}
        <path d={line} className="chart-line" fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} className="chart-dot">
            <title>{`${points[i].label}: ${valueFormatter(points[i].value)}`}</title>
          </circle>
        ))}
        {/* X labels — only show every other one when dense */}
        {points.map((p, i) => {
          if (points.length > 8 && i % 2 !== 0) return null;
          const [x] = coords[i];
          return (
            <text key={i} x={x} y={height - 4} textAnchor="middle" className="chart-axis-label">
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}