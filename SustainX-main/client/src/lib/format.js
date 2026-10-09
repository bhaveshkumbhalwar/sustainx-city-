// Formatting helpers used across the rebuilt frontend.
// All times are treated as LOCAL browser time (server returns ISO timestamps).

export function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Relative time: "just now", "5m ago", "3h ago", "2d ago"
export function timeAgo(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(str);
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
}

// Compact full-width percentage for progress bars (clamped 0–100)
export function clampPct(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(n))));
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Authoritative SLA display: formats the backend-provided slaRemainingMs.
// Positive → time left; negative → breached. Never recomputed from policy.
export function fmtSla(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return { label: 'Not available', breached: false };
  const n = Number(ms);
  const abs = Math.abs(n);
  const hours = Math.floor(abs / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const span = hours >= 48
    ? `${Math.floor(hours / 24)}d ${hours % 24}h`
    : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  if (n < 0) return { label: `Breached by ${span}`, breached: true };
  return { label: `${span} left`, breached: false };
}