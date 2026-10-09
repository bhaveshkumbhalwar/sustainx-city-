import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getUsers, createUser, deleteUserApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { roleMeta } from '../../config/roles';
import { useWardOptions } from '../../hooks/useGeo';
import { wardLabel } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import Icon from '../../components/ui/Icon';

const ROLE_BADGE = { student: 'info', collector: 'warning', admin: 'success' };

export default function AdminUsers() {
  const { showToast } = useToast();
  const { data, loading, refetch } = useFetch(() => getUsers());
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', block: '', dept: '' });
  const wardOptions = useWardOptions();

  const users = Array.isArray(data) ? data : [];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      showToast('Name, email and password are required.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await createUser(form);
      showToast(`User ${form.name} created.`, 'success');
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'student', block: '', dept: '' });
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not create user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete user ${u.name}?`)) return;
    try {
      await deleteUserApi(u._id);
      showToast('User deleted.', 'success');
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not delete user.', 'error');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true, render: (row) => (
      <div className="u-flex"><Avatar name={row.name} size={30} /> <strong>{row.name}</strong></div>
    ) },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', render: (row) => <Badge tone={ROLE_BADGE[row.role] || 'neutral'}>{roleMeta(row.role).label}</Badge> },
    { key: 'block', label: 'Ward', render: (row) => wardLabel(row.block) },
    { key: 'rewardPoints', label: 'Points', sortable: true, render: (row) => `${row.rewardPoints ?? 0} pts` },
    {
      key: '_del',
      label: '',
      width: '60px',
      render: (row) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(row)} aria-label={`Delete ${row.name}`}>
          <Icon name="trash" size={16} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Citizens, collection officers and staff."
        icon="users"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <Icon name="user" size={15} /> New user
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        keyField="_id"
        loading={loading}
        searchPlaceholder="Search by name or email…"
        searchValue={search}
        onSearchChange={setSearch}
        emptyTitle="No users"
        emptyDescription="Create your first user to get started."
      />

      <Modal title="Create user" isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={submit} className="report-form">
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" type="text" value={form.name} onChange={set('name')} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="email@city.gov" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password} onChange={set('password')} placeholder="Min 6 characters" />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={set('role')}>
              <option value="student">Citizen (student)</option>
              <option value="collector">Collection Officer (collector)</option>
              <option value="admin">Municipal Admin</option>
            </select>
          </div>
          {form.role !== 'admin' && (
            <div className="form-group">
              <label className="form-label">Ward (block)</label>
              <select className="form-select" value={form.block} onChange={set('block')}>
                <option value="">Select ward…</option>
                {wardOptions.map((w) => <option key={w.code} value={w.code}>{w.name} ({w.zone})</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Department (optional)</label>
            <input className="form-input" type="text" value={form.dept} onChange={set('dept')} placeholder="e.g. Sanitation" />
          </div>
          <div className="report-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create user'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}