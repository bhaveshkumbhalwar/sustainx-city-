import { useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useGeoIndex } from '../../hooks/useGeo';
import { getAiCapabilities, getAiInsights, runAiInsights, getBinFillEstimate, getBins, getHotspots } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { toEstimateUi } from '../../adapters/bin.adapter';
import { wardLabel } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import MapContainer from '../../components/maps/MapContainer';

const CAPABILITY_LABELS = {
  predict_bin_fill: 'Bin fill forecasting',
  predict_complaint_priority: 'Complaint priority prediction',
  classify_waste_image: 'Waste image classification',
  predict_hotspots: 'Hotspot prediction',
};

export default function AdminAi() {
  const { showToast } = useToast();
  const caps = useFetch(getAiCapabilities);
  const insights = useFetch(() => getAiInsights({ limit: 20 }));
  const { data: bins } = useFetch(getBins);
  const hotspots = useFetch(getHotspots);
  const geo = useGeoIndex();

  const [binId, setBinId] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [running, setRunning] = useState(false);

  const capabilities = useMemo(() => {
    const c = caps.data?.capabilities || {};
    return Object.entries(c).map(([key, v]) => ({
      key,
      label: CAPABILITY_LABELS[key] || key,
      status: v?.status || 'UNKNOWN',
      integrationReady: !!v?.integrationReady,
      modelBacked: !!v?.modelBacked,
      note: v?.note || '',
    }));
  }, [caps.data]);

  const insightList = useMemo(() => (Array.isArray(insights.data) ? insights.data : []), [insights.data]);
  const binList = useMemo(() => (Array.isArray(bins) ? bins : []), [bins]);

  const hotspotRows = useMemo(() => {
    const rows = Array.isArray(hotspots.data) ? hotspots.data : [];
    return rows.map((h, i) => ({ id: `HS-${i + 1}`, ward: wardLabel(h.block), block: h.block, open: h.openComplaints }));
  }, [hotspots.data]);

  const hotspotMarkers = useMemo(
    () =>
      hotspotRows
        .map((h) => {
          const center = geo?.byBlock?.[String(h.block || '').toUpperCase()]?.center;
          if (!center) return null;
          return {
            id: h.id,
            lat: center.lat,
            lng: center.lng,
            tone: h.open >= 10 ? 'danger' : h.open >= 5 ? 'warning' : 'success',
            popup: { title: h.ward, desc: `${h.open} open reports · ward area (approx.)` },
          };
        })
        .filter(Boolean),
    [hotspotRows, geo],
  );

  const run = async () => {
    setRunning(true);
    try {
      await runAiInsights();
      showToast('Insights engine ran. Refreshing list.', 'success');
      insights.refetch();
    } catch (err) {
      showToast(err?.message || 'Could not run insights.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const lookup = async () => {
    if (!binId) return;
    setEstimateLoading(true);
    setEstimateError('');
    setEstimate(null);
    try {
      const res = await getBinFillEstimate(binId);
      setEstimate(toEstimateUi(res.data));
    } catch (err) {
      setEstimateError(err?.message || 'Estimate unavailable for this bin.');
    } finally {
      setEstimateLoading(false);
    }
  };

  const hotspotColumns = [
    { key: 'id', label: 'ID' },
    { key: 'ward', label: 'Ward', sortable: true },
    { key: 'open', label: 'Open reports', sortable: true, render: (row) => <Badge tone={row.open >= 10 ? 'danger' : row.open >= 5 ? 'warning' : 'info'}>{row.open}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="AI Insights"
        subtitle="Assistance layer for operations teams. Model-backed predictions are not deployed — rule-based estimates only."
        icon="cpu"
        actions={
          <button type="button" className="btn btn-primary btn-sm" disabled={running} onClick={run}>
            <Icon name="cpu" size={15} /> {running ? 'Running…' : 'Run insights'}
          </button>
        }
      />

      <div className="u-grid-2">
        <SectionCard title="Capabilities" subtitle="Honest integration status per capability">
          {caps.loading ? (
            <div className="skeleton skeleton-text" />
          ) : caps.error ? (
            <ErrorState message={caps.error?.message} onRetry={caps.refetch} />
          ) : capabilities.length === 0 ? (
            <EmptyState icon="cpu" title="No capabilities reported" description="The AI service did not return capability data." />
          ) : (
            <div className="ai-cards">
              {capabilities.map((c) => (
                <div key={c.key} className="ai-card">
                  <Icon name="cpu" size={18} />
                  <div className="ai-card-body">
                    <div className="ai-card-text">{c.label}</div>
                    <div className="ai-card-meta">
                      <Badge tone={c.modelBacked ? 'success' : 'warning'}>{c.status}</Badge>
                      {c.integrationReady && <Badge tone="info">integration-ready</Badge>}
                    </div>
                    {c.note && <div className="u-text-muted u-text-sm">{c.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Generated insights"
          subtitle="Rule-based outputs stored by the insights engine"
          actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => insights.refetch()}>Refresh</button>}
        >
          {insights.loading ? (
            <div className="skeleton skeleton-text" />
          ) : insights.error ? (
            <ErrorState message={insights.error?.message} onRetry={insights.refetch} />
          ) : insightList.length === 0 ? (
            <EmptyState icon="cpu" title="No insights yet" description="Run the insights engine to generate the first batch." />
          ) : (
            <div className="ai-cards">
              {insightList.map((r) => (
                <div key={r._id || r.key} className="ai-card">
                  <Icon name="activity" size={18} />
                  <div className="ai-card-body">
                    <div className="ai-card-text">{r.title}</div>
                    <div className="ai-card-meta">
                      <Badge tone="info">{r.mode || 'demo-rule-based'}</Badge>
                      <span className="u-text-muted u-text-sm">{r.summary}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="u-grid-2 u-mt-1">
        <SectionCard title="Bin fill estimate" subtitle="Observed level vs rule-based estimate">
          <div className="u-flex">
            <select className="form-select" value={binId} onChange={(e) => setBinId(e.target.value)} aria-label="Select bin">
              <option value="">Select bin…</option>
              {binList.map((b) => (
                <option key={b._id || b.binId} value={b.binId}>{b.binId}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" disabled={!binId || estimateLoading} onClick={lookup}>
              {estimateLoading ? 'Estimating…' : 'Get estimate'}
            </button>
          </div>
          {estimateError && <p className="u-text-sm" style={{ color: 'var(--clr-danger)' }}>{estimateError}</p>}
          {estimate && (
            <div className="bin-list u-mt-1">
              <div className="bin-row">
                <div className="bin-row-head">
                  <span className="bin-row-name">Bin {estimate.binId}</span>
                  <Badge tone="warning">Estimated</Badge>
                </div>
                <div className="bin-row-meta">
                  Observed level: <strong>{estimate.currentLevel}%</strong>
                  {' · '}
                  Estimated hours to full: <strong>{estimate.estimatedHoursToFull ?? '—'}</strong>
                  {' · '}
                  <span className="u-text-muted">{estimate.mode}</span>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Hotspot watch" subtitle="Wards with the most open reports">
          <MapContainer markers={hotspotMarkers} title="Hotspot map" height={280} demoNote={null} />
          <div className="u-mt-1">
            <DataTable columns={hotspotColumns} data={hotspotRows} keyField="id" loading={hotspots.loading} emptyTitle="No hotspots" emptyDescription="No open reports right now." />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
