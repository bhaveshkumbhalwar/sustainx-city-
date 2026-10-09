import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getRewards, addReward, getUsers } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import { fmtDateTime } from '../../lib/format';

export default function AdminRewards() {
  const { showToast } = useToast();
  const { data, loading, refetch } = useFetch(() => getRewards());
  const { data: studentsData } = useFetch(() => getUsers('student'));
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user: '', activity: '', points: '' });

  const rewards = Array.isArray(data) ? data : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.user || !form.activity || !form.points) {
      showToast('Select a citizen, activity and points.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await addReward({ user: form.user, activity: form.activity, points: Number(form.points) });
      showToast('Points awarded.', 'success');
      setOpen(false);
      setForm({ user: '', activity: '', points: '' });
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not award points.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'user', label: 'Citizen', sortable: true, render: (row) => row.user?.name || '—' },
    { key: 'activity', label: 'Activity', sortable: true },
    { key: 'points', label: 'Points', sortable: true, render: (row) => <Badge tone="success">+{row.points}</Badge> },
    { key: 'date', label: 'Date', render: (row) => fmtDateTime(row.date || row.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Rewards"
        subtitle="Award points for participation."
        icon="award"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Icon name="award" size={15} /> Award points
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={rewards}
        keyField="_id"
        loading={loading}
        searchPlaceholder="Search by citizen or activity…"
        searchValue={search}
        onSearchChange={setSearch}
        emptyTitle="No rewards yet"
        emptyDescription="Award points to citizens for contributions."
      />

      <Modal title="Award points" isOpen={open} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="report-form">
          <div className="form-group">
            <label className="form-label">Citizen</label>
            <select className="form-select" value={form.user} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}>
              <option value="">Select citizen…</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Activity</label>
            <input className="form-input" type="text" value={form.activity} onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))} placeholder="e.g. Waste segregation drive" />
          </div>
          <div className="form-group">
            <label className="form-label">Points</label>
            <input className="form-input" type="number" min="1" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} placeholder="e.g. 50" />
          </div>
          <div className="report-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Awarding…' : 'Award points'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}