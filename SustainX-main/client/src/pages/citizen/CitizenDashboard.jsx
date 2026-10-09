import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { getDashboardStats, getComplaints, getIotBinData } from '../../services/api';
import { toComplaintsUi } from '../../adapters/complaint.adapter';
import { toBinsUi } from '../../adapters/bin.adapter';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import StatusBadge from '../../components/ui/StatusBadge';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ProgressBar from '../../components/ui/ProgressBar';
import Icon from '../../components/ui/Icon';
import { formatNumber } from '../../lib/format';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const stats = useFetch(getDashboardStats);
  const complaints = useFetch(getComplaints);
  const bins = useFetch(getIotBinData);

  const myComplaints = complaints.data ? toComplaintsUi(complaints.data) : [];
  const recent = [...myComplaints]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);
  const smartBins = bins.data ? toBinsUi(bins.data).slice(0, 4) : [];

  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const s = stats.data || {};

  return (
    <>
      <div className="welcome-hero">
        <div>
          <span className="welcome-hero-eyebrow">Swachh Bharat Digital Portal</span>
          <h1 className="welcome-hero-title">Hello, {firstName}</h1>
          <p className="welcome-hero-sub">
            Track your reports, nearby bins and rewards at a glance.
          </p>
        </div>
        <div className="welcome-hero-actions">
          <Link to="/citizen/report" className="btn btn-primary btn-sm">
            <Icon name="map-pin" size={16} /> Report Waste
          </Link>
          <Link to="/citizen/complaints" className="btn btn-ghost btn-sm">
            Track complaint
          </Link>
        </div>
      </div>

      <div className="qa-grid">
        <Link to="/citizen/report" className="qa-card">
          <span className="qa-icon"><Icon name="map-pin" size={20} /></span>
          <span>
            <span className="qa-title">Report Waste</span>
            <div className="qa-desc">Describe the issue, add a photo &amp; location</div>
          </span>
        </Link>
        <Link to="/citizen/complaints" className="qa-card">
          <span className="qa-icon qa-icon-info"><Icon name="list" size={20} /></span>
          <span>
            <span className="qa-title">Track Complaint</span>
            <div className="qa-desc">Follow status, SLA and resolution</div>
          </span>
        </Link>
        <Link to="/citizen/rewards" className="qa-card">
          <span className="qa-icon qa-icon-warn"><Icon name="award" size={20} /></span>
          <span>
            <span className="qa-title">View Rewards</span>
            <div className="qa-desc">{user ? `${formatNumber(user.rewardPoints ?? 0)} points available` : 'Earn points by reporting'}</div>
          </span>
        </Link>
      </div>

      <div className="stat-grid">
        <StatCard icon="list" label="My reports" value={stats.loading ? null : formatNumber(s.total)} hint="All time" tone="info" loading={stats.loading} />
        <StatCard icon="clock" label="In progress" value={stats.loading ? null : formatNumber(s.progress)} hint="Being handled" tone="warning" loading={stats.loading} />
        <StatCard icon="check" label="Resolved" value={stats.loading ? null : formatNumber(s.done)} hint="Solved reports" tone="success" loading={stats.loading} />
        <StatCard icon="award" label="Reward points" value={user ? formatNumber(user.rewardPoints ?? 0) : '—'} hint="Earn by reporting" tone="primary" />
      </div>

      <div className="u-grid-2 u-mt-2">
        <SectionCard
          title="Recent reports"
          subtitle="Your latest citizen reports"
          actions={
            <Link to="/citizen/complaints" className="btn btn-ghost btn-sm">
              View all <Icon name="chevronRight" size={14} />
            </Link>
          }
          pad={false}
        >
          {complaints.loading ? (
            <div className="section-card-body">
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
            </div>
          ) : complaints.error ? (
            <div className="section-card-body">
              <ErrorState message={complaints.error?.message} onRetry={complaints.refetch} />
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon="map-pin"
              title="No reports yet"
              description="Report a waste issue and it will appear here with live status."
              action={
                <Link to="/citizen/report" className="btn btn-primary btn-sm">
                  Report waste
                </Link>
              }
            />
          ) : (
            <ul className="complaint-mini-list">
              {recent.map((c) => (
                <li key={c.id} className="complaint-mini-item">
                  <div className="complaint-mini-main">
                    <div className="u-flex">
                      <Avatar name={c.id} size={34} />
                      <div>
                        <div className="complaint-mini-title">{c.description}</div>
                        <div className="complaint-mini-meta">
                          {c.ward} · {c.createdLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Smart bins near you"
          subtitle="Latest fill readings (observed sensor data)"
          actions={
            <Link to="/citizen/bins" className="btn btn-ghost btn-sm">
              Map view <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          {bins.loading ? (
            <>
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text" />
            </>
          ) : bins.error ? (
            <ErrorState message="Could not load bin readings." onRetry={bins.refetch} />
          ) : smartBins.length === 0 ? (
            <EmptyState
              icon="trash"
              title="No live bins"
              description="Smart bin readings will appear here as devices report in."
            />
          ) : (
            <div className="bin-list">
              {smartBins.map((b) => (
                <div className="bin-row" key={b.id}>
                  <div className="bin-row-head">
                    <span className="bin-row-name">Bin {b.binId}</span>
                    <Badge tone={b.state.tone} dot>
                      {b.state.label}
                    </Badge>
                  </div>
                  <div className="bin-row-meta">
                    {b.ward} · updated {b.updatedLabel}
                  </div>
                  <ProgressBar value={b.level} tone={b.state.tone} label={`${b.binId} fill level`} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}