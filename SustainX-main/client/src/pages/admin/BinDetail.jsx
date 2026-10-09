import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import {
  getBins,
  getBinReadings,
  getComplaints,
  getBinFillEstimate,
  getDevices,
} from '../../services/api';
import { toBinsUi, mergeBinLevels, toEstimateUi } from '../../adapters/bin.adapter';
import { binOperationalState } from '../../adapters/alerts.adapter';
import { wardLabel, zoneOf } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import DataTable from '../../components/ui/DataTable';
import ChartCard from '../../components/charts/ChartCard';
import LineChart from '../../components/charts/LineChart';
import { fmtDateTime, timeAgo, fmtDate } from '../../lib/format';

const RANGES = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '7d', label: '7 days', hours: 24 * 7 },
  { key: '30d', label: '30 days', hours: 24 * 30 },
];

const field = (label, value) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value}</span>
  </div>
);

export default function BinDetail() {
  const { binId } = useParams();
  const [range, setRange] = useState(RANGES[1]);

  const binsFetch = useFetch(getBins);
  const bin = useMemo(() => {
    const list = toBinsUi(mergeBinLevels(binsFetch.data, []));
    return list.find((b) => String(b.binId).toUpperCase() === String(binId).toUpperCase()) || null;
  }, [binsFetch.data, binId]);

  // Range start is clock-derived by nature; recomputed only when range changes.
  // eslint-disable-next-line react-hooks/purity
  const since = useMemo(() => new Date(Date.now() - range.hours * 3600 * 1000).toISOString(), [range]);
  const readingsFetch = useFetch(() => getBinReadings({ binId, since, limit: 500 }), [binId, since]);
  const readings = useMemo(() => {
    const rows = Array.isArray(readingsFetch.data) ? [...readingsFetch.data] : [];
    return rows.sort((a, b) => new Date(a.readAt) - new Date(b.readAt));
  }, [readingsFetch.data]);

  const alertsFetch = useFetch(() => getComplaints({ binId }), [binId]);
  const alerts = useMemo(() => (Array.isArray(alertsFetch.data) ? alertsFetch.data : []), [alertsFetch.data]);

  const estimateFetch = useFetch(() => getBinFillEstimate(binId), [binId]);
  const estimate = useMemo(() => toEstimateUi(estimateFetch.data), [estimateFetch.data]);

  const devicesFetch = useFetch(getDevices);
  const device = useMemo(() => {
    const list = Array.isArray(devicesFetch.data) ? devicesFetch.data : [];
    return list.find((d) => String(d.binId).toUpperCase() === String(binId).toUpperCase()) || null;
  }, [devicesFetch.data, binId]);

  const state = binOperationalState(bin);
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  const historyPoints = useMemo(() => {
    const step = Math.max(1, Math.floor(readings.length / 40));
    return readings.filter((_, i) => i % step === 0).map((r) => ({
      label: fmtDate(r.readAt),
      value: r.level,
    }));
  }, [readings]);

  const alertColumns = [
    { key: 'complaintId', label: 'Alert', render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', label: 'Raised', render: (row) => fmtDateTime(row.createdAt) },
  ];

  if (binsFetch.loading) {
    return (
      <>
        <PageHeader title={`Bin ${binId}`} icon="trash" />
        <div className="skeleton skeleton-rect" style={{ height: 220 }} />
      </>
    );
  }

  if (binsFetch.error) {
    return (
      <>
        <PageHeader title={`Bin ${binId}`} icon="trash" />
        <ErrorState message={binsFetch.error?.message} onRetry={binsFetch.refetch} />
      </>
    );
  }

  if (!bin) {
    return (
      <>
        <PageHeader title={`Bin ${binId}`} icon="trash" />
        <EmptyState icon="trash" title="Bin not found" description="No registered bin matches this ID." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Bin ${bin.binId}`}
        subtitle={`${wardLabel(bin.block)} · ${zoneOf(bin.block)}`}
        icon="trash"
        actions={<Link to="/admin/bins" className="btn btn-ghost btn-sm">All bins</Link>}
      />

      <div className="stat-grid u-mb-1">
        <StatCard icon="trash" label="Observed fill" value={`${bin.level ?? 0}%`} tone={state.tone} hint={bin.alert ? 'Overflow flag set by backend' : 'Latest sensor reading'} />
        <StatCard icon="activity" label="Operational state" value={state.label} tone={state.tone} hint={bin.online === false ? 'Stale — never treated as empty' : 'Reporting normally'} />
        <StatCard icon="clock" label="Last seen" value={timeAgo(bin.lastSeen || bin.lastReadingAt)} hint={fmtDateTime(bin.lastSeen || bin.lastReadingAt)} />
        <StatCard
          icon="cpu"
          label="Fill estimate"
          value={estimate ? `~${estimate.estimatedHoursToFull ?? '—'}h to full` : 'Unavailable'}
          hint="Estimated — not a sensor reading"
          tone="neutral"
        />
      </div>

      <div className="u-grid-2">
        <SectionCard title="Identity & status">
          <div className="detail-panel">
            {field('Bin ID', <span className="u-mono">{bin.binId}</span>)}
            {field('Name', bin.name || '—')}
            {field('Kind', bin.kind || '—')}
            {field('Ward / Zone', `${wardLabel(bin.block)} / ${zoneOf(bin.block)}`)}
            {field('Capacity', `${bin.capacityL ?? '—'} L`)}
            {field('Backend status', <Badge tone={state.tone} dot>{bin.status || '—'}</Badge>)}
            {field('Connectivity', bin.online === false ? <Badge tone="danger">Offline</Badge> : <Badge tone="success">Online</Badge>)}
            {field('Location', bin.location?.coordinates?.length === 2 ? `${bin.location.coordinates[1].toFixed(5)}, ${bin.location.coordinates[0].toFixed(5)}` : 'Not mapped')}
          </div>
        </SectionCard>

        <SectionCard title="Device & sensors">
          <div className="detail-panel">
            {field('Device ID', device ? <span className="u-mono">{device.deviceId}</span> : 'Not linked')}
            {field('Device status', device ? (device.enabled ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>) : '—')}
            {field('Device last seen', device?.lastSeenAt ? fmtDateTime(device.lastSeenAt) : '—')}
            {field('Temperature', latestReading?.temperature != null ? `${latestReading.temperature} °C (observed)` : 'Not available')}
            {field('Signal', latestReading?.signal != null ? `${latestReading.signal} (observed)` : 'Not available')}
            {field('Battery', 'Not available')}
            {field('Firmware', 'Not available')}
          </div>
        </SectionCard>
      </div>

      <ChartCard
        title="Fill level history"
        subtitle={`Observed readings · ${readings.length} points`}
        actions={
          <div className="segmented">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`segmented-btn ${range.key === r.key ? 'segmented-active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        {readingsFetch.loading ? (
          <div className="skeleton skeleton-rect" style={{ height: 120 }} />
        ) : readingsFetch.error ? (
          <ErrorState message={readingsFetch.error?.message} onRetry={readingsFetch.refetch} />
        ) : historyPoints.length >= 2 ? (
          <LineChart points={historyPoints} valueFormatter={(v) => `${v}%`} name="fill level" />
        ) : (
          <EmptyState icon="chart" title="No history in range" description="Readings will appear here as the device reports. Try a wider range." />
        )}
      </ChartCard>

      <SectionCard title="Alerts for this bin" subtitle="Overflow complaints raised from sensor readings" className="u-mt-1">
        <DataTable
          columns={alertColumns}
          data={alerts}
          keyField="complaintId"
          loading={alertsFetch.loading}
          emptyTitle="No alerts"
          emptyDescription="No overflow complaints have been raised for this bin."
        />
      </SectionCard>
    </>
  );
}
