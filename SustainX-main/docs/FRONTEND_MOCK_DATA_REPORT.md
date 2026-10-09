# SustainX — Frontend Mock Data Report

Generated: 2026-09-14

## Result: zero remaining mock/demo data sources in `client/src`

The former `src/mock/` directory (`operations.mock.js`, `demoGeo.js`) has been
**deleted**. A repository-wide search confirms zero remaining importers or
references (`mock/`, `MOCK_*`, `DEMO_*`, `demoCoordForWard`).

## Removed sources and their replacements

| Former mock | Used in | Replacement (real) | Status |
|---|---|---|---|
| `MOCK_VEHICLES` | LiveOperations, AdminVehicles | `GET /api/vehicles` (table, register, delete, live GPS) | REMOVED |
| `MOCK_ROUTES` | LiveOperations, AdminVehicles | None — no backend endpoint. Honest "Route planning not available" empty state | REMOVED (documented gap) |
| `MOCK_HOTSPOTS` | AdminAi | `GET /api/analytics/hotspots` (open reports per ward, real ward-center coords) | REMOVED |
| `MOCK_AI_RECOMMENDATIONS` | ControlRoom, AdminAi | `GET /api/ai/insights` + `POST /api/ai/insights/run` | REMOVED |
| `MOCK_WARD_PERFORMANCE` (efficiency % / satisfaction %) | AdminAnalytics, AdminWards | `GET /api/analytics/ward-performance` (total/open/resolved/resolvedRate). Efficiency/satisfaction have no endpoint and are no longer shown | REMOVED (documented gap) |
| `DEMO_LABELS` + inline trend values | AdminAnalytics | Weekly trend aggregated from real complaint `createdAt` values | REMOVED |
| `demoCoordForWard` (fabricated map pins) | NearbyBins, AdminBins, CollectorBins, LiveOperations, AdminAi | Real `SmartBin.location` coords → live ward centers → list-only fallback. `MapContainer` demo-note suppressed (`demoNote={null}`) | REMOVED |

## Deliberately kept non-API constants (not mock data)

| File | Content | Why it remains |
|---|---|---|
| `lib/geography.js` (`WARD_CONFIG`) | Static ward/zone fallback mapping for backend block codes | Offline fallback only; live hierarchy preferred via `useWardOptions()`/`useGeoIndex()`. No fabricated metrics or coordinates |
| `adapters/*.js` thresholds | Display buckets (e.g. bin ≥70% high, ≥85% overflow) | Presentation-only thresholds on real observed values, not data |
| `CITY_CONFIG` hierarchy labels | "City → Zone → Ward → Area…" display labels | Static UI labels matching the backend locality model |

## Backend endpoints required for remaining gaps (future work)

| Gap | Required backend work |
|---|---|
| Route planning UI | New endpoint(s), e.g. `GET /api/routes` with stops/vehicle/distance |
| Ward efficiency % / satisfaction % | New analytics aggregations (definition + endpoint) |
| ML-backed predictions | Model deployment behind existing `FEATURE_NOT_AVAILABLE` capabilities |
| Complaint text search | Optional `?search=` support on `GET /api/complaints` (currently frontend-only filtering) |
| Server-side pagination metadata | Optional `X-Total-Count`/page envelope on list endpoints (currently client-side paging) |
