// Analytics adapters: backend response → chart-ready points.
// Every transform is empty-safe (empty DB renders valid zero-state charts,
// never NaN/undefined). Weekly trend is aggregated client-side from REAL
// complaint createdAt values — no fabricated series.

export function toBarPoints(rows, { labelKey = 'block', valueKey = 'total', tone = 'primary' } = {}) {
  return (rows || []).map((r) => ({
    label: String(r?.[labelKey] ?? '—'),
    value: Number(r?.[valueKey]) || 0,
    tone,
  }));
}

export function toStatusSegments(src = {}) {
  // Accepts /stats/dashboard (pending/assigned/progress/done/reopened/rejected)
  // or /analytics/overview complaints (pending/inProgress/resolved/...).
  const c = src?.complaints || src || {};
  const num = (v) => Number(v) || 0;
  return [
    { label: 'Pending', value: num(c.pending), tone: 'info' },
    { label: 'Assigned', value: num(c.assigned), tone: 'info' },
    { label: 'In Progress', value: num(c.inProgress ?? c.progress), tone: 'warning' },
    { label: 'Resolved', value: num(c.resolved ?? c.done), tone: 'success' },
    { label: 'Reopened', value: num(c.reopened), tone: 'warning' },
    { label: 'Rejected', value: num(c.rejected), tone: 'danger' },
  ];
}

// Last-7-days report counts from real complaint records (frontend-only
// aggregation of API data).
export function weeklyTrendFromComplaints(list) {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: 0 });
  }
  (list || []).forEach((c) => {
    if (!c?.createdAt) return;
    const key = new Date(c.createdAt).toISOString().slice(0, 10);
    const slot = days.find((d) => d.key === key);
    if (slot) slot.value += 1;
  });
  return days.map(({ label, value }) => ({ label, value }));
}

export function safeRate(numer, denom) {
  const n = Number(numer) || 0;
  const d = Number(denom) || 0;
  if (d <= 0) return 0;
  return Number(((n / d) * 100).toFixed(1));
}
