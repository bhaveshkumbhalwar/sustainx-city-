"""Train bin fill-level prediction: export -> validate -> gate -> features ->
chronological split -> baselines -> candidates -> evaluate -> save best.

Gate (production honesty): refuses to write a production artifact unless the
dataset has >= MIN_SAMPLES samples, >= MIN_BINS bins, and >= MIN_SPAN_HOURS
hours of coverage. Override only with --allow-small for explicitly-labeled
pipeline validation (artifacts still recorded as VALIDATION_ONLY, never
PRODUCTION_READY).

Usage:
  python training/train_bin_fill.py --input readings.json --artifacts artifacts
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import baseline, features, registry  # noqa: E402

MIN_SAMPLES = 200
MIN_BINS = 2
MIN_SPAN_HOURS = 48
IMPROVEMENT_MARGIN = 0.05  # ML must beat best baseline MAE by >=5%


def load_readings(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    rows = data if isinstance(data, list) else data.get('readings', [])
    out = []
    for r in rows:
        try:
            out.append({
                'binId': str(r['binId']),
                'block': str(r.get('block', '')),
                'level': float(r['level']),
                'readAt': r['readAt'] if isinstance(r['readAt'], datetime) else datetime.fromisoformat(str(r['readAt']).replace('Z', '+00:00')),
            })
        except (KeyError, TypeError, ValueError):
            continue  # corrupt rows are skipped and counted, never imputed
    return out, len(rows)


def chrono_split(n):
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    return (0, n_train), (n_train, n_train + n_val), (n_train + n_val, n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--artifacts', required=True)
    ap.add_argument('--allow-small', action='store_true',
                    help='Validate the pipeline on small data; artifact recorded as VALIDATION_ONLY')
    ap.add_argument('--min-samples', type=int, default=MIN_SAMPLES)
    ap.add_argument('--min-bins', type=int, default=MIN_BINS)
    ap.add_argument('--min-span-hours', type=float, default=MIN_SPAN_HOURS)
    args = ap.parse_args()

    readings, raw_n = load_readings(args.input)
    bins = {r['binId'] for r in readings}
    span_h = 0.0
    if readings:
        ts = sorted([r['readAt'] if isinstance(r['readAt'], datetime) else r['readAt'] for r in readings])
        span_h = (max(ts) - min(ts)).total_seconds() / 3600.0

    gate = {
        'rawRows': raw_n,
        'validRows': len(readings),
        'bins': len(bins),
        'spanHours': round(span_h, 2),
        'required': {'minSamples': args.min_samples, 'minBins': args.min_bins, 'minSpanHours': args.min_span_hours},
    }
    small = len(readings) < args.min_samples or len(bins) < args.min_bins or span_h < args.min_span_hours
    if small and not args.allow_small:
        print(json.dumps({'status': 'INSUFFICIENT_DATA', 'gate': gate}, indent=2))
        return 2
    if small:
        print('WARNING: --allow-small set. This run validates the PIPELINE only;', file=sys.stderr)
        print('WARNING: any artifact will be recorded as VALIDATION_ONLY, never production.', file=sys.stderr)

    # Ward mapping from TRAINING-period rows only (no leakage): first 70%
    # of the time-ordered readings define the vocabulary used everywhere.
    order = sorted(range(len(readings)), key=lambda i: readings[i]['readAt'])
    ordered = [readings[i] for i in order]
    cut = ordered[int(len(ordered) * 0.70)]['readAt']
    train_mapping = features.build_ward_mapping([r.get('block', '') for r in ordered if r['readAt'] <= cut])
    X_all, y_all, _ = features.build_samples(ordered, train_mapping)
    print(f'samples after featurization: {len(y_all)} (dropped rows lacked a future target window)')

    import numpy as np
    X_all = np.asarray(X_all, dtype=float)
    y_all = np.asarray(y_all, dtype=float)
    (a, b), (c, d), (e, f) = chrono_split(len(y_all))
    Xtr, ytr = X_all[a:b], y_all[a:b]
    Xva, yva = X_all[c:d], y_all[c:d]
    Xte, yte = X_all[e:f], y_all[e:f]
    print(f'chronological split: train={len(ytr)} val={len(yva)} test={len(yte)}')

    # Baselines on validation.
    cur = Xva[:, features.FEATURE_COLUMNS.index('currentFill')]
    rate = Xva[:, features.FEATURE_COLUMNS.index('fillRatePerHour')]
    base_last = baseline.evaluate(yva, [baseline.predict_last_value(v) for v in cur])
    base_lin = baseline.evaluate(yva, [baseline.predict_linear_extrapolation(v, r) for v, r in zip(cur, rate)])
    print(f"baseline last-value: MAE={base_last['mae']:.3f} RMSE={base_last['rmse']:.3f} R2={base_last['r2']:.3f}")
    print(f"baseline linear:     MAE={base_lin['mae']:.3f} RMSE={base_lin['rmse']:.3f} R2={base_lin['r2']:.3f}")
    best_base_mae = min(base_last['mae'], base_lin['mae'])

    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.linear_model import LinearRegression

    candidates = {
        'linear': LinearRegression(),
        'random_forest': RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1),
        'gradient_boosting': GradientBoostingRegressor(random_state=42),
    }
    results = {}
    for name, model in candidates.items():
        model.fit(Xtr, ytr)
        m = baseline.evaluate(yva, model.predict(Xva))
        results[name] = m
        print(f"candidate {name}: MAE={m['mae']:.3f} RMSE={m['rmse']:.3f} R2={m['r2']:.3f}")

    winner = min(results, key=lambda k: results[k]['mae'])
    win_mae = results[winner]['mae']
    improved = win_mae < best_base_mae * (1 - IMPROVEMENT_MARGIN)
    print(f'winner: {winner} (val MAE {win_mae:.3f} vs best baseline {best_base_mae:.3f}, improved={improved})')

    # Residual-based prediction interval from validation residuals.
    best_model = candidates[winner]
    resid = yva - best_model.predict(Xva)
    lo_q, hi_q = float(np.quantile(resid, 0.10)), float(np.quantile(resid, 0.90))

    import joblib
    os.makedirs(args.artifacts, exist_ok=True)
    reg = registry.load_registry(args.artifacts)
    version = registry.next_version(reg, 'bin-fill')
    artifact_file = f'{version}.joblib'
    joblib.dump({
        'model': best_model,
        'modelName': winner,
        'featureColumns': features.FEATURE_COLUMNS,
        'wardMapping': train_mapping,
        'residualInterval': [lo_q, hi_q],
        'horizonMinutes': 120,
    }, os.path.join(args.artifacts, artifact_file))

    readiness = 'VALIDATION_ONLY'
    if not small and improved:
        readiness = 'PRODUCTION_READY'
    entry = registry.record_model(args.artifacts, {
        'name': 'bin-fill',
        'version': version,
        'readiness': readiness,
        'artifactFile': artifact_file,
        'dataset': {'samples': int(len(y_all)), 'bins': len(bins), 'spanHours': round(span_h, 2), 'input': os.path.basename(args.input)},
        'metrics': {'validation': results, 'baselines': {'last_value': base_last, 'linear': base_lin}},
        'features': {'version': 'v1', 'columns': features.FEATURE_COLUMNS},
        'beatsBaseline': bool(improved),
    })
    print(json.dumps({'status': 'ok', 'readiness': readiness, 'version': version, 'metrics': entry['metrics']}, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
