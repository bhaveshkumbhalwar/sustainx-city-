import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getComplaints, updateComplaintStatus, getUsers } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { toComplaintsUi, sourceLabel, statusLabel } from '../../adapters/complaint.adapter';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import { fmtDateTime, fmtSla } from '../../lib/format';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminComplaints() {
  const { showToast } = useToast();
  const { data, loading, refetch } = useFetch(getComplaints);
  const { data: collectorsData } = useFetch(() => getUsers('collector'));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [assignee, setAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);

  const list = toComplaintsUi(data);
  const collectors = Array.isArray(collectorsData) ? collectorsData : [];
  const filtered = filter === 'all' ? list : list.filter((c) => c.status === filter);

  const openDetail = (c) => {
    setSelected(c);
    setAssignee(c.assignedTo?._id || c.assignedTo || '');
  };

  const setStatus = async (c, status) => {
    try {
      await updateComplaintStatus(c.id, { status, note: `Admin set status to ${status}` });
      showToast(`${c.id} → ${status}`, 'success');
      setSelected(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not update status.', 'error');
    }
  };

  const assign = async (c) => {
    if (!assignee) {
      showToast('Select a collector first.', 'warning');
      return;
    }
    setAssigning(true);
    try {
      await updateComplaintStatus(c.id, {
        status: c.status === 'pending' ? 'assigned' : c.status,
        assignedTo: assignee,
        note: 'Admin assigned complaint',
      });
      showToast(`${c.id} assigned.`, 'success');
      setSelected(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not assign complaint.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const columns = [
    { key: 'id', label: 'ID', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'user', label: 'Reported by', sortable: true, render: (row) => row.user?.name || 'System' },
    { key: 'wasteType', label: 'Type', sortable: true },
    { key: 'ward', label: 'Ward', sortable: true },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', label: 'Priority', render: (row) => <PriorityBadge level={row.priority} /> },
    { key: 'assignedTo', label: 'Assignee', render: (row) => row.assignedTo?.name || '—' },
    { key: 'createdLabel', label: 'Reported', sortable: true },
    {
      key: '_open',
      label: '',
      width: '64px',
      render: (row) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetail(row)} aria-label={`View ${row.id}`}>
          <Icon name="eye" size={16} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Complaints registry" subtitle="All citizen and IoT-driven waste reports." icon="list" />

      <div className="segmented u-mb-1" style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className={`segmented-btn ${filter === f.value ? 'segmented-active' : ''}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        loading={loading}
        searchPlaceholder="Search by ID, type, ward or user…"
        searchValue={search}
        onSearchChange={setSearch}
        emptyTitle="No complaints"
        emptyDescription="No records match the current filters."
      />

      <Modal title="Complaint detail" isOpen={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="detail-panel">
            <div className="detail-row"><span className="detail-label">ID</span><span className="detail-value u-mono">{selected.id}</span></div>
            <div className="detail-row"><span className="detail-label">Source</span><Badge tone="neutral">{sourceLabel(selected.type)}</Badge></div>
            <div className="detail-row"><span className="detail-label">Status</span><StatusBadge status={selected.status} /></div>
            <div className="detail-row"><span className="detail-label">Reporter</span><span className="detail-value">{selected.user?.name || 'System'}</span></div>
            <div className="detail-row"><span className="detail-label">Assignee</span><span className="detail-value">{selected.assignedTo?.name || 'Unassigned'}</span></div>
            <div className="detail-row">
              <span className="detail-label">SLA</span>
              <span className="detail-value">
                {(() => {
                  const sla = fmtSla(selected.slaRemainingMs);
                  return <Badge tone={sla.breached ? 'danger' : 'info'}>{sla.label}</Badge>;
                })()}
              </span>
            </div>
            <div className="detail-row"><span className="detail-label">Ward / Zone</span><span className="detail-value">{selected.ward} / {selected.zone}</span></div>
            <div className="detail-row"><span className="detail-label">Location</span><span className="detail-value">{selected.location}</span></div>
            <div className="detail-row"><span className="detail-label">Type</span><span className="detail-value">{selected.wasteType}</span></div>
            <div className="detail-row"><span className="detail-label">Submitted</span><span className="detail-value">{fmtDateTime(selected.createdAt)}</span></div>
            <div className="detail-desc"><span className="detail-label">Description</span><p>{selected.description}</p></div>

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

            <div className="form-group u-mt-1">
              <label className="form-label" htmlFor="assignee">Assign collector</label>
              <div className="u-flex">
                <select
                  id="assignee"
                  className="form-select"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Select collector…</option>
                  {collectors.map((col) => (
                    <option key={col._id} value={col._id}>
                      {col.name} ({col.block ? `Ward ${col.block}` : 'no ward'})
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary btn-sm" disabled={!assignee || assigning} onClick={() => assign(selected)}>
                  {assigning ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>

            {(selected.status === 'pending' || selected.status === 'in-progress') && (
              <div className="report-actions">
                {selected.status === 'pending' && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(selected, 'in-progress')}>
                    Start (in-progress)
                  </button>
                )}
                <button type="button" className="btn btn-red btn-sm" onClick={() => setStatus(selected, 'rejected')}>
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}