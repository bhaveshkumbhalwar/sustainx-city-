import { useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch';
import {
  getComplaints,
  getDashboardStats,
  getAnalyticsOverview,
  getWardPerformance,
  getSlaCompliance,
  getResolutionTime,
  getBinUtilization,
  getHotspots,
} from '../../services/api';
import { toComplaintsUi } from '../../adapters/complaint.adapter';
import { toBarPoints, toStatusSegments, weeklyTrendFromComplaints, safeRate } from '../../adapters/analytics.adapter';
import { wardLabel } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import DataTable from '../../components/ui/DataTable';
import ChartCard from '../../components/charts/ChartCard';
import BarChart from '../../components/charts/BarChart';
import DonutChart from '../../components/charts/DonutChart';
import LineChart from '../../components/charts/LineChart';
import { formatNumber } from '../../lib/format';

export default function AdminAnalytics() {
  const { data: raw } = useFetch(getComplaints);
  const { data: stats } = useFetch(getDashboardStats);
  const overview = useFetch(getAnalyticsOverview);
  const wardPerf = useFetch(getWardPerformance);
  const sla = useFetch(getSlaCompliance);
  const resolution = useFetch(getResolutionTime);
  const binUtil = useFetch(getBinUtilization);
  const hotspots = useFetch(getHotspots);

  const complaints = useMemo(() => toComplaintsUi(raw), [raw]);
  const s = useMemo(() => stats || {}, [stats]);
  const ov = overview.data || {};
  const ovComplaints = ov.complaints || {};
  const ovBins = ov.bins || {};
  const ovOrders = ov.orders || {};

  const wardBarPoints = useMemo(
    () => toBarPoints(wardPerf.data, { labelKey: 'block', valueKey: 'total' }),
    [wardPerf.data],
  );
  const slaBarPoints = useMemo(
    () => toBarPoints(sla.data, { labelKey: 'block', valueKey: 'complianceRate', tone: 'success' }),
    [sla.data],
  );
  const resolutionBarPoints = useMemo(
    () => toBarPoints(resolution.data, { labelKey: 'block', valueKey: 'avgResolutionHours', tone: 'warning' }),
    [resolution.data],
  );
  const binBarPoints = useMemo(
    () => toBarPoints(binUtil.data, { labelKey: 'block', valueKey: 'avgLevel', tone: 'info' }),
    [binUtil.data],
  );
  const weeklyLinePoints = useMemo(() => weeklyTrendFromComplaints(complaints), [complaints]);
  const statusSegments = useMemo(() => toStatusSegments(s), [s]);

  const hotspotRows = useMemo(() => {
    const rows = Array.isArray(hotspots.data) ? hotspots.data : [];
    return rows.map((h, i) => ({
      id: `HS-${i + 1}`,
      ward: wardLabel(h.block),
      block: h.block,
      open: h.openComplaints,
    }));
  }, [hotspots.data]);

  const hotspotColumns = [
    { key: 'id', label: 'ID' },
    { key: 'ward', label: 'Ward', sortable: true },
    { key: 'open', label: 'Open reports', sortable: true, render: (row) => <Badge tone={row.open >= 10 ? 'danger' : row.open >= 5 ? 'warning' : 'info'}>{row.open}</Badge> },
  ];

  const wardPerfColumns = [
    { key: 'block', label: 'Ward', sortable: true, render: (row) => <strong>{wardLabel(row.block)}</strong> },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'open', label: 'Open', sortable: true },
    { key: 'resolved', label: 'Resolved', sortable: true },
    { key: 'resolvedRate', label: 'Resolved %', sortable: true, render: (row) => `${row.resolvedRate ?? 0}%` },
  ];

  const anyError = overview.error || wardPerf.error || sla.error || resolution.error || binUtil.error || hotspots.error;
  const anyLoading = overview.loading || wardPerf.loading || sla.loading || resolution.loading || binUtil.loading || hotspots.loading;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Live aggregated metrics across the city."
        icon="chart"
      />

      <div className="stat-grid u-mb-1">
        <StatCard icon="list" label="Total reports" value={formatNumber(ovComplaints.total ?? s.total ?? 0)} loading={overview.loading && !stats} tone="info" />
        <StatCard icon="clock" label="Open reports" value={formatNumber(ovComplaints.open ?? ((s.pending || 0) + (s.progress || 0)))} loading={overview.loading && !stats} tone="warning" />
        <StatCard icon="check" label="Resolved" value={formatNumber(ovComplaints.resolved ?? s.done ?? 0)} loading={overview.loading && !stats} tone="success" />
        <StatCard icon="trash" label="Bins alerting" value={formatNumber(ovBins.alerting ?? 0)} loading={overview.loading} tone={ovBins.alerting ? 'danger' : 'neutral'} />
        <StatCard icon="package" label="Orders delivered" value={formatNumber(ovOrders.delivered ?? s.orderAnalytics?.delivered ?? 0)} loading={overview.loading && !stats} />
        <StatCard icon="activity" label="Order completion" value={`${safeRate(ovOrders.delivered, ovOrders.total)}%`} loading={overview.loading} />
      </div>

      {anyError && !anyLoading && (
        <SectionCard className="u-mb-1">
          <ErrorState message={anyError?.message} onRetry={() => { overview.refetch(); wardPerf.refetch(); sla.refetch(); resolution.refetch(); binUtil.refetch(); hotspots.refetch(); }} />
        </SectionCard>
      )}

      <div className="u-grid-2 u-mt-1">
        <ChartCard title="Reports by ward" subtitle="Live complaint count per ward">
          <BarChart points={wardBarPoints} valueFormatter={(v) => String(v)} name="reports per ward" />
        </ChartCard>

        <ChartCard title="Status breakdown">
          <DonutChart segments={statusSegments} valueFormatter={(v) => String(v)} center={String(s.total || 0)} />
        </ChartCard>
      </div>

      <div className="u-grid-2 u-mt-1">
        <ChartCard title="Weekly complaint trend" subtitle="New reports per day, last 7 days (live)">
          <LineChart points={weeklyLinePoints} valueFormatter={(v) => String(v)} name="weekly trend" />
        </ChartCard>

        <ChartCard title="SLA compliance by ward" subtitle="Share of resolved reports closed within SLA (%)">
          <BarChart points={slaBarPoints} valueFormatter={(v) => `${v}%`} name="sla compliance" />
        </ChartCard>
      </div>

      <div className="u-grid-2 u-mt-1">
        <ChartCard title="Avg resolution time by ward" subtitle="Mean hours from report to resolution">
          <BarChart points={resolutionBarPoints} valueFormatter={(v) => `${v}h`} name="resolution time" />
        </ChartCard>

        <ChartCard title="Bin fill by ward" subtitle="Average observed fill level (%)">
          <BarChart points={binBarPoints} valueFormatter={(v) => `${v}%`} name="bin fill" />
        </ChartCard>
      </div>

      <div className="u-grid-2 u-mt-1">
        <SectionCard title="Ward performance" subtitle="Open vs resolved per ward (live)">
          <DataTable
            columns={wardPerfColumns}
            data={Array.isArray(wardPerf.data) ? wardPerf.data : []}
            keyField="block"
            loading={wardPerf.loading}
            emptyTitle="No ward data"
            emptyDescription="Ward aggregates will appear once reports exist."
          />
        </SectionCard>

        <SectionCard title="Hotspot watch" subtitle="Wards with the most open reports (rule-based)">
          {hotspotRows.length === 0 && !hotspots.loading ? (
            <EmptyState icon="map-pin" title="No hotspots" description="No open reports right now." />
          ) : (
            <DataTable columns={hotspotColumns} data={hotspotRows} keyField="id" loading={hotspots.loading} emptyTitle="No hotspots" />
          )}
        </SectionCard>
      </div>
    </>
  );
}
