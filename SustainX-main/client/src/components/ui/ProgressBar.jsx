// Simple accessible progress bar. `tone` drives color only; label carries meaning.
export default function ProgressBar({ value, max = 100, tone, label }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="progress-wrap">
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <div className={`progress-fill progress-fill-${tone || 'primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}