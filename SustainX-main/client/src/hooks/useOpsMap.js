import { useMemo } from 'react';
import { useFetch } from './useFetch';
import { useGeoIndex } from './useGeo';
import {
  getComplaints,
  getBins,
  getIotBinData,
  getVehicles,
  getHotspots,
} from '../services/api';
import { toComplaintsUi } from '../adapters/complaint.adapter';
import { toBinsUi, mergeBinLevels } from '../adapters/bin.adapter';
import { binOperationalState } from '../adapters/alerts.adapter';
import { coordForBin, coordForComplaint, coordForVehicle } from '../services/geo';
import { wardLabel } from '../lib/geography';
import { timeAgo } from '../lib/format';

const PRIORITY_TONE = { low: 'neutral', medium: 'warning', high: 'danger', critical: 'danger' };

// Shared operational dataset for maps and dashboards:
// complaints + bins (register × readings) + vehicles + hotspots + geo index.
// Returns memoized marker builders so pages never duplicate map logic.
export function useOpsMap() {
  const complaintsFetch = useFetch(getComplaints);
  const binsFetch = useFetch(getBins);
  const readingsFetch = useFetch(getIotBinData);
  const vehiclesFetch = useFetch(getVehicles);
  const hotspotsFetch = useFetch(getHotspots);
  const geo = useGeoIndex();

  const complaints = useMemo(() => toComplaintsUi(complaintsFetch.data), [complaintsFetch.data]);
  const bins = useMemo(
    () => toBinsUi(mergeBinLevels(binsFetch.data, readingsFetch.data)),
    [binsFetch.data, readingsFetch.data],
  );
  const vehicles = useMemo(
    () => (Array.isArray(vehiclesFetch.data) ? vehiclesFetch.data : []),
    [vehiclesFetch.data],
  );
  const hotspotRows = useMemo(
    () => (Array.isArray(hotspotsFetch.data) ? hotspotsFetch.data : []),
    [hotspotsFetch.data],
  );

  const refetchAll = () => {
    complaintsFetch.refetch();
    binsFetch.refetch();
    readingsFetch.refetch();
    vehiclesFetch.refetch();
    hotspotsFetch.refetch();
  };

  const loading =
    complaintsFetch.loading || binsFetch.loading || readingsFetch.loading || vehiclesFetch.loading;

  return { complaints, bins, vehicles, hotspotRows, geo, loading, refetchAll };
}

export function buildOpsMarkers({ bins, complaints, vehicles, hotspotRows, geo }) {
  const binMarkers = (bins || [])
    .map((b) => {
      const c = coordForBin(b, geo);
      if (!c) return null;
      const st = binOperationalState(b);
      return {
        id: `bin:${b.binId}`, layer: 'bins', lat: c.lat, lng: c.lng, tone: st.tone,
        label: `Bin ${b.binId}`, popup: { title: `Bin ${b.binId}`, desc: `${st.label} · ${b.level}%` },
        ref: b,
      };
    })
    .filter(Boolean);
  const complaintMarkers = (complaints || [])
    .filter((c) => c.status !== 'completed')
    .map((c) => {
      const coord = coordForComplaint(c, geo);
      if (!coord) return null;
      return {
        id: `complaint:${c.id}`, layer: 'complaints', lat: coord.lat, lng: coord.lng,
        tone: PRIORITY_TONE[c.priority] || 'info',
        label: c.id, popup: { title: c.id, desc: `${c.ward} · ${c.wasteType} · ${c.status}` },
        ref: c,
      };
    })
    .filter(Boolean);
  const vehicleMarkers = (vehicles || [])
    .map((v) => {
      const coord = coordForVehicle(v);
      if (!coord) return null;
      return {
        id: `vehicle:${v._id}`, layer: 'vehicles', lat: coord.lat, lng: coord.lng, tone: 'success',
        label: v.plate, popup: { title: `${v.plate} — ${v.type || 'vehicle'}`, desc: `${v.status} · updated ${timeAgo(v.lastLocationUpdate)}` },
        ref: v,
      };
    })
    .filter(Boolean);
  const hotspotMarkers = (hotspotRows || [])
    .map((h, i) => {
      const center = geo?.byBlock?.[String(h.block || '').toUpperCase()]?.center;
      if (!center) return null;
      return {
        id: `hotspot:${h.block || i}`, layer: 'hotspots', lat: center.lat, lng: center.lng,
        tone: h.openComplaints >= 10 ? 'danger' : 'warning',
        label: `${wardLabel(h.block)} hotspot`,
        popup: { title: wardLabel(h.block), desc: `${h.openComplaints} open reports · ward area (approx.)` },
        ref: h,
      };
    })
    .filter(Boolean);
  const wardMarkers = (geo?.wards || [])
    .map((w) => {
      if (!w.center) return null;
      return {
        id: `ward:${w.id}`, layer: 'wards', lat: w.center.lat, lng: w.center.lng, tone: 'neutral',
        label: w.name, popup: { title: w.name, desc: `${w.zone} · ward center` },
        ref: w,
      };
    })
    .filter(Boolean);
  return { binMarkers, complaintMarkers, vehicleMarkers, hotspotMarkers, wardMarkers };
}

export default useOpsMap;
