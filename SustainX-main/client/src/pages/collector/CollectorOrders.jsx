import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getOrders, updateOrderStatus, assignOrderApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Icon from '../../components/ui/Icon';

const STATUS_TONE = { pending: 'info', approved: 'warning', ready_for_pickup: 'success', delivered: 'success' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', ready_for_pickup: 'Ready', delivered: 'Delivered' };

export default function CollectorOrders() {
  const { showToast } = useToast();
  const { data, loading, error, refetch } = useFetch(getOrders);
  const [search, setSearch] = useState('');
  const [deliverTarget, setDeliverTarget] = useState(null);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(data) ? data : [];

  const nextStatus = { pending: 'approved', approved: 'ready_for_pickup' };

  const advance = async (order) => {
    const next = nextStatus[order.status];
    if (!next) return;
    try {
      await updateOrderStatus(order.orderId, { status: next });
      showToast(`${order.orderId} → ${STATUS_LABEL[next]}`, 'success');
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not update order.', 'error');
    }
  };

  const openDeliver = (order) => {
    setDeliverTarget(order);
    setCode('');
  };

  const takeOrder = async (order) => {
    try {
      await assignOrderApi(order._id);
      showToast(`${order.orderId} assigned to you.`, 'success');
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not take order.', 'error');
    }
  };

  const confirmDeliver = async () => {
    if (!deliverTarget || !code.trim()) return;
    setSaving(true);
    try {
      await updateOrderStatus(deliverTarget.orderId, { status: 'delivered', verificationCode: code.trim() });
      showToast(`${deliverTarget.orderId} delivered!`, 'success');
      setDeliverTarget(null);
      refetch();
    } catch (err) {
      showToast(err?.message || 'Verification failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'orderId', label: 'Order ID', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'itemName', label: 'Item', sortable: true, render: (row) => row.itemName || row.item?.name || '—' },
    { key: 'userName', label: 'Customer', sortable: true },
    { key: 'block', label: 'Ward' },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={STATUS_TONE[row.status] || 'neutral'} dot>{STATUS_LABEL[row.status] || row.status}</Badge> },
    {
      key: '_action',
      label: '',
      width: '160px',
      render: (row) => (
        <div className="u-flex">
          {!row.assignedTo && row.status === 'pending' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => takeOrder(row)}>
              Take
            </button>
          )}
          {nextStatus[row.status] && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => advance(row)}>
              {STATUS_LABEL[nextStatus[row.status]] || 'Next'}
            </button>
          )}
          {row.status === 'ready_for_pickup' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDeliver(row)}>
              <Icon name="check" size={15} /> Deliver
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Delivery orders" subtitle="Pick up and deliver redeemed store orders." icon="package" />

      {error ? (
        <p>Could not load orders: {error?.message}</p>
      ) : (
        <DataTable
          columns={columns}
          data={list}
          keyField="orderId"
          loading={loading}
          searchPlaceholder="Search by order ID, customer or item…"
          searchValue={search}
          onSearchChange={setSearch}
          emptyTitle="No orders"
          emptyDescription="No orders are currently available for your ward."
        />
      )}

      <Modal title="Confirm delivery" isOpen={!!deliverTarget} onClose={() => setDeliverTarget(null)}>
        {deliverTarget && (
          <div className="report-form">
            <p>
              Enter the pickup code for <strong>{deliverTarget.orderId}</strong> ({deliverTarget.userName}).
            </p>
            <div className="form-group">
              <label className="form-label">Pickup code</label>
              <input
                className="form-input"
                placeholder="e.g. ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
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