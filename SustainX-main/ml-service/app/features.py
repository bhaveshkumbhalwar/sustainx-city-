"""Feature engineering for bin fill-level prediction.

Leakage contract (audited in tests/test_features.py):
- Every feature for sample at time t uses ONLY readings with readAt <= t.
- The target uses ONLY the first reading with readAt in [t+60min, t+240min].
- No ward/bin statistics computed over the full dataset leak into rows
  (wardIndex mapping is built from the TRAINING split only and stored
  in the artifact).
"""
from datetime import datetime, timezone

FEATURE_COLUMNS = [
    'hour',
    'dayOfWeek',
    'isWeekend',
    'currentFill',
    'previousFill',
    'fillDelta',
    'fillRatePerHour',
    'rollingMean3',
    'rollingStd3',
    'minutesSinceLastReading',
    'wardIndex',
]

HORIZON_MINUTES = 120
TARGET_MIN_OFFSET = 60
TARGET_MAX_OFFSET = 240


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def build_ward_mapping(blocks):
    """Ordinal mapping built from training blocks only."""
    uniq = sorted({str(b).upper() for b in blocks if b})
    return {b: i for i, b in enumerate(uniq)}


def build_samples(readings, ward_mapping):
    """Build (X, y, meta) samples from readings sorted by (binId, readAt).

    readings: iterable of dicts with binId, block, level, readAt.
    Returns (rows, targets, metas). Rows with no future reading in the
    target window are dropped (documented, not imputed).
    """
    import numpy as np

    by_bin = {}
    for r in readings:
        by_bin.setdefault(str(r['binId']), []).append(r)
    for rows in by_bin.values():
        rows.sort(key=lambda r: _as_utc(r['readAt']))

    X, y, metas = [], [], []
    for bin_id, rows in by_bin.items():
        for i in range(3, len(rows)):
            cur = rows[i]
            t = _as_utc(cur['readAt'])
            prev = rows[i - 1]
            # Target: first future reading inside the window (strictly after t).
            target = None
            for fut in rows[i + 1:]:
                delta_min = (_as_utc(fut['readAt']) - t).total_seconds() / 60.0
                if delta_min < TARGET_MIN_OFFSET:
                    continue
                if delta_min > TARGET_MAX_OFFSET:
                    break
                target = float(fut['level'])
                break
            if target is None:
                continue
            window = [float(r['level']) for r in rows[i - 2:i + 1]]
            dt_hours = max((_as_utc(cur['readAt']) - _as_utc(prev['readAt'])).total_seconds() / 3600.0, 1e-6)
            feat = [
                t.hour,
                t.weekday(),
                1 if t.weekday() >= 5 else 0,
                float(cur['level']),
                float(prev['level']),
                float(cur['level']) - float(prev['level']),
                (float(cur['level']) - float(prev['level'])) / dt_hours,
                float(np.mean(window)),
                float(np.std(window)),
                (_as_utc(cur['readAt']) - _as_utc(prev['readAt'])).total_seconds() / 60.0,
                ward_mapping.get(str(cur.get('block', '')).upper(), -1),
            ]
            X.append(feat)
            y.append(target)
            metas.append({'binId': bin_id, 'readAt': t.isoformat()})
    return X, y, metas
