import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useOpsMap, buildOpsMarkers } from '../../hooks/useOpsMap';
import { usePolling } from '../../hooks/usePolling';
import { getDashboardStats, getNotifications, getAiInsights } from '../../services/api';
import { buildAlerts } from '../../adapters/alerts.adapter';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import DonutChart from '../../components/charts/DonutChart';
import Badge from '../../components/ui/Badge';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import CityMap from '../../components/maps/CityMap';
import Icon from '../../components/ui/Icon';
import { formatNumber, timeAgo } from '../../lib/format';

const MAP_LAYERS = [
  { key: 'bins', label: 'Smart bins', tone: 'warning' },
  { key: 'complaints', label: 'Complaints', tone: 'info' },
  { key: 'vehicles', label: 'Vehicles', tone: 'success' },
];

const ALERT_TONE = { INFO: 'info', WARNING: 'warning', HIGH: 'danger', CRITICAL: 'danger' };

export default function ControlRoom() {
  const { data: stats, loading, refetch } = useFetch(getDashboardStats);
  const { data: rawNotifications, refetch: refetchNotif } = useFetch(() => getNotifications({ limit: 50 }));
  const { data: rawInsights } = useFetch(() => getAiInsights({ limit: 4 }));
  const { complaints, bins, vehicles, geo, refetchAll } = useOpsMap();

  usePolling(() => { refetch(); refetchNotif(); refetchAll(); }, 60000);

  const s = stats || {};
  const oa = s.orderAnalytics || {};
  const notifications = useMemo(
    () => (Array.isArray(rawNotifications) ? rawNotifications : []),
    [rawNotifications],
  );
  const insights = Array.isArray(rawInsights) ? rawInsights.slice(0, 4) : [];

  const markers = useMemo(() => {
    const parts = buildOpsMarkers({ bins, complaints, vehicles, hotspotRows: [], geo });
    return [...parts.binMarkers, ...parts.complaintMarkers, ...parts.vehicleMarkers];
  }, [bins, complaints, vehicles, geo]);

  const alerts = useMemo(
    () => buildAlerts({ bins, complaints, notifications, limit: 8 }),
    [bins, complaints, notifications],
  );

  const openComplaints = complaints.filter((c) => !['completed', 'rejected', 'citizen_confirmed'].includes(c.status));
  const criticalComplaints = complaints.filter((c) => c.priority === 'critical' && ['pending', 'assigned', 'reopened'].includes(c.status)).length;
  const slaAtRisk = complaints.filter((c) => typeof c.slaRemainingMs === 'number' && c.slaRemainingMs >= 0 && c.slaRemainingMs < 4 * 3600 * 1000).length;
  const slaBreached = complaints.filter((c) => typeof c.slaRemainingMs === 'number' && c.slaRemainingMs < 0).length;
  const overflowBins = bins.filter((b) => b.alert || (b.level ?? 0) >= 80).length;
  const offlineBins = bins.filter((b) => b.online === false).length;
  const activeVehicles = vehicles.filter((v) => v.status === 'available' || v.status === 'on_route').length;

  const statusSegments = [
    { label: 'Pending', value: s.pending || 0, tone: 'info' },
    { label: 'In Progress', value: s.progress || 0, tone: 'warning' },
    { label: 'Resolved', value: s.done || 0, tone: 'success' },
  ];

  return (
    <>
      <PageHeader
        title="Control Room"
        subtitle="City-wide waste operations at a glance. Auto-refreshes every 60 seconds."
        icon="shield"
        actions={
          <div className="u-flex u-wrap">
            <Link to="/admin/complaints" className="btn btn-ghost btn-sm">Complaints</Link>
            <Link to="/admin/analytics" className="btn btn-primary btn-sm"><Icon name="chart" size={15} /> Analytics</Link>
          </div>
        }
      />

      <div className="stat-grid">
        <StatCard icon="list" label="Active complaints" value={loading ? null : formatNumber(openComplaints.length)} tone="info" loading={loading} />
        <StatCard icon="alert-triangle" label="Critical complaints" value={loading ? null : formatNumber(criticalComplaints)} tone={criticalComplaints ? 'danger' : 'neutral'} loading={loading} />
        <StatCard icon="clock" label="SLA at risk" value={loading ? null : formatNumber(slaAtRisk)} tone={slaAtRisk ? 'warning' : 'neutral'} loading={loading} />
        <StatCard icon="clock" label="SLA breached" value={loading ? null : formatNumber(slaBreached)} tone={slaBreached ? 'danger' : 'neutral'} loading={loading} />
        <StatCard icon="trash" label="Overflow-risk bins" value={loading ? null : formatNumber(overflowBins)} tone={overflowBins ? 'danger' : 'neutral'} loading={loading} />
        <StatCard icon="trash" label="Offline bins" value={loading ? null : formatNumber(offlineBins)} tone={offlineBins ? 'warning' : 'neutral'} loading={loading} />
        <StatCard icon="truck" label="Active vehicles" value={loading ? null : formatNumber(activeVehicles)} loading={loading} />
        <StatCard icon="users" label="Collectors" value={loading ? null : formatNumber(s.collectors)} loading={loading} />
      </div>

      <div className="u-mt-2">
        <CityMap markers={markers} layers={MAP_LAYERS} title="Live city map" height={380} />
      </div>

      <div className="u-grid-2 u-mt-2">
        <SectionCard
          title="Critical alerts"
          subtitle="Highest-severity operational events first"
          actions={<Link to="/admin/bins" className="btn btn-ghost btn-sm">Bins <Icon name="chevronRight" size={14} /></Link>}
        >
          {alerts.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--txt-muted)' }}>No active alerts. The city is quiet.</p>
          ) : (
            <ul className="complaint-mini-list">
              {alerts.map((a) => (
                <li key={a.id} className="complaint-mini-item">
                  <div className="complaint-mini-main">
                    <div className="complaint-mini-title">{a.title}</div>
                    <div className="complaint-mini-meta">{a.detail}{a.at ? ` · ${timeAgo(a.at)}` : ''}</div>
                  </div>
                  <Badge tone={ALERT_TONE[a.severity] || 'info'}>{a.severity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Status breakdown">
          <DonutChart
            segments={statusSegments}
            center={loading ? '…' : formatNumber(s.total)}
            valueFormatter={formatNumber}
          />
        </SectionCard>
      </div>

      <div className="u-grid-2 u-mt-2">
        <SectionCard
          title="Recent complaints"
          actions={<Link to="/admin/complaints" className="btn btn-ghost btn-sm">View all <Icon name="chevronRight" size={14} /></Link>}
          pad={false}
        >
          {loading ? (
            <div className="section-card-body"><div className="skeleton skeleton-rect" /></div>
          ) : complaints.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--txt-muted)' }}>No complaints.</p>
          ) : (
            <ul className="complaint-mini-list">
              {[...complaints].slice(0, 6).map((c) => (
                <li key={c.id} className="complaint-mini-item">
                  <div className="complaint-mini-main">
                    <div className="complaint-mini-title">{c.id}</div>
                    <div className="complaint-mini-meta">{c.ward} · {c.wasteType}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="AI Insights"
          subtitle="Latest rule-based operational insights"
          actions={<Link to="/admin/ai" className="btn btn-ghost btn-sm">Open AI <Icon name="chevronRight" size={14} /></Link>}
        >
          {insights.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--txt-muted)' }}>
              No insights generated yet. Run the insights engine from the AI page.
            </p>
          ) : (
            <div className="ai-cards">
              {insights.map((r) => (
                <div key={r._id || r.key} className="ai-card">
                  <Icon name="cpu" size={18} />
                  <div className="ai-card-body">
                    <div className="ai-card-text">{r.title}</div>
                    <Badge tone="info">{r.mode || 'demo-rule-based'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="u-mt-2">
        <SectionCard title="Order analytics" subtitle={oa.total ? `${oa.completionRate}% completion rate` : 'No order data'}>
          <div className="stat-grid">
            <StatCard icon="package" label="Total orders" value={formatNumber(oa.total)} tone="info" />
            <StatCard icon="check" label="Delivered" value={formatNumber(oa.delivered)} tone="success" />
            <StatCard icon="alert-triangle" label="Failed verifications" value={formatNumber(oa.failedAttempts)} tone="danger" />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
