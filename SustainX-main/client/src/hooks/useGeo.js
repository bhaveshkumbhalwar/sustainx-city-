import { useState, useEffect, useMemo } from 'react';
import { getGeoIndex } from '../services/geo';
import { wards as staticWards } from '../lib/geography';

// Loads the real localities hierarchy once (cached in the geo service).
// Returns null until loaded — callers render list views meanwhile.
export function useGeoIndex() {
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    let alive = true;
    getGeoIndex()
      .then((g) => { if (alive) setGeo(g); })
      .catch(() => { if (alive) setGeo(null); });
    return () => { alive = false; };
  }, []);

  return geo;
}

// Ward picker options: live hierarchy first, static config as fallback.
// Shape: [{ code, name, zone }] where code is the backend block value.
export function useWardOptions() {
  const geo = useGeoIndex();
  return useMemo(() => {
    if (geo && geo.wards && geo.wards.length > 0) {
      return geo.wards
        .filter((w) => w.block)
        .map((w) => ({ code: w.block, name: w.name, zone: w.zone }));
    }
    return staticWards().map((w) => ({ code: w.code, name: w.name, zone: w.zone }));
  }, [geo]);
}

export default useGeoIndex;
