import { useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { getLocalities, getWardPerformance } from '../../services/api';
import { wards as staticWards, zones as staticZones } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import ProgressBar from '../../components/ui/ProgressBar';
import Badge from '../../components/ui/Badge';
import ErrorState from '../../components/ui/ErrorState';

export default function AdminWards() {
  const localities = useFetch(getLocalities);
  const perf = useFetch(getWardPerformance);

  const hierarchy = useMemo(() => {
    const cities = Array.isArray(localities.data) ? localities.data : [];
    const wards = [];
    const zones = [];
    let areas = [];
    cities.forEach((city) => {
      (city.zones || []).forEach((zone) => {
        zones.push({ id: zone._id, name: zone.name, code: zone.code, city: city.name });
        (zone.wards || []).forEach((ward) => {
          wards.push({
            id: ward._id,
            name: ward.name,
            code: ward.code,
            block: ward.legacyBlock ? String(ward.legacyBlock).toUpperCase() : null,
            zone: zone.name,
          });
        });
      });
      if (Array.isArray(city.areas)) areas = areas.concat(city.areas);
    });
    return { cities, wards, zones, areas };
  }, [localities.data]);

  const useStatic = hierarchy.wards.length === 0;
  const wardRows = useMemo(() => {
    const perfByBlock = new Map((Array.isArray(perf.data) ? perf.data : []).map((p) => [String(p.block).toUpperCase(), p]));
    if (!useStatic) {
      return hierarchy.wards.map((w) => {
        const p = w.block ? perfByBlock.get(w.block) : null;
        return {
          id: w.id,
          name: w.name,
          zone: w.zone,
          total: p?.total ?? 0,
          open: p?.open ?? 0,
          resolved: p?.resolved ?? 0,
          resolvedRate: p?.resolvedRate ?? 0,
        };
      });
    }
    return staticWards().map((w) => {
      const p = perfByBlock.get(w.code);
      return {
        id: w.code,
        name: `${w.name} (fallback)`,
        zone: w.zone,
        total: p?.total ?? 0,
        open: p?.open ?? 0,
        resolved: p?.resolved ?? 0,
        resolvedRate: p?.resolvedRate ?? 0,
      };
    });
  }, [hierarchy, perf.data, useStatic]);

  const columns = [
    { key: 'name', label: 'Ward', sortable: true, render: (row) => <strong>{row.name}</strong> },
    { key: 'zone', label: 'Zone', sortable: true },
    { key: 'total', label: 'Reports', sortable: true },
    { key: 'open', label: 'Open', sortable: true },
    { key: 'resolved', label: 'Resolved', sortable: true },
    {
      key: 'resolvedRate',
      label: 'Resolved %',
      sortable: true,
      render: (row) => (
        <div className="bin-level-row">
          <ProgressBar value={row.resolvedRate} tone={row.resolvedRate >= 75 ? 'success' : 'warning'} label="Resolved rate" />
          <span className="bin-level-pct">{row.resolvedRate}%</span>
        </div>
      ),
    },
  ];

  const wardCount = useStatic ? staticWards().length : hierarchy.wards.length;
  const zoneCount = useStatic ? staticZones().length : hierarchy.zones.length;

  return (
    <>
      <PageHeader title="Wards & zones" subtitle="City hierarchy: City → Zone → Ward → Area → Collection Point → Bin" icon="map" />

      <div className="stat-grid u-mb-1">
        <StatCard icon="map" label="Wards" value={wardCount} loading={localities.loading} />
        <StatCard icon="map-pin" label="Zones" value={zoneCount} loading={localities.loading} />
        <StatCard icon="list" label="Areas" value={hierarchy.areas.length} loading={localities.loading} tone="info" />
      </div>

      {useStatic && !localities.loading && (
        <p className="u-text-muted u-text-sm u-mb-1">
          No locality records in the backend yet — showing configured fallback wards. Seed city data to manage the real hierarchy.
        </p>
      )}

      {localities.error ? (
        <SectionCard className="u-mb-1">
          <ErrorState message={localities.error?.message} onRetry={localities.refetch} />
        </SectionCard>
      ) : (
        <SectionCard title="Ward performance" subtitle="Open vs resolved per ward (live)">
          <DataTable columns={columns} data={wardRows} keyField="id" loading={localities.loading || perf.loading} emptyTitle="No wards" emptyDescription="No ward data." />
        </SectionCard>
      )}

      <SectionCard title="Coverage map" subtitle={useStatic ? 'Configured fallback wards' : 'Wards from the live city hierarchy'}>
        <div className="ward-coverage">
          {wardRows.map((w) => (
            <div className="ward-chip" key={w.id}>
              <span className="ward-chip-code">{String(w.name).replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase() || '•'}</span>
              <div>
                <strong>{w.name}</strong>
                <span className="ward-chip-zone">{w.zone}</span>
              </div>
              <Badge tone={w.open > 0 ? 'warning' : 'success'}>{w.open} open</Badge>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
