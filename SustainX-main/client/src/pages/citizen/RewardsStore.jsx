import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { getStoreItems, redeemStoreItem, getRewards } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { fmtDateTime } from '../../lib/format';

const EARN_STEPS = [
  'Report a waste issue',
  'Your report is validated and resolved',
  'Rewards are automatically credited',
  'Use your points in the store',
];

export default function RewardsStore() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const { data: items, loading, error, refetch } = useFetch(getStoreItems);
  const { data: history } = useFetch(getRewards);
  const [selected, setSelected] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const points = user?.rewardPoints ?? 0;
  const ledger = Array.isArray(history) ? [...history].slice(0, 8) : [];

  const handleRedeem = async (item) => {
    if (!item || points < item.pointsRequired) return;
    setRedeeming(true);
    try {
      await redeemStoreItem(item._id);
      showToast(`${item.name} redeemed. You saved ${item.pointsRequired} points!`, 'success');
      setSelected(null);
      refreshUser();
      refetch();
    } catch (err) {
      showToast(err?.message || 'Could not complete redemption.', 'error');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Rewards & store"
        subtitle="Earn points by reporting issues, redeem them for useful items."
        icon="award"
      />

      <div className="stat-grid u-mb-1">
        <StatCard icon="award" label="Your balance" value={`${points} pts`} tone="primary" hint="Points earned for good citizenship" />
      </div>

      <SectionCard title="How points are earned" className="u-mb-1">
        <div className="earn-steps">
          {EARN_STEPS.map((label, i) => (
            <div className="earn-step" key={i}>
              <span className="earn-step-num">{i + 1}</span>
              <span className="earn-step-text">{label}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Store" subtitle="Redeem your points">
        {loading ? (
          <div className="u-grid u-grid-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-rect" style={{ height: 140 }} />)}
          </div>
        ) : error ? (
          <p>Could not load store items.</p>
        ) : (items || []).length === 0 ? (
          <EmptyState icon="package" title="Store is empty" description="Check back later for rewards." />
        ) : (
          <div className="store-grid">
            {items.map((item) => {
              const canRedeem = points >= item.pointsRequired && item.stock > 0;
              return (
                <div className="store-card" key={item._id}>
                  {item.image && <img src={item.image} alt={item.name} className="store-card-img" />}
                  <div className="store-card-body">
                    <h4 className="store-card-name">{item.name}</h4>
                    <div className="store-card-meta">
                      <span className="store-card-pts">{item.pointsRequired} pts</span>
                      <span className="store-card-stock">{item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}</span>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${canRedeem ? 'btn-primary' : 'btn-ghost'}`}
                      disabled={!canRedeem}
                      onClick={() => setSelected(item)}
                    >
                      {item.stock > 0 ? 'Redeem' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent rewards" subtitle="Latest points credited to your account" className="u-mt-1">
        {ledger.length === 0 ? (
          <EmptyState icon="award" title="No rewards yet" description="Points you earn will appear here." />
        ) : (
          <ul className="complaint-mini-list">
            {ledger.map((r) => (
              <li key={r._id} className="complaint-mini-item">
                <div className="complaint-mini-main">
                  <div className="complaint-mini-title">{r.activity || 'Reward'}</div>
                  <div className="complaint-mini-meta">{fmtDateTime(r.date || r.createdAt)}</div>
                </div>
                <Badge tone="success">+{r.points}</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Modal title="Confirm redemption" isOpen={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="redeem-confirm">
            <p>
              Redeem <strong>{selected.name}</strong> for <strong>{selected.pointsRequired} pts</strong>?
            </p>
            <p className="u-text-muted u-text-sm">Your points balance after this redemption: {points - selected.pointsRequired} pts.</p>
            <div className="report-actions u-mt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={redeeming}
                onClick={() => handleRedeem(selected)}
              >
                {redeeming ? 'Redeeming…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}