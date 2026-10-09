# SustainX — IoT, GIS & Real-Time Operations Implementation

Generated: 2026-09-14
Backend: 83/83 tests PASS (74 baseline + 9 new, 0 regressions)
Frontend: `npm run lint` clean, `npm run build` passes

---

## 1. IoT architecture (preserved, incrementally improved)

```
ESP32 (esp32_iot_client.ino)
  │  POST /api/iot/data + X-Device-Id / X-Device-Key headers
  ▼
authenticate() — sha256(key) vs apiKeyHash, timingSafeEqual, enabled flag
  │  401 on missing/unknown/disabled/bad key (body credentials rejected)
  ▼
validateReading() — binId required, level 0–100 (400 otherwise)
  ▼
BinReading (immutable history) + BinData (latest) + SmartBin upsert
  │  server-side timestamps only (readAt default, createdAt)
  ▼
Threshold (IOT_ALERT_THRESHOLD, default 80) + cooldown + open-complaint
check → exactly ONE IoT complaint per overflow episode (409 deduplicated)
  ▼
collector + admin notifications → collection task → proof → resolved
```

Changes in this phase (all additive, no contract broken):
- `GET /api/iot/readings?binId=&block=&since=&limit=` (protected) — history
  for charts, diagnostics and ML data prep. Limit capped at 500.
- `GET /api/bins` now includes `online` (boolean) and `lastSeen`, computed
  from `lastReadingAt` against server env `IOT_OFFLINE_AFTER_MIN` (default
  30 min). Offline is staleness only — a stale bin is never treated as empty.
- `GET /api/complaints?binId=` filter (sanitized) — per-bin alert history.
- `GET /api/devices` + `PUT /api/devices/:id` (admin-only, audit-logged) —
  device registry with enable/disable lifecycle. `apiKeyHash` is stripped by
  `Device.toJSON` plus an explicit destructuring guard. No public
  self-registration endpoint exists by design.
- `device.lastSeenAt` is now refreshed on **every** authenticated reading
  (previously only on the alert path), making offline detection honest.
- ESP32 example now reports every cycle; the backend dedups alerts, and
  routine readings feed history + offline detection.

## 2. Device flow & security

- Identity = `deviceId` (uppercase, unique) + key hashed with sha256.
- Secrets live only in device firmware and the server DB hash column.
  The frontend never sees, sends, or stores device credentials
  (`services/api.js` has no credential-sending IoT call).
- Disabled devices get 401 on ingest; re-enabling restores them (tested).
- `IOT_ALLOW_PUBLIC_INGEST` remains a dev-only escape hatch (off in tests).

## 3. Smart bin lifecycle & states

Backend source of truth: `status` enum (`ok`/`near-full`/`full`), `alert`
flag, `isActive`, `lastReadingAt`. UI operational states
(`adapters/alerts.adapter.js: binOperationalState`):
`MAINTENANCE` (isActive=false) → `OFFLINE` (stale) → `OVERFLOW_RISK`
(alert/level≥80/status full) → `HIGH` (level≥70/near-full) → `FILLING`
(≥50) → `NORMAL`. Display buckets only — backend state is never overridden.

Overflow incident logic (unchanged): NORMAL → HIGH → OVERFLOW_RISK → ALERT
(single complaint) → task → collection → low reading → RESOLVED. Repeated
80→83% reports return 409 `deduplicated:true`; no complaint spam.

Not available in the data model (UI shows "Not available", never fakes):
battery level, firmware version. Present: temperature + signal per reading
(where the device sends them), capacity, kind, ward/zone hierarchy.

## 4. GIS architecture

- One reusable layer: `components/maps/CityMap.jsx` (Leaflet + OSM, no key,
  no new dependencies) fed by `hooks/useOpsMap.js` + marker builders —
  no raw API calls inside map components, no duplicated map logic.
- GeoJSON points `[lng, lat]` throughout; backend `$near` radius queries
  (`/api/bins?lat=&lng=&radiusKm=`, `/api/gis/nearby-*`) are used for
  nearby search — React never distance-scans bulk records.
- Layers (only data-backed ones offered): bins, complaints, vehicles,
  hotspots, wards. No routes layer (no backend endpoint).
- Markers encode state by tone + label text (never color alone); bins show
  exact registered coords, complaints show GPS or ward-center pins labeled
  "approx.", vehicles show live GPS only when reported.
- Grid clustering for dense/coincident pins, viewport culling with a 500-pin
  render cap ("showing X of Y"), layer toggles with live counts, click →
  detail drawer, list↔map selection sync, mobile Map/List toggle, full list
  fallback when coordinates are absent (keyboard-accessible).
- Ward/zone boundaries: backend stores ward **centers**, not polygons —
  boundary polygons are documented as NOT AVAILABLE, not fabricated.

## 5. Real-time architecture

No WebSocket/Socket.IO infrastructure exists in the backend, so no fake
real-time was built. Instead:
- `hooks/usePolling.js`: visibility-aware interval polling (45s bins/ops,
  60s control room, 30s notification bell), minimum 15s floor, pauses on
  hidden tabs, refetch on tab-visible. No per-second polling anywhere.
- "Auto-refreshes every N seconds" subtitles disclose the mechanism.
- Critical alerts surface through the existing notification system
  (single system — no parallel alert bus) plus the unified alert feed
  (`buildAlerts`: BIN_OVERFLOW / BIN_OFFLINE / SLA_WARNING / SLA_BREACH /
  CRITICAL_COMPLAINT → INFO/WARNING/HIGH/CRITICAL, severity-sorted).

## 6. Vehicles & collectors

- Vehicle GPS ping (`PUT /api/vehicles/:id/location`, collector/admin),
  live position display, and history viewer with Last-1h/6h/Today ranges
  (client-side windowing over real `recordedAt` data) in AdminVehicles and
  the LiveOperations drawer.
- No collector GPS exists in the backend — staff tracking is documented as
  NOT AVAILABLE and is not shown. Citizen maps expose no driver/collector
  personal data; names appear only on admin-role screens backed by the API.

## 7. Route planning & AI/ML status

- Route optimization: NOT AVAILABLE (no backend endpoint). LiveOperations
  and AdminVehicles show an honest empty state. `services/routing.js`
  defines the integration contract (route model + `optimizeRoute()` resolving
  `NOT_AVAILABLE`) ready for a future OSRM/GraphHopper/custom optimizer.
- ML predictions: no model connected. `/api/ai/*` capabilities honestly
  report `FEATURE_NOT_AVAILABLE`; the bin estimate UI labels Observed vs
  Estimated and shows "Unavailable" when the endpoint 404s.
- ML data prep: `BinReading` history carries timestamp, fillLevel,
  temperature, signal, ward/block, bin link — sufficient feature basis for
  future training; no fake model was trained.

## 8. Data-quality report (real readings, flags only — nothing deleted)

Automated scan (`AdminBins → Data quality`, same rules documented here):
- **Frozen sensor**: level identical across ≥5 consecutive readings.
- **Spike**: >40-point jump between consecutive readings (e.g. 0→100→0).
- **Impossible value**: level outside 0–100 (rejected at ingest; historical
  scan is a backstop).
- **No readings**: registered bin with zero readings in the window.
- **Offline**: no reading within `IOT_OFFLINE_AFTER_MIN` (server-computed).
- Known seed-data caveat: the old example firmware only transmitted ≥80%,
  so healthy bins can look stale; the updated sketch reports every cycle.

## 9. Security review (IoT/GIS/tracking)

- Ingest auth enforced + tested (missing/unknown/disabled/wrong key → 401;
  body credentials → 401; invalid level → 400).
- Device registry admin-only; hashes never serialized; enable/disable is
  audit-logged (`device.enabled`/`device.disabled`).
- GIS privacy: citizen pages show bins + own complaints only; no personal
  data in citizen map popups; vehicle/driver details restricted to
  authenticated operational roles via existing route guards.
- No secrets in frontend (only public `VITE_API_URL`); no payload logging.

## 10. Implementation status

| Feature | Status |
|---|---|
| Device auth / validation / dedup / overflow single-alert | IMPLEMENTED (preserved + tested) |
| Readings history endpoint + charts (24h/7d/30d) | IMPLEMENTED |
| Online/offline flags + health dashboard + critical list | IMPLEMENTED |
| Bin detail page (identity/status/sensors/timeline/alerts/estimate) | IMPLEMENTED |
| Device registry + enable/disable | IMPLEMENTED |
| Reusable GIS layer (layers/clustering/viewport/sync/drawer/mobile) | IMPLEMENTED |
| Nearby search via backend geo queries | IMPLEMENTED |
| Vehicle location + history ranges + vehicle layer | IMPLEMENTED |
| Controlled polling + unified alert feed + control-room KPIs | IMPLEMENTED |
| Route optimization | NOT AVAILABLE (contract ready, honest empty state) |
| ML predictions | NOT AVAILABLE (honest labels, data prep ready) |
| Ward boundary polygons / collector GPS / battery / firmware | NOT AVAILABLE (shown as unavailable, never faked) |
| WebSocket real-time | NOT AVAILABLE (polling fallback implemented) |

## 11. Tests & validation

- Backend: **83/83 PASS** (`node --test --test-concurrency=1 "tests/*.test.js"`),
  including new `tests/iot-ops.test.js` (9 tests: auth, history+filters,
  online flags, single-alert dedup, binId filter, device admin + lifecycle,
  no hash leakage).
- Frontend: `npx eslint src` clean, `npm run build` passes.
- Live verification: real DEV-001 ingest → 201 → bin flipped offline→online,
  reading in history, 10 seeded devices listed with no hash leakage.
- No test was weakened; no validation bypassed; no fake data introduced.
