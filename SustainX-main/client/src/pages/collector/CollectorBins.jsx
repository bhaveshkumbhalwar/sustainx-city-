import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useGeoIndex } from '../../hooks/useGeo';
import { getBins, getIotBinData } from '../../services/api';
import { toBinsUi, mergeBinLevels } from '../../adapters/bin.adapter';
import { coordForBin } from '../../services/geo';
import { wardLabel } from '../../lib/geography';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import SectionCard from '../../components/ui/SectionCard';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import MapContainer from '../../components/maps/MapContainer';

export default function CollectorBins() {
  const { user } = useAuth();
  const ward = wardLabel(user?.block);
  const { data: register, loading: regLoading } = useFetch(getBins);
  const { data: readings, loading: readLoading } = useFetch(getIotBinData);
  const geo = useGeoIndex();

  const loading = regLoading || readLoading;
  const bins = useMemo(() => toBinsUi(mergeBinLevels(register, readings)), [register, readings]);
  const blockBins = bins.filter((b) => String(b.block).toUpperCase() === String(user?.block).toUpperCase());
  const total = blockBins.length;
  const high = blockBins.filter((b) => b.level >= 70).length;
  const overflow = blockBins.filter((b) => b.level >= 85).length;

  const markers = useMemo(
    () =>
      blockBins
        .map((b) => {
          const coord = coordForBin(b, geo);
          if (!coord) return null;
          return {
            id: b.id,
            lat: coord.lat,
            lng: coord.lng,
            tone: b.state.tone,
            popup: {
              title: `Bin ${b.binId}`,
              desc: `${b.state.label} · ${b.level}%${coord.real ? '' : ' · ward area (approx.)'}`,
            },
          };
        })
        .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bins, geo, user?.block],
  );

  return (
    <>
      <PageHeader title="Ward bin alerts" subtitle={`Smart bins in ${ward}`} icon="trash" />

      <div className="stat-grid u-mb-1">
        <StatCard icon="trash" label="Total bins" value={total} loading={loading} />
        <StatCard icon="alert-triangle" label="High fill (≥70%)" value={high} loading={loading} tone={high ? 'warning' : 'neutral'} />
        <StatCard icon="alert-triangle" label="Overflow risk" value={overflow} loading={loading} tone={overflow ? 'danger' : 'neutral'} />
      </div>

      <MapContainer markers={markers} title={`${ward} bins`} height={340} demoNote={null} />

      <SectionCard title="All bins" className="u-mt-1">
        {loading ? (
          <div className="bin-list">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-rect" style={{ height: 60 }} />)}
          </div>
        ) : blockBins.length === 0 ? (
          <EmptyState icon="trash" title="No readings" description="No IoT data for your ward yet." />
        ) : (
          <div className="bin-list">
            {blockBins.map((b) => (
              <div className="bin-row" key={b.id}>
                <div className="bin-row-head">
                  <span className="bin-row-name">Bin {b.binId}</span>
                  <Badge tone={b.state.tone} dot>{b.state.label}</Badge>
                </div>
                <div className="bin-row-meta">Updated {b.updatedLabel}</div>
                <div className="bin-level-row">
                  <ProgressBar value={b.level} tone={b.state.tone} label={`${b.binId} fill level`} />
                  <span className="bin-level-pct">{b.level}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}