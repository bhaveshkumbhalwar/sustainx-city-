import Icon from './Icon';

// KPI card summarizing ONE operational question.
// `tone` colors only the accent — status is never conveyed by color alone.
export default function StatCard({
  icon = 'chart',
  value,
  label,
  hint,
  tone = 'primary',
  loading,
}) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-icon-wrapper">
        <div className="stat-icon">
          <Icon name={icon} size={20} />
        </div>
      </div>
      <div className="stat-info">
        {loading ? (
          <div className="skeleton skeleton-text skeleton-w-40" />
        ) : (
          <div className="stat-value">{value ?? '—'}</div>
        )}
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}