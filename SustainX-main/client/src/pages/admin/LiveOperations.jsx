import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useOpsMap, buildOpsMarkers } from '../../hooks/useOpsMap';
import { usePolling } from '../../hooks/usePolling';
import { getVehicleHistory } from '../../services/api';
import { binOperationalState } from '../../adapters/alerts.adapter';
import { wardLabel } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import CityMap from '../../components/maps/CityMap';
import Icon from '../../components/ui/Icon';
import { fmtDateTime, timeAgo } from '../../lib/format';

const VEHICLE_STATUS_TONE = { available: 'success', on_route: 'info', off_duty: 'neutral', maintenance: 'warning' };

const LAYERS = [
  { key: 'bins', label: 'Smart bins', tone: 'warning' },
  { key: 'complaints', label: 'Complaints', tone: 'info' },
  { key: 'vehicles', label: 'Vehicles', tone: 'success' },
  { key: 'hotspots', label: 'Hotspots', tone: 'danger' },
  { key: 'wards', label: 'Wards', tone: 'neutral' },
];

const HISTORY_RANGES = [
  { key: '1h', label: 'Last 1 hour', ms: 3600 * 1000 },
  { key: '6h', label: 'Last 6 hours', ms: 6 * 3600 * 1000 },
  { key: 'day', label: 'Today', ms: 24 * 3600 * 1000 },
];

const PRIORITY_TONE = { low: 'neutral', medium: 'warning', high: 'danger', critical: 'danger' };

export default function LiveOperations() {
  const { complaints, bins, vehicles, hotspotRows, geo, loading, refetchAll } = useOpsMap();

  usePolling(refetchAll, 45000);

  const [selected, setSelected] = useState(null); // { kind, id }
  const [mobileView, setMobileView] = useState('map');
  const [historyRange, setHistoryRange] = useState(HISTORY_RANGES[1]);

  const markers = useMemo(() => {
    const parts = buildOpsMarkers({ bins, complaints, vehicles, hotspotRows, geo });
    return [
      ...parts.binMarkers,
      ...parts.complaintMarkers,
      ...parts.vehicleMarkers,
      ...parts.hotspotMarkers,
      ...parts.wardMarkers,
    ];
  }, [bins, complaints, vehicles, hotspotRows, geo]);

  const onMarkerSelect = (mk) => {
    const [kind, ...rest] = String(mk.id).split(':');
    setSelected({ kind, id: rest.join(':'), marker: mk });
    setMobileView('map');
  };

  const selectedVehicleId = selected?.kind === 'vehicle' ? selected.id : null;
  const historyFetch = useFetch(
    () => (selectedVehicleId ? getVehicleHistory(selectedVehicleId, { limit: 200 }) : Promise.resolve({ data: [] })),
    [selectedVehicleId],
  );
  const historyPoints = useMemo(() => {
    const rows = Array.isArray(historyFetch.data) ? historyFetch.data : [];
    // Time-window filtering inherently reads the clock; memoized on inputs.
    // eslint-disable-next-line react-hooks/purity
    const cutoff = Date.now() - historyRange.ms;
    return rows.filter((p) => new Date(p.recordedAt).getTime() >= cutoff);
  }, [historyFetch.data, historyRange]);

  const liveVehicles = vehicles.filter((v) => v.status === 'available' || v.status === 'on_route').length;

  const vehicleColumns = [
    { key: 'plate', label: 'Plate', render: (_, v) => <span className="u-mono">{v}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (row) => row.type || '—' },
    { key: 'driver', label: 'Driver', render: (row) => row.driver?.name || '—' },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={VEHICLE_STATUS_TONE[row.status] || 'neutral'} dot>{row.status}</Badge> },
    { key: 'block', label: 'Ward', render: (row) => wardLabel(row.block) },
    { key: 'lastLocationUpdate', label: 'Last GPS', render: (row) => fmtDateTime(row.lastLocationUpdate) },
  ];

  const renderDrawerBody = () => {
    if (!selected) return null;
    if (selected.kind === 'bin') {
      const b = selected.marker.ref;
      const st = binOperationalState(b);
      return (
        <>
          <div className="detail-row"><span className="detail-label">Fill</span><span className="detail-value">{b.level}% (observed)</span></div>
          <div className="detail-row"><span className="detail-label">State</span><Badge tone={st.tone}>{st.label}</Badge></div>
          <div className="detail-row"><span className="detail-label">Ward</span><span className="detail-value">{b.ward}</span></div>
          <div className="detail-row"><span className="detail-label">Last seen</span><span className="detail-value">{timeAgo(b.lastSeen || b.lastReadingAt)}</span></div>
          <Link to={`/admin/bins/${encodeURIComponent(b.binId)}`} className="btn btn-primary btn-sm u-mt-1">Open bin detail</Link>
        </>
      );
    }
    if (selected.kind === 'complaint') {
      const c = selected.marker.ref;
      return (
        <>
          <div className="detail-row"><span className="detail-label">Priority</span><Badge tone={PRIORITY_TONE[c.priority] || 'info'}>{c.priority || '—'}</Badge></div>
          <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{c.status}</span></div>
          <div className="detail-row"><span className="detail-label">Location</span><span className="detail-value">{c.location}</span></div>
          <div className="detail-row"><span className="detail-label">SLA</span><span className="detail-value">{typeof c.slaRemainingMs === 'number' ? (c.slaRemainingMs < 0 ? 'Breached' : `${Math.round(c.slaRemainingMs / 3600000)}h left`) : '—'}</span></div>
          <Link to="/admin/complaints" className="btn btn-primary btn-sm u-mt-1">Open complaints</Link>
        </>
      );
    }
    if (selected.kind === 'vehicle') {
      const v = selected.marker.ref;
      return (
        <>
          <div className="detail-row"><span className="detail-label">Status</span><Badge tone={VEHICLE_STATUS_TONE[v.status] || 'neutral'}>{v.status}</Badge></div>
          <div className="detail-row"><span className="detail-label">Driver</span><span className="detail-value">{v.driver?.name || '—'}</span></div>
          <div className="detail-row"><span className="detail-label">Last GPS</span><span className="detail-value">{fmtDateTime(v.lastLocationUpdate)}</span></div>
          <div className="segmented u-mt-1" role="group" aria-label="History range">
            {HISTORY_RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`segmented-btn ${historyRange.key === r.key ? 'segmented-active' : ''}`}
                onClick={() => setHistoryRange(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {historyFetch.loading ? (
            <div className="skeleton skeleton-text u-mt-1" />
          ) : historyPoints.length === 0 ? (
            <p className="u-text-muted u-text-sm u-mt-1">No GPS points in this range.</p>
          ) : (
            <ul className="complaint-mini-list u-mt-1">
              {historyPoints.slice(0, 8).map((p, i) => (
                <li key={i} className="complaint-mini-item">
                  <div className="complaint-mini-main">
                    <div className="complaint-mini-title u-mono u-text-sm">
                      {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}
                    </div>
                    <div className="complaint-mini-meta">{fmtDateTime(p.recordedAt)}{p.speed != null ? ` · ${p.speed} km/h` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {historyPoints.length > 8 && (
            <p className="u-text-muted u-text-sm">Showing latest 8 of {historyPoints.length} points.</p>
          )}
        </>
      );
    }
    return (
      <div className="detail-row"><span className="detail-label">Info</span><span className="detail-value">{selected.marker?.popup?.desc || ''}</span></div>
    );
  };

  return (
    <>
      <PageHeader
        title="Live Operations"
        subtitle="City-wide activity map and fleet status. Auto-refreshes every 45 seconds."
        icon="activity"
        actions={
          <div className="segmented ops-view-toggle" role="group" aria-label="View">
            <button type="button" className={`segmented-btn ${mobileView === 'map' ? 'segmented-active' : ''}`} onClick={() => setMobileView('map')}>Map</button>
            <button type="button" className={`segmented-btn ${mobileView === 'list' ? 'segmented-active' : ''}`} onClick={() => setMobileView('list')}>List</button>
          </div>
        }
      />

      <div className="stat-grid u-mb-1">
        <StatCard icon="truck" label="Active vehicles" value={liveVehicles} loading={loading} />
        <StatCard icon="map-pin" label="Active complaints" value={complaints.filter((c) => c.status !== 'completed').length} loading={false} tone="warning" />
        <StatCard icon="trash" label="Bins monitored" value={bins.length} loading={false} />
      </div>

      <div className={mobileView === 'list' ? 'ops-hide-mobile' : ''}>
        <CityMap
          markers={markers}
          layers={LAYERS}
          selectedId={selected ? `${selected.kind}:${selected.id}` : null}
          onSelect={onMarkerSelect}
          title="Operations map"
          height={420}
        />
      </div>

      {selected && (
        <div className="map-drawer u-mt-1" role="dialog" aria-label="Selected map item">
          <div className="map-drawer-head">
            <span className="map-drawer-title">{selected.marker?.popup?.title || selected.id}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close details">
              <Icon name="close" size={14} />
            </button>
          </div>
          {renderDrawerBody()}
        </div>
      )}

      <div className={`u-grid-2 u-mt-1 ${mobileView === 'map' ? 'ops-hide-mobile' : ''}`}>
        <SectionCard title="Vehicles" subtitle="Live fleet positions from field GPS reports">
          <DataTable
            columns={vehicleColumns}
            data={vehicles}
            keyField="_id"
            loading={loading}
            emptyTitle="No vehicles"
            emptyDescription="No fleet vehicles are registered yet."
          />
        </SectionCard>

        <SectionCard title="Routes" subtitle="Planned collection routes">
          <EmptyState
            icon="map"
            title="Route planning not available"
            description="The backend does not expose a route-planning endpoint yet, so no routes are shown."
          />
        </SectionCard>
      </div>
    </>
  );
}
