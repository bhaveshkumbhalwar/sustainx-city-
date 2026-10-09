// Smart bin adapters.
// Bin "level" is OBSERVED sensor data. Predictions are never presented as
// readings — the prediction adapter returns clearly-labeled estimates.

import { wardLabel, zoneOf } from '../lib/geography';
import { timeAgo } from '../lib/format';
import { clampPct } from '../lib/format';

export const BIN_STATES = [
  { max: 50, tone: 'success', label: 'Normal' },
  { max: 70, tone: 'warning', label: 'Getting Full' },
  { max: 85, tone: 'high', label: 'High Fill' },
  { max: 101, tone: 'danger', label: 'Overflow Risk' },
];

export function binState(level) {
  const pct = clampPct(level);
  return BIN_STATES.find((s) => pct <= s.max) || BIN_STATES[BIN_STATES.length - 1];
}

// Estimate interpolation for display purposes at +/-15 min (data updates).
export function needsCollection(bin) {
  return clampPct(bin?.level) >= 80;
}

export function toBinUi(raw) {
  const level = clampPct(raw?.level);
  return {
    ...raw,
    id: raw?.binId,
    level,
    state: binState(level),
    ward: wardLabel(raw?.block),
    zone: zoneOf(raw?.block),
    updatedLabel: timeAgo(raw?.lastUpdated || raw?.updatedAt),
    needsCollection: needsCollection(raw),
  };
}

export function toBinsUi(list) {
  return (list || []).map(toBinUi);
}

// Merge SmartBin register records (coordinates, identity) with the latest
// IoT readings (observed fill levels). Reading wins for level; register
// wins for identity/coords. Pure real-data join — no invented values.
export function mergeBinLevels(bins, readings) {
  const byId = new Map((readings || []).map((r) => [String(r?.binId).toUpperCase(), r]));
  return (bins || []).map((bin) => {
    const reading = byId.get(String(bin?.binId).toUpperCase());
    return {
      ...bin,
      level: reading?.level ?? bin?.currentLevel ?? 0,
      lastUpdated: reading?.lastUpdated || bin?.lastReadingAt || bin?.updatedAt,
      alert: bin?.alert ?? false,
    };
  });
}

// Fill estimates come ONLY from GET /api/ai/bins/:binId/fill-estimate.
// They are always labeled "Estimated" in the UI — never as sensor readings.
export function toEstimateUi(raw) {
  if (!raw) return null;
  return {
    binId: raw.binId,
    currentLevel: clampPct(raw.currentLevel),
    estimatedHoursToFull: raw.estimatedHoursToFullBoard ?? null,
    mode: raw.mode || 'demo-rule-based',
  };
}