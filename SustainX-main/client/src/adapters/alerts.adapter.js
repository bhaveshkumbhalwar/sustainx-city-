// Centralized operational alert model.
// Sources are REAL backend data only: notifications (iot type), bin states
// (alert flag / level / offline), complaint SLA (slaRemainingMs).
// Severity: INFO | WARNING | HIGH | CRITICAL.
// Shape: { id, type, severity, title, detail, at, link }
import { timeAgo } from '../lib/format';

const BIN_ALERT = 'BIN_OVERFLOW';
const BIN_OFFLINE = 'BIN_OFFLINE';
const SLA_WARNING = 'SLA_WARNING';
const SLA_BREACH = 'SLA_BREACH';
const CRITICAL_COMPLAINT = 'CRITICAL_COMPLAINT';

export const ALERT_TYPES = { BIN_ALERT, BIN_OFFLINE, SLA_WARNING, SLA_BREACH, CRITICAL_COMPLAINT };

const SEVERITY_ORDER = { INFO: 0, WARNING: 1, HIGH: 2, CRITICAL: 3 };

export function sortAlerts(list) {
  return [...(list || [])].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0),
  );
}

function binAlerts(bins) {
  const out = [];
  (bins || []).forEach((b) => {
    const id = b.id || b.binId;
    if (!id) return;
    if (b.online === false) {
      out.push({
        id: `offline-${id}`,
        type: BIN_OFFLINE,
        severity: 'HIGH',
        title: `Bin ${b.binId} is offline`,
        detail: `No reading since ${timeAgo(b.lastSeen || b.lastReadingAt || b.updatedAt)}. Stale bins are never treated as empty.`,
        at: b.lastSeen || b.lastReadingAt || b.updatedAt,
        link: `/admin/bins/${encodeURIComponent(b.binId)}`,
      });
      return;
    }
    if (b.alert || (b.level ?? 0) >= 80) {
      out.push({
        id: `overflow-${id}`,
        type: BIN_ALERT,
        severity: 'CRITICAL',
        title: `Bin ${b.binId} at overflow risk (${b.level ?? 0}%)`,
        detail: 'Observed sensor reading. Collection task recommended.',
        at: b.lastSeen || b.lastUpdated,
        link: `/admin/bins/${encodeURIComponent(b.binId)}`,
      });
    } else if ((b.level ?? 0) >= 70) {
      out.push({
        id: `high-${id}`,
        type: BIN_ALERT,
        severity: 'WARNING',
        title: `Bin ${b.binId} filling fast (${b.level ?? 0}%)`,
        detail: 'Observed sensor reading.',
        at: b.lastSeen || b.lastUpdated,
        link: `/admin/bins/${encodeURIComponent(b.binId)}`,
      });
    }
  });
  return out;
}

function complaintAlerts(complaints) {
  const out = [];
  (complaints || []).forEach((c) => {
    const id = c.id || c.complaintId;
    if (!id) return;
    const ms = c.slaRemainingMs;
    if (typeof ms === 'number' && ms < 0) {
      out.push({
        id: `sla-breach-${id}`,
        type: SLA_BREACH,
        severity: 'CRITICAL',
        title: `SLA breached on ${id}`,
        detail: `${c.ward || ''} · ${c.wasteType || ''}`.trim(),
        at: c.slaDeadline,
        link: '/admin/complaints',
      });
    } else if (typeof ms === 'number' && ms < 4 * 3600 * 1000) {
      out.push({
        id: `sla-risk-${id}`,
        type: SLA_WARNING,
        severity: 'WARNING',
        title: `SLA at risk on ${id}`,
        detail: `${c.ward || ''} · ${c.wasteType || ''}`.trim(),
        at: c.slaDeadline,
        link: '/admin/complaints',
      });
    }
    if (c.priority === 'critical' && ['pending', 'assigned', 'reopened'].includes(c.status)) {
      out.push({
        id: `crit-${id}`,
        type: CRITICAL_COMPLAINT,
        severity: 'HIGH',
        title: `Critical complaint ${id} awaiting action`,
        detail: `${c.ward || ''} · ${c.wasteType || ''}`.trim(),
        at: c.createdAt,
        link: '/admin/complaints',
      });
    }
  });
  return out;
}

function notificationAlerts(notifications) {
  return (notifications || [])
    .filter((n) => n.type === 'iot' && !n.isRead)
    .slice(0, 20)
    .map((n) => ({
      id: `notif-${n._id}`,
      type: BIN_ALERT,
      severity: 'HIGH',
      title: n.message || 'IoT alert',
      detail: `Received ${timeAgo(n.createdAt)}`,
      at: n.createdAt,
      link: '/admin/bins',
    }));
}

// Build the unified, severity-sorted alert feed. Optional cap (default 30).
export function buildAlerts({ bins, complaints, notifications, limit = 30 } = {}) {
  return sortAlerts([
    ...binAlerts(bins),
    ...complaintAlerts(complaints),
    ...notificationAlerts(notifications),
  ]).slice(0, limit);
}

// Operational bin state derived from authoritative backend fields:
// status enum (ok/near-full/full), alert flag, isActive, online.
// Display buckets only — never overrides backend state.
export function binOperationalState(bin) {
  if (!bin) return { key: 'UNKNOWN', label: 'Unknown', tone: 'neutral' };
  if (bin.isActive === false) return { key: 'MAINTENANCE', label: 'Maintenance', tone: 'neutral' };
  if (bin.online === false) return { key: 'OFFLINE', label: 'Offline', tone: 'danger' };
  if (bin.alert || (bin.level ?? 0) >= 80 || bin.status === 'full') {
    return { key: 'OVERFLOW_RISK', label: 'Overflow risk', tone: 'danger' };
  }
  if ((bin.level ?? 0) >= 70 || bin.status === 'near-full') {
    return { key: 'HIGH', label: 'High fill', tone: 'warning' };
  }
  if ((bin.level ?? 0) >= 50) return { key: 'FILLING', label: 'Filling', tone: 'info' };
  return { key: 'NORMAL', label: 'Normal', tone: 'success' };
}
