"""Inference pipeline: validate -> load artifact -> featurize -> predict.

Returns (ok, payload): ok=False means INSUFFICIENT_DATA / MODEL_NOT_AVAILABLE
and the caller (Node) must fall back to rule-based behavior — never fake.
Uncertainty is a residual-based prediction interval, never a confidence %.
"""
import os
import time
from datetime import datetime, timezone

import joblib
import numpy as np

from . import features
from . import registry as registry_mod

PREDICTION_TTL_MINUTES = 15

_counters = {'count': 0, 'errors': 0, 'totalMs': 0.0}


def counters():
    c = dict(_counters)
    c['avgMs'] = (c['totalMs'] / c['count']) if c['count'] else 0.0
    return c


def load_production(artifacts_dir, model_name='bin-fill'):
    reg = registry_mod.load_registry(artifacts_dir)
    entry = registry_mod.production_model(reg, model_name)
    if not entry:
        return None, {'status': 'INSUFFICIENT_DATA', 'detail': 'No production-ready model artifact is deployed.'}
    path = os.path.join(artifacts_dir, entry.get('artifactFile', ''))
    if not path or not os.path.exists(path):
        return None, {'status': 'MODEL_NOT_AVAILABLE', 'detail': 'Registry references a missing artifact file.'}
    try:
        bundle = joblib.load(path)
    except Exception as exc:  # corrupt artifact must not crash inference
        return None, {'status': 'MODEL_NOT_AVAILABLE', 'detail': f'Artifact failed to load: {exc}'}
    return (entry, bundle), None


def predict_bin_fill(artifacts_dir, bin_id, readings):
    """readings: list of dicts {readAt(datetime), level, ...} ascending."""
    started = time.perf_counter()
    try:
        loaded, err = load_production(artifacts_dir)
        if err:
            return False, err
        entry, bundle = loaded
        model = bundle['model']
        ward_mapping = bundle.get('wardMapping', {})
        interval = bundle.get('residualInterval', [-5.0, 5.0])

        rows = [
            {'binId': bin_id, 'block': r.get('block', ''), 'level': float(r['level']), 'readAt': r['readAt']}
            for r in readings
        ]
        # Featurize using the last row as "now": need >=4 readings (schema
        # already enforces min_length=4); build_samples drops unusable tails.
        X, _, _ = features.build_samples(rows, ward_mapping)
        if not X:
            return False, {'status': 'INSUFFICIENT_DATA', 'detail': 'Not enough usable history to featurize this bin.'}
        x = np.asarray(X[-1:], dtype=float)
        pred = float(model.predict(x)[0])
        pred = max(0.0, min(100.0, pred))
        now = datetime.now(timezone.utc)
        lo = max(0.0, min(100.0, pred + float(interval[0])))
        hi = max(0.0, min(100.0, pred + float(interval[1])))
        payload = {
            'binId': bin_id,
            'currentFill': float(readings[-1]['level']),
            'predictedFill': round(pred, 1),
            'horizonMinutes': 120,
            'predictionInterval': {'lo': round(lo, 1), 'hi': round(hi, 1)},
            'modelVersion': entry['version'],
            'generatedAt': now.isoformat(),
            'expiresAt': (now.timestamp() + PREDICTION_TTL_MINUTES * 60),
        }
        payload['expiresAt'] = datetime.fromtimestamp(payload['expiresAt'], tz=timezone.utc).isoformat()
        return True, payload
    except Exception as exc:
        return False, {'status': 'MODEL_NOT_AVAILABLE', 'detail': f'Inference failed: {exc}'}
    finally:
        elapsed = (time.perf_counter() - started) * 1000.0
        _counters['count'] += 1
        _counters['totalMs'] += elapsed


def note_error():
    _counters['errors'] += 1
