import { getLocalities } from './api';
import { WARD_CONFIG, wardLabel as staticWardLabel, zoneOf as staticZoneOf } from '../lib/geography';

// Real geographic hierarchy + coordinates, sourced from GET /api/localities.
// Wards carry `legacyBlock` (A–E) linking them to complaint/bin `block` values
// and optional `center: { type:'Point', coordinates:[lng,lat] }`.
// Static WARD_CONFIG is used ONLY as an offline fallback — never preferred.

// Static fallback coordinates are intentionally absent: when the backend has
// no coordinates for a record we return null and the UI renders the list
// view instead of placing a fabricated marker.

let cache = null;
let inflight = null;

function wardCenterLatLng(ward) {
  const coords = ward?.center?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function buildIndex(localities) {
  const byBlock = {};
  const wards = [];
  const zones = [];
  (localities || []).forEach((city) => {
    (city.zones || []).forEach((zone) => {
      zones.push({ id: zone._id, name: zone.name, code: zone.code });
      (zone.wards || []).forEach((ward) => {
        const block = ward.legacyBlock ? String(ward.legacyBlock).toUpperCase() : null;
        const entry = {
          id: ward._id,
          name: ward.name,
          code: ward.code,
          block,
          zone: zone.name,
          center: wardCenterLatLng(ward),
        };
        wards.push(entry);
        if (block) byBlock[block] = entry;
      });
    });
  });
  return { byBlock, wards, zones, source: 'api' };
}

function staticIndex() {
  const byBlock = {};
  WARD_CONFIG.forEach((w) => {
    byBlock[w.code] = { id: w.code, name: w.name, code: w.code, block: w.code, zone: w.zone, center: null };
  });
  return {
    byBlock,
    wards: Object.values(byBlock),
    zones: [...new Set(WARD_CONFIG.map((w) => w.zone))].map((name) => ({ id: name, name, code: name })),
    source: 'fallback',
  };
}

export async function getGeoIndex({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  if (inflight && !refresh) return inflight;
  inflight = getLocalities()
    .then((res) => {
      const list = res.data || [];
      const hasWards = list.some((c) => (c.zones || []).some((z) => (z.wards || []).length > 0));
      cache = hasWards ? buildIndex(list) : staticIndex();
      return cache;
    })
    .catch(() => {
      cache = staticIndex();
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function clearGeoCache() {
  cache = null;
}

export function wardLabelFor(block, geo) {
  const hit = geo?.byBlock?.[String(block || '').toUpperCase()];
  if (hit) return hit.name;
  return staticWardLabel(block);
}

export function zoneFor(block, geo) {
  const hit = geo?.byBlock?.[String(block || '').toUpperCase()];
  if (hit) return hit.zone;
  return staticZoneOf(block);
}

// Real bin coordinates from GET /api/bins SmartBin.location ([lng,lat]).
// Falls back to the ward center from localities, else null (no fake pins).
export function coordForBin(bin, geo) {
  const coords = bin?.location?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return { lat, lng, real: true };
  }
  const center = geo?.byBlock?.[String(bin?.block || '').toUpperCase()]?.center;
  if (center) return { ...center, real: false, area: true };
  return null;
}

// Real complaint coordinates: locationPoint ([lng,lat]) or locationData.
export function coordForComplaint(complaint, geo) {
  const lp = complaint?.locationPoint?.coordinates;
  if (Array.isArray(lp) && lp.length === 2) {
    const [lng, lat] = lp;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, real: true };
  }
  const ld = complaint?.locationData;
  if (ld && Number.isFinite(ld.lat) && Number.isFinite(ld.lng)) return { lat: ld.lat, lng: ld.lng, real: true };
  const center = geo?.byBlock?.[String(complaint?.block || '').toUpperCase()]?.center;
  if (center) return { ...center, real: false, area: true };
  return null;
}

// Real vehicle coordinates from currentLocation ([lng,lat]).
export function coordForVehicle(vehicle) {
  const coords = vehicle?.currentLocation?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return { lat, lng, real: true };
  }
  return null;
}
