// Dependency-free SVG charts with proper empty/loading handling and tooltips.

export default function ChartCard({ title, subtitle, children, loading, empty, emptyHint, actions, tone = 'primary' }) {
  return (
    <section className={`chart-card chart-card-${tone}`}>
      <div className="chart-card-head">
        <div>
          <h3 className="chart-card-title">{title}</h3>
          {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="chart-card-actions">{actions}</div>}
      </div>
      <div className="chart-card-body">
        {loading ? (
          <div className="chart-loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton skeleton-bar" style={{ height: `${[70, 45, 60, 35][i]}%` }} />
            ))}
          </div>
        ) : empty ? (
          <div className="chart-empty">
            <div className="state-desc">{emptyHint || 'No data for this period yet.'}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}