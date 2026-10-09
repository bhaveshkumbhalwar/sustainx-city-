"""Baselines for bin fill prediction — every ML candidate must beat these.

- last_value: predict current level (persistence baseline).
- linear_extrapolation: extend the last observed hourly rate 2h ahead,
  clipped to [0, 100].
An ML model is only useful if it meaningfully improves on BOTH.
"""


def predict_last_value(current_fill):
    return float(current_fill)


def predict_linear_extrapolation(current_fill, fill_rate_per_hour, horizon_hours=2.0):
    pred = float(current_fill) + float(fill_rate_per_hour) * float(horizon_hours)
    return max(0.0, min(100.0, pred))


def evaluate(y_true, y_pred):
    import numpy as np

    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    denom = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = float(1.0 - np.sum((y_true - y_pred) ** 2) / denom) if denom > 0 else 0.0
    return {'mae': mae, 'rmse': rmse, 'r2': r2, 'n': int(len(y_true))}
