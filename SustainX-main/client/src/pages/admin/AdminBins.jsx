import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useGeoIndex } from '../../hooks/useGeo';
import { usePolling } from '../../hooks/usePolling';
import { getBins, getIotBinData, getBinReadings, getDevices, setDeviceEnabled } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { toBinsUi, mergeBinLevels } from '../../adapters/bin.adapter';
import { binOperationalState } from '../../adapters/alerts.adapter';
import { coordForBin } from '../../services/geo';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import DataTable from '../../components/ui/DataTable';
import MapContainer from '../../components/maps/MapContainer';
import { timeAgo, fmtDateTime } from '../../lib/format';

// Data-quality scan over recent readings (real data only — never deletes).
// Flags: impossible values, sensor spikes (>40pt jump), frozen sensors,
// gaps (no reading in 24h for a registered bin is surfaced via offline).
function scanQuality(bins, readings) {
  const issues = [];
  const byBin = new Map();
  (readings || []).forEach((r) => {
    if (!byBin.has(r.binId)) byBin.set(r.binId, []);
    byBin.get(r.binId).push(r);
  });
  byBin.forEach((rows, binId) => {
    const sorted = [...rows].sort((a, b) => new Date(a.readAt) - new Date(b.readAt));
    const frozen = sorted.length >= 5 && sorted.slice(-5).every((r) => r.level === sorted[sorted.length - 1].level);
    if (frozen) {
      issues.push({ binId, kind: 'Frozen sensor', detail: `Level stuck at ${sorted[sorted.length - 1].level}% for the last ${sorted.length} readings — possible sensor anomaly.` });
    }
    for (let i = 1; i < sorted.length; i += 1) {
      if (Math.abs(sorted[i].level - sorted[i - 1].level) > 40) {
        issues.push({ binId, kind: 'Spike', detail: `Jump ${sorted[i - 1].level}% → ${sorted[i].level}% between consecutive readings — possible sensor anomaly.` });
        break;
      }
    }
    sorted.forEach((r) => {
      if (r.level == null || r.level < 0 || r.level > 100) {
        issues.push({ binId, kind: 'Impossible value', detail: `Out-of-range level recorded: ${r.level}.` });
      }
    });
  });
  const readingBins = new Set((readings || []).map((r) => r.binId));
  (bins || []).forEach((b) => {
    if (!readingBins.has(b.binId)) {
      issues.push({ binId: b.binId, kind: 'No readings', detail: 'Registered bin has no readings in the scanned window.' });
    }
  });
  return issues.slice(0, 20);
}

export default function AdminBins() {
  const { showToast } = useToast();
  const binsFetch = useFetch(getBins);
  const readingsFetch = useFetch(getIotBinData);
  const historyFetch = useFetch(() => getBinReadings({ limit: 500 }), []);
  const devicesFetch = useFetch(getDevices);
  const geo = useGeoIndex();

  usePolling(() => { binsFetch.refetch(); readingsFetch.refetch(); devicesFetch.refetch(); }, 45000);

  const loading = binsFetch.loading || readingsFetch.loading;
  const bins = useMemo(() => toBinsUi(mergeBinLevels(binsFetch.data, readingsFetch.data)), [binsFetch.data, readingsFetch.data]);
  const states = useMemo(() => bins.map((b) => ({ bin: b, state: binOperationalState(b) })), [bins]);

  const count = (key) => states.filter((s) => s.state.key === key).length;
  const online = states.filter((s) => s.bin.online !== false && s.bin.isActive !== false).length;
  const offline = count('OFFLINE');
  const maintenance = count('MAINTENANCE');
  const overflow = count('OVERFLOW_RISK');
  const high = count('HIGH');
  const normal = count('NORMAL') + count('FILLING');
  const avgFill = bins.length > 0 ? Math.round(bins.reduce((a, b) => a + (b.level || 0), 0) / bins.length) : 0;
  const critical = states.filter((s) => s.state.key === 'OVERFLOW_RISK' || s.state.key === 'OFFLINE').slice(0, 8);

  const qualityIssues = useMemo(
    () => scanQuality(bins, historyFetch.data),
    [bins, historyFetch.data],
  );

  const devices = useMemo(
    () => (Array.isArray(devicesFetch.data) ? devicesFetch.data : []),
    [devicesFetch.data],
  );

  const toggleDevice = async (d) => {
    try {
      await setDeviceEnabled(d._id, !d.enabled);
      showToast(`Device ${d.deviceId} ${d.enabled ? 'disabled' : 'enabled'}.`, 'success');
      devicesFetch.refetch();
    } catch (err) {
      showToast(err?.message || 'Could not update device.', 'error');
    }
  };

  const deviceColumns = [
    { key: 'deviceId', label: 'Device ID', sortable: true, render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'binId', label: 'Bin', render: (row) => row.binId || row.bin?.binId || '—' },
    { key: 'block', label: 'Ward', render: (row) => row.block || '—' },
    { key: 'enabled', label: 'Status', render: (row) => (row.enabled ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>) },
    { key: 'lastSeenAt', label: 'Last seen', render: (row) => fmtDateTime(row.lastSeenAt) },
    {
      key: '_toggle',
      label: '',
      width: '120px',
      render: (row) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleDevice(row)}>
          {row.enabled ? 'Disable' : 'Enable'}
        </button>
      ),
    },
  ];

  const markers = useMemo(
    () =>
      bins
        .map((b) => {
          const coord = coordForBin(b, geo);
          if (!coord) return null;
          const st = binOperationalState(b);
          return {
            id: b.id,
            lat: coord.lat,
            lng: coord.lng,
            tone: st.tone,
            popup: {
              title: `Bin ${b.binId}`,
              desc: `${st.label} · ${b.level}%${coord.real ? '' : ' · ward area (approx.)'}`,
            },
          };
        })
        .filter(Boolean),
    [bins, geo],
  );

  const columns = [
    {
      key: 'binId',
      label: 'Bin ID',
      sortable: true,
      render: (_, v) => (
        <Link to={`/admin/bins/${encodeURIComponent(v)}`} className="u-mono">
          {v}
        </Link>
      ),
    },
    { key: 'ward', label: 'Ward', sortable: true },
    { key: 'zone', label: 'Zone', sortable: true },
    { key: 'level', label: 'Level', sortable: true, render: (row) => (
      <div className="bin-level-row">
        <ProgressBar value={row.level} tone={row.state.tone} label={`${row.binId} level`} />
        <span className="bin-level-pct">{row.level}%</span>
      </div>
    ) },
    { key: 'state', label: 'State', render: (row) => <Badge tone={binOperationalState(row).tone} dot>{binOperationalState(row).label}</Badge> },
    { key: 'updatedLabel', label: 'Updated', sortable: true },
  ];

  const qualityColumns = [
    { key: 'binId', label: 'Bin', render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'kind', label: 'Issue', sortable: true },
    { key: 'detail', label: 'Detail' },
  ];

  return (
    <>
      <PageHeader
        title="Smart bins"
        subtitle="City-wide IoT bin fleet health. Auto-refreshes every 45 seconds."
        icon="trash"
      />

      <div className="stat-grid u-mb-1">
        <StatCard icon="trash" label="Total bins" value={bins.length} loading={loading} />
        <StatCard icon="activity" label="Online" value={online} loading={loading} tone="success" />
        <StatCard icon="alert-triangle" label="Offline" value={offline} loading={loading} tone={offline ? 'danger' : 'neutral'} hint="Stale — never treated as empty" />
        <StatCard icon="check" label="Normal" value={normal} loading={loading} tone="success" />
        <StatCard icon="alert-triangle" label="High fill" value={high} loading={loading} tone={high ? 'warning' : 'neutral'} />
        <StatCard icon="alert-triangle" label="Overflow risk" value={overflow} loading={loading} tone={overflow ? 'danger' : 'neutral'} />
        <StatCard icon="settings" label="Maintenance" value={maintenance} loading={loading} tone="neutral" />
        <StatCard icon="chart" label="Average fill" value={`${avgFill}%`} loading={loading} tone="info" />
      </div>

      {critical.length > 0 && (
        <SectionCard title="Critical bins" subtitle="Overflow-risk and offline bins need attention first" className="u-mb-1">
          <div className="bin-list">
            {critical.map(({ bin: b, state }) => (
              <div className="bin-row" key={b.id}>
                <div className="bin-row-head">
                  <Link to={`/admin/bins/${encodeURIComponent(b.binId)}`} className="bin-row-name u-mono">
                    Bin {b.binId}
                  </Link>
                  <Badge tone={state.tone} dot>{state.label}</Badge>
                </div>
                <div className="bin-row-meta">
                  {b.ward} · {b.level}% · last seen {timeAgo(b.lastSeen || b.lastReadingAt || b.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <MapContainer markers={markers} title="All bins map" height={380} demoNote={null} />

      <SectionCard title="Bin register" className="u-mt-1">
        {bins.length === 0 && !loading ? (
          <EmptyState icon="trash" title="No bin readings" description="Register bins and connect IoT devices for data to appear here." />
        ) : (
          <DataTable columns={columns} data={bins} keyField="id" loading={loading} emptyTitle="No bins" emptyDescription="No readings yet." />
        )}
      </SectionCard>

      <SectionCard title="Data quality" subtitle="Sensor anomalies detected in recent readings — investigational flags, never auto-deleted" className="u-mt-1">
        {qualityIssues.length === 0 ? (
          <EmptyState icon="check" title="No anomalies detected" description="Recent readings look consistent across the fleet." />
        ) : (
          <DataTable columns={qualityColumns} data={qualityIssues} keyField="binId" loading={historyFetch.loading} emptyTitle="No issues" />
        )}
      </SectionCard>

      <SectionCard title="Device registry" subtitle="Provisioned IoT devices. Credentials never leave the server; disabling stops ingest auth." className="u-mt-1">
        <DataTable
          columns={deviceColumns}
          data={devices}
          keyField="_id"
          loading={devicesFetch.loading}
          emptyTitle="No devices"
          emptyDescription="Provision devices with the server seed scripts."
        />
      </SectionCard>
    </>
  );
}
