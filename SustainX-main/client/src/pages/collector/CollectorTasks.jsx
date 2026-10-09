import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import {
  getComplaints,
  updateComplaintStatus,
  completeComplaintApi,
  getTasks,
  acceptTaskApi,
  startTaskApi,
  completeTaskApi,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { toComplaintsUi } from '../../adapters/complaint.adapter';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import SectionCard from '../../components/ui/SectionCard';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import { wardLabel } from '../../lib/geography';
import { fmtDateTime } from '../../lib/format';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const TASK_STATUS_LABEL = {
  pending: 'Pending',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function CollectorTasks() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const { data, loading, error, refetch } = useFetch(getComplaints);
  const [search, setSearch] = useState('');
  const [completeTarget, setCompleteTarget] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const ward = wardLabel(user?.block);
  const list = toComplaintsUi(data);
  const pending = list.filter((c) => c.status === 'pending');
  const active = list.filter((c) => c.status === 'in-progress');
  const done = list.filter((c) => c.status === 'completed' || c.status === 'rejected');
  const combined = [...pending, ...active, ...done];

  // ── Real collection tasks (assigned → accept → start → complete) ──
  const tasksFetch = useFetch(() => getTasks({ assigned: 'true' }));
  const tasks = Array.isArray(tasksFetch.data) ? tasksFetch.data : [];

  const taskAction = async (task, action, payload) => {
    try {
      if (action === 'accept') await acceptTaskApi(task._id);
      else if (action === 'start') await startTaskApi(task._id);
      else if (action === 'complete') await completeTaskApi(task._id, payload);
      showToast(`Task ${task.taskId} → ${action === 'complete' ? 'completed' : action === 'start' ? 'in progress' : 'accepted'}`, 'success');
      tasksFetch.refetch();
    } catch (err) {
      showToast(err?.message || 'Could not update task.', 'error');
    }
  };

  const startTask = async (c) => {
    try {
      await updateComplaintStatus(c.id, { status: 'in-progress', note: 'Collector started work' });
      showToast(`${c.id} moved to in-progress`, 'success');
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not update status.', 'error');
    }
  };

  const handleProofSelect = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Only image files (JPG, PNG, GIF, WebP) are allowed.', 'error');
      e.target.value = '';
      return;
    }
    if (f.size > MAX_PROOF_BYTES) {
      showToast('Image must be smaller than 5MB.', 'error');
      e.target.value = '';
      return;
    }
    setProofFile(f);
  };

  const [taskProofTarget, setTaskProofTarget] = useState(null);
  const [taskProofFile, setTaskProofFile] = useState(null);
  const [taskNotes, setTaskNotes] = useState('');
  const taskFileRef = useRef(null);

  const handleTaskProofSelect = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Only image files (JPG, PNG, GIF, WebP) are allowed.', 'error');
      e.target.value = '';
      return;
    }
    if (f.size > MAX_PROOF_BYTES) {
      showToast('Image must be smaller than 5MB.', 'error');
      e.target.value = '';
      return;
    }
    setTaskProofFile(f);
  };

  const submitTaskComplete = async () => {
    if (!taskProofTarget) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (taskProofFile) fd.append('proofImage', taskProofFile);
      if (taskNotes.trim()) fd.append('notes', taskNotes.trim());
      await taskAction(taskProofTarget, 'complete', fd);
      setTaskProofTarget(null);
      setTaskProofFile(null);
      setTaskNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const submitComplete = async () => {
    if (!completeTarget || !proofFile) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('image', proofFile);
      await completeComplaintApi(completeTarget.id, fd);
      showToast(`${completeTarget.id} marked complete.`, 'success');
      setCompleteTarget(null);
      setProofFile(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not complete task.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openComplete = (c) => {
    setCompleteTarget(c);
    setProofFile(null);
  };

  const columns = [
    { key: 'id', label: 'ID', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'wasteType', label: 'Type', sortable: true },
    { key: 'location', label: 'Location', render: (row) => row.location || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', label: 'Priority', render: (row) => <PriorityBadge level={row.priority} /> },
    { key: 'createdLabel', label: 'Reported', sortable: true },
    {
      key: '_action',
      label: '',
      width: '160px',
      render: (row) => (
        <div className="u-flex">
          {row.status === 'pending' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => startTask(row)}>
              Start
            </button>
          )}
          {row.status === 'in-progress' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openComplete(row)}>
              <Icon name="check" size={15} /> Done
            </button>
          )}
        </div>
      ),
    },
  ];

  const taskColumns = [
    { key: 'taskId', label: 'Task', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'type', label: 'Type', render: (row) => row.type || '—' },
    { key: 'priority', label: 'Priority', render: (row) => <PriorityBadge level={row.priority} /> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'completed' ? 'success' : row.status === 'in_progress' ? 'warning' : 'info'}>{TASK_STATUS_LABEL[row.status] || row.status}</Badge> },
    { key: 'block', label: 'Ward', render: (row) => wardLabel(row.block) },
    { key: 'slaDeadline', label: 'SLA deadline', render: (row) => fmtDateTime(row.slaDeadline) },
    {
      key: '_taskAction',
      label: '',
      width: '220px',
      render: (row) => (
        <div className="u-flex">
          {row.status === 'assigned' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => taskAction(row, 'accept')}>
              Accept
            </button>
          )}
          {(row.status === 'assigned' || row.status === 'accepted') && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => taskAction(row, 'start')}>
              Start
            </button>
          )}
          {(row.status === 'accepted' || row.status === 'in_progress') && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTaskProofTarget(row); setTaskProofFile(null); setTaskNotes(''); }}>
              <Icon name="check" size={15} /> Complete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Collection tasks" subtitle={`Complaints assigned to ${ward}`} icon="clipboard" />

      <SectionCard title="My assigned tasks" subtitle="Official task workflow: accept → start → complete with proof" className="u-mb-1">
        {tasksFetch.error ? (
          <p>Could not load tasks: {tasksFetch.error?.message}</p>
        ) : tasks.length === 0 && !tasksFetch.loading ? (
          <EmptyState icon="clipboard" title="No assigned tasks" description="Tasks assigned to you by municipal admins will appear here." />
        ) : (
          <DataTable
            columns={taskColumns}
            data={tasks}
            keyField="_id"
            loading={tasksFetch.loading}
            emptyTitle="No assigned tasks"
            emptyDescription="Tasks assigned to you by municipal admins will appear here."
          />
        )}
      </SectionCard>

      {error ? (
        <p>Failed to load tasks: {error?.message}</p>
      ) : (
        <DataTable
          columns={columns}
          data={combined}
          keyField="id"
          loading={loading}
          searchPlaceholder="Search by ID, location or type…"
          searchValue={search}
          onSearchChange={setSearch}
          emptyTitle="No tasks"
          emptyDescription="Your ward has no open complaints."
        />
      )}

      <Modal title="Complete with photo proof" isOpen={!!completeTarget} onClose={() => setCompleteTarget(null)}>
        {completeTarget && (
          <div className="report-form">
            <p>Upload a photo proving <strong>{completeTarget.id}</strong> has been resolved.</p>
            {proofFile ? (
              <div className="report-image-box">
                <span className="u-text-sm u-text-muted">{proofFile.name}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProofFile(null)}>
                  <Icon name="close" size={14} /> Remove
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                <Icon name="image" size={18} /> Attach proof photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleProofSelect} />
            <div className="report-actions u-mt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setCompleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={!proofFile || submitting} onClick={submitComplete}>
                {submitting ? 'Uploading…' : 'Submit proof'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Complete task with proof" isOpen={!!taskProofTarget} onClose={() => setTaskProofTarget(null)}>
        {taskProofTarget && (
          <div className="report-form">
            <p>Upload proof that task <strong>{taskProofTarget.taskId}</strong> is done.</p>
            {taskProofFile ? (
              <div className="report-image-box">
                <span className="u-text-sm u-text-muted">{taskProofFile.name} ({(taskProofFile.size / 1024).toFixed(0)} KB)</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTaskProofFile(null)}>
                  <Icon name="close" size={14} /> Remove
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => taskFileRef.current?.click()}>
                <Icon name="image" size={18} /> Attach proof photo (optional)
              </button>
            )}
            <input ref={taskFileRef} type="file" accept="image/*" hidden onChange={handleTaskProofSelect} />
            <div className="form-group u-mt-1">
              <label className="form-label" htmlFor="taskNotes">Completion notes (optional)</label>
              <textarea
                id="taskNotes"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Bin emptied, area swept…"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
              />
            </div>
            <div className="report-actions u-mt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setTaskProofTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={submitTaskComplete}>
                {submitting ? 'Submitting…' : 'Complete task'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}