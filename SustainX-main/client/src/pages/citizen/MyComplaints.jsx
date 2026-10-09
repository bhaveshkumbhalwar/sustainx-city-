import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getComplaints, confirmComplaintApi, reopenComplaintApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { toComplaintsUi, sourceLabel, statusLabel } from '../../adapters/complaint.adapter';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import SectionCard from '../../components/ui/SectionCard';
import StatusBadge from '../../components/ui/StatusBadge';
import Badge from '../../components/ui/Badge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import { fmtDateTime, fmtSla } from '../../lib/format';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Submitted' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function MyComplaints() {
  const { showToast } = useToast();
  const { data, loading, error, refetch } = useFetch(getComplaints);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(false);

  const list = toComplaintsUi(data);
  const filtered = statusFilter === 'all' ? list : list.filter((c) => c.status === statusFilter);

  const doConfirm = async (c) => {
    setActing(true);
    try {
      await confirmComplaintApi(c.id);
      showToast('Resolution confirmed. Thank you!', 'success');
      setSelected(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not confirm resolution.', 'error');
    } finally {
      setActing(false);
    }
  };

  const doReopen = async (c) => {
    setActing(true);
    try {
      await reopenComplaintApi(c.id);
      showToast('Complaint reopened.', 'success');
      setSelected(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not reopen complaint.', 'error');
    } finally {
      setActing(false);
    }
  };

  const columns = [
    { key: 'id', label: 'ID', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'wasteType', label: 'Type', sortable: true },
    { key: 'ward', label: 'Ward', sortable: true },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', label: 'Priority', render: (row) => <PriorityBadge level={row.priority} /> },
    { key: 'createdLabel', label: 'Reported', sortable: true },
    {
      key: '_open',
      label: '',
      align: 'right',
      width: '64px',
      render: (row) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(row)} aria-label={`View ${row.id}`}>
          <Icon name="eye" size={16} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="My complaints" subtitle="Track the status of your waste reports." icon="list" />

      {error ? (
        <SectionCard>
          <div style={{ padding: '1rem' }}>
            <p>Could not load complaints: {error?.message}</p>
            <button className="btn btn-ghost btn-sm" onClick={refetch}>
              <Icon name="refresh" size={16} /> Retry
            </button>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="segmented u-mb-1" style={{ flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`segmented-btn ${statusFilter === f.value ? 'segmented-active' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            keyField="id"
            loading={loading}
            searchPlaceholder="Search by ID, type or location…"
            searchValue={search}
            onSearchChange={setSearch}
            emptyTitle="No complaints found"
            emptyDescription={statusFilter !== 'all' ? 'Try a different filter.' : 'File your first waste report and it will appear here.'}
          />
        </>
      )}

      <Modal title="Complaint details" isOpen={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="detail-panel">
            <div className="detail-row">
              <span className="detail-label">ID</span>
              <span className="detail-value u-mono">{selected.id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Source</span>
              <Badge tone="neutral">{sourceLabel(selected.type)}</Badge>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <StatusBadge status={selected.status} />
            </div>
            <div className="detail-row">
              <span className="detail-label">Priority</span>
              <PriorityBadge level={selected.priority} />
            </div>
            <div className="detail-row">
              <span className="detail-label">Ward / Zone</span>
              <span className="detail-value">{selected.ward} / {selected.zone}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Location</span>
              <span className="detail-value">{selected.location}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Type</span>
              <span className="detail-value">{selected.wasteType}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Submitted</span>
              <span className="detail-value">{fmtDateTime(selected.createdAt)}</span>
            </div>
            <div className="detail-desc">
              <span className="detail-label">Description</span>
              <p>{selected.description}</p>
            </div>
            {selected.image && (
              <div className="detail-image">
                <span className="detail-label">Photo</span>
                <img src={selected.image} alt="Report" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
            {selected.completionImage && (
              <div className="detail-image">
                <span className="detail-label">Resolution photo</span>
                <img src={selected.completionImage} alt="Completed" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
            {selected.assignedTo && (
              <div className="detail-row">
                <span className="detail-label">Assigned collector</span>
                <span className="detail-value">{selected.assignedTo.name || '—'}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">SLA</span>
              <span className="detail-value">
                {(() => {
                  const sla = fmtSla(selected.slaRemainingMs);
                  return <Badge tone={sla.breached ? 'danger' : 'info'}>{sla.label}</Badge>;
                })()}
              </span>
            </div>
            {Array.isArray(selected.statusHistory) && selected.statusHistory.length > 0 && (
              <div className="detail-desc">
                <span className="detail-label">Timeline</span>
                <ul className="timeline">
                  {selected.statusHistory.map((h, i) => (
                    <li key={i} className="timeline-item">
                      <StatusBadge status={h.status} />
                      <span className="u-text-sm">{h.note || statusLabel(h.status)}</span>
                      <span className="u-text-muted u-text-sm">{fmtDateTime(h.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="report-actions u-mt-1">
              {selected.status === 'completed' && (
                <button type="button" className="btn btn-primary btn-sm" disabled={acting} onClick={() => doConfirm(selected)}>
                  {acting ? 'Confirming…' : 'Confirm resolution'}
                </button>
              )}
              {(selected.status === 'completed' || selected.status === 'rejected' || selected.status === 'citizen_confirmed') && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={acting} onClick={() => doReopen(selected)}>
                  {acting ? 'Reopening…' : 'Reopen'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}