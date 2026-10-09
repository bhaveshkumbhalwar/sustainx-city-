import { STATUS_META, normalizeStatus } from '../../adapters/complaint.adapter';
import Badge from './Badge';

const TONE_BY_STATUS = {
  pending: 'info',
  assigned: 'info',
  'in-progress': 'warning',
  reopened: 'warning',
  citizen_confirmed: 'success',
  completed: 'success',
  rejected: 'danger',
};

export default function StatusBadge({ status, label }) {
  const s = normalizeStatus(status);
  const meta = STATUS_META[s] || STATUS_META.pending;
  return (
    <Badge tone={TONE_BY_STATUS[s] || 'neutral'} dot>
      {label || meta.label}
    </Badge>
  );
}