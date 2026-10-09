// Skeleton loading primitives.
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

// Full panel skeleton used for API-driven screens.
export function PanelSkeleton({ rows = 3, lines = 4 }) {
  return (
    <div className="skeleton-panel" aria-busy="true" aria-label="Loading">
      <Skeleton className="skeleton-title skeleton-w-40" />
      <div style={{ display: 'flex', gap: '1rem' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1 }}>
            <Skeleton className="skeleton-rect" style={{ height: 72 }} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <Skeleton className="skeleton-rect" style={{ height: 56, marginBottom: '.75rem' }} />
          {Array.from({ length: lines }).map((_, j) => (
            <Skeleton key={j} className="skeleton-text" />
          ))}
          <div style={{ marginBottom: '1rem' }} />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;