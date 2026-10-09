// Lightweight SVG donut chart with a legend. segments: [{label, value, tone}]
export default function DonutChart({ segments = [], size = 160, thickness = 22, center, valueFormatter = (v) => v }) {
  if (!segments.length) return null;
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  // Precompute pure segment descriptors (dash length + dash offset).
  const segData = segments.reduce((acc, s, i) => {
    const dash = ((s.value || 0) / total) * circ;
    const dashOffset = i === 0 ? 0 : acc[i - 1].dashOffset + acc[i - 1].dash;
    acc.push({ ...s, dash, dashOffset });
    return acc;
  }, []);

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        {segData.map((s, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            className={`chart-donut chart-donut-${s.tone || 'primary'}`}
            strokeWidth={thickness}
            strokeDasharray={`${Math.max(s.dash - 2, 0)} ${circ}`}
            strokeDashoffset={-s.dashOffset}
          >
            <title>{`${s.label}: ${valueFormatter(s.value)}`}</title>
          </circle>
        ))}
        <circle cx={c} cy={c} r={r - thickness * 0.6} className="chart-donut-hole" />
      </svg>
      <div className="donut-center">
        <div className="donut-center-value">{center ?? valueFormatter(total)}</div>
        <div className="donut-center-label">Total</div>
      </div>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div className="donut-legend-item" key={i}>
            <span className={`legend-dot legend-dot-${s.tone || 'primary'}`} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value">{valueFormatter(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}