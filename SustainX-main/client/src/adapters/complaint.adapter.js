// API → UI adapters.
// Keeps presentation components free of raw API shapes and of backend
// quirks (e.g. "in_progress" vs "in-progress").

import { wardLabel, zoneOf } from '../lib/geography';
import { timeAgo } from '../lib/format';

export const STATUS_META = {
  pending: { label: 'Submitted', tone: 'info', order: 0 },
  assigned: { label: 'Assigned', tone: 'info', order: 0 },
  'in-progress': { label: 'In Progress', tone: 'warning', order: 1 },
  in_progress: { label: 'In Progress', tone: 'warning', order: 1 },
  citizen_confirmed: { label: 'Citizen Confirmed', tone: 'success', order: 2 },
  completed: { label: 'Resolved', tone: 'success', order: 2 },
  reopened: { label: 'Reopened', tone: 'warning', order: 3 },
  rejected: { label: 'Rejected', tone: 'danger', order: 3 },
};

// Normalized single source for a complaint status.
export function normalizeStatus(status) {
  if (!status) return 'pending';
  if (status === 'in_progress') return 'in-progress';
  return status;
}

export function statusLabel(status) {
  const m = STATUS_META[normalizeStatus(status)];
  return m ? m.label : status || '—';
}

// Priority comes from the backend (low/medium/high/critical — SLA engine).
// Never recomputed on the client. Unknown values fall back to 'medium',
// null stays null so the UI can render "Not available".
const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'];
export function normalizePriority(p) {
  if (p === null || p === undefined || p === '') return null;
  const v = String(p).toLowerCase();
  return PRIORITY_LEVELS.includes(v) ? v : 'medium';
}

export function statusOpen(c) {
  const s = normalizeStatus(c?.status);
  return s !== 'completed' && s !== 'rejected' && s !== 'citizen_confirmed';
}

export function toComplaintUi(raw) {
  const status = normalizeStatus(raw?.status);
  return {
    ...raw,
    id: raw?.complaintId,
    status,
    priority: normalizePriority(raw?.priority),
    ward: wardLabel(raw?.block),
    zone: zoneOf(raw?.block),
    block: raw?.block || null,
    createdLabel: timeAgo(raw?.createdAt),
    description: raw?.description || '',
    location: raw?.location || '—',
  };
}

export function toComplaintsUi(list) {
  return (list || []).map(toComplaintUi);
}

// Complaint type label (backend type: complaint / scan / iot)
export function sourceLabel(type) {
  switch (type) {
    case 'iot':
      return 'Smart Bin';
    case 'scan':
      return 'Bin Scan';
    default:
      return 'Citizen Report';
  }
}