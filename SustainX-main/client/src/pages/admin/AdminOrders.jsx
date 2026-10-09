import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getOrders, updateOrderStatus } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';
import { wardLabel } from '../../lib/geography';

const STATUS_TONE = { pending: 'info', approved: 'warning', ready_for_pickup: 'success', delivered: 'success' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', ready_for_pickup: 'Ready', delivered: 'Delivered' };

export default function AdminOrders() {
  const { showToast } = useToast();
  const { data, loading, refetch } = useFetch(() => getOrders());
  const [search, setSearch] = useState('');
  const [deliverTarget, setDeliverTarget] = useState(null);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const orders = Array.isArray(data) ? data : [];

  const advance = async (order, status) => {
    try {
      await updateOrderStatus(order.orderId, { status });
      showToast(`${order.orderId} → ${STATUS_LABEL[status]}`, 'success');
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not update order.', 'error');
    }
  };

  const openDeliver = (order) => { setDeliverTarget(order); setCode(''); };

  const confirmDeliver = async () => {
    if (!deliverTarget || !code.trim()) return;
    setSaving(true);
    try {
      await updateOrderStatus(deliverTarget.orderId, { status: 'delivered', verificationCode: code.trim() });
      showToast(`${deliverTarget.orderId} delivered.`, 'success');
      setDeliverTarget(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Verification failed.', 'error');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'orderId', label: 'Order ID', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'userName', label: 'Customer', sortable: true },
    { key: 'itemName', label: 'Item', sortable: true, render: (row) => row.itemName || row.item?.name || '—' },
    { key: 'block', label: 'Ward', render: (row) => wardLabel(row.block) },
    { key: 'pointsUsed', label: 'Points', render: (row) => `${row.pointsUsed} pts` },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={STATUS_TONE[row.status] || 'neutral'} dot>{STATUS_LABEL[row.status] || row.status}</Badge> },
    { key: 'assignedCollectorName', label: 'Assigned to', render: (row) => row.assignedCollectorName || '—' },
    {
      key: '_action',
      label: '',
      width: '200px',
      render: (row) => (
        <div className="u-flex">
          {row.status === 'pending' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => advance(row, 'approved')}>Approve</button>}
          {row.status === 'approved' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => advance(row, 'ready_for_pickup')}>Ready</button>}
          {row.status === 'ready_for_pickup' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDeliver(row)}><Icon name="check" size={15} /> Deliver</button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Store orders" subtitle="Redeemed rewards awaiting fulfillment." icon="package" />

      <DataTable
        columns={columns}
        data={orders}
        keyField="orderId"
        loading={loading}
        searchPlaceholder="Search by order, customer or item…"
        searchValue={search}
        onSearchChange={setSearch}
        emptyTitle="No orders"
        emptyDescription="No store orders have been placed."
      />

      <Modal title="Confirm delivery" isOpen={!!deliverTarget} onClose={() => setDeliverTarget(null)}>
        {deliverTarget && (
          <div className="report-form">
            <p>
              Enter the pickup code for <strong>{deliverTarget.orderId}</strong> ({deliverTarget.userName}).
            </p>
            <div className="form-group">
              <label className="form-label">Pickup code</label>
              <input className="form-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ABC123" autoFocus />
            </div>
            <div className="report-actions u-mt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setDeliverTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!code.trim() || saving} onClick={confirmDeliver}>
                {saving ? 'Verifying…' : 'Confirm delivery'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}