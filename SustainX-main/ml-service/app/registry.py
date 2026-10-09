"""Model registry: append-only versioned metadata (never overwrite)."""
import json
import os
from datetime import datetime, timezone

REGISTRY_FILENAME = 'registry.json'


def registry_path(artifacts_dir):
    return os.path.join(artifacts_dir, REGISTRY_FILENAME)


def load_registry(artifacts_dir):
    path = registry_path(artifacts_dir)
    if not os.path.exists(path):
        return {'models': []}
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    data.setdefault('models', [])
    return data


def save_registry(artifacts_dir, registry):
    os.makedirs(artifacts_dir, exist_ok=True)
    tmp = registry_path(artifacts_dir) + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)
    os.replace(tmp, registry_path(artifacts_dir))


def next_version(registry, model_name):
    existing = [m['version'] for m in registry.get('models', []) if m.get('name') == model_name]
    return f'{model_name}-v{len(existing) + 1}'


def record_model(artifacts_dir, entry):
    registry = load_registry(artifacts_dir)
    entry = dict(entry)
    entry['recordedAt'] = datetime.now(timezone.utc).isoformat()
    registry['models'].append(entry)
    save_registry(artifacts_dir, registry)
    return entry


def production_model(registry, model_name='bin-fill'):
    """Latest entry explicitly marked PRODUCTION_READY, else None."""
    cands = [m for m in registry.get('models', []) if m.get('name') == model_name and m.get('readiness') == 'PRODUCTION_READY']
    if not cands:
        return None
    return sorted(cands, key=lambda m: m.get('recordedAt', ''))[-1]
