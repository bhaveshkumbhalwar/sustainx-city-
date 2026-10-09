# SustainX Backend Transformation — Final Report (§80)

## 1. Architecture Summary

The backend is a layered Express 5 application composed in `server/app.js` (exported factory) and booted by `server/server.js` (connect + listen + graceful shutdown on SIGTERM/SIGINT). Request flow is:

`routes → controllers → services → models (Mongoose)` with cross-cutting middleware:

- CORS allow-list driven by `ALLOWED_ORIGINS` (defaults to dev origins)
- Request logger (method, status, duration — never logs bodies)
- JSON body parser with 10kb limit
- In-memory dependency-free rate limiter (login 20/5min, register 20/h, IoT 120/min, GIS 300/min)
- JWT auth + role guard middleware (`authMiddleware`, `config/roles.js` with role aliases)
- Multer upload (Cloudinary via `UPLOAD_DRIVER=cloudinary`, `local` fallback for dev/tests)
- API 404 handler + centralized global error handler (operational errors via `ApiError`, duplicate-key 11000, file-size 5MB)

Core business logic lives in seven services under `server/services/`: `notificationService`, `slaService`, `rewardService`, `complaintService`, `iotService`, `analyticsService`, `aiService`, `auditService`. The system is fully decoupled from the frontend and is validated by a native `node:test` suite that runs against a dedicated `sustainx_test` MongoDB database.

## 2. Existing Functionality Preserved

- All previously existing endpoint shapes are unchanged for client-facing routes; responses are **not** wrapped in envelopes.
- Canonical roles remain `student | collector | admin`; each additionally mapped through `config/roles.js` alias table.
- Legacy block semantics (A–E) preserved on `User`, `Complaint`, `BinData`, and ward mapping (`legacyBlock`).
- JWT login/register/me, complaints list/create/status update/complete, store item list + redeem with pickup code, rewards list, notifications list/read, users list — all verified by the test suite.
- Frontend remained untouched: `client` still lints and builds green; only additive changes were made for new statuses (`complaint.adapter.js`, `StatusBadge.jsx`).
- `esp32_iot_client.ino` still posts the same payload; only the authentication headers (X-Device-Id / X-Device-Key) were added.

## 3. New City-Level Features

- **Locality hierarchy**: `City` → `Zone` → `Ward` → `Area` with admin REST CRUD and a nested `GET /api/localities` picker payload; `ward.legacyBlock` links old campus blocks to city wards.
- **Smart bin network**: `SmartBin`, `BinReading` models; bin CRUD, live `currentLevel/status/alert`, `GET /api/bins/nearby` geospatial proximity lookup.
- **Device registry**: `Device` model (deviceId, sha256 api-key hash, enabled flag, block/ward/binding, alert cooldown) with admin CRUD + secrets generator.
- **Fleet + tasks**: `Vehicle`, `VehicleLocation` (live position + history endpoint), `CollectionTask` lifecycle (queue → assign → start → complete with image proof).
- **SLA management**: priority-derived deadlines (low 48h / medium 24h / high 8h / critical 2h, overridable via `SLA_POLICIES`), `slaDeadline`, live `slaRemainingMs`/`isSlaOverdue` virtuals, breach flag.
- **Citizen review loop**: student can confirm resolution (`citizen_confirmed`) or reopen (`reopened`) a completed complaint.
- **Analytics**: overview KPIs, ward performance, SLA compliance, resolution time, bin utilization, hotspot reports (all admin-only).
- **GIS**: `GET /api/gis/nearby-complaints` and `GET /api/gis/nearby-bins` (radius search).
- **AI insights module**: rule-based demo engine + capabilities endpoint (see §9).
- **Audit log**: admin/changes tracked in `AuditLog` via `auditService`.
- **Idempotent city seeding**: `npm run seed:city` provisions NMMC, 2 zones, 5 wards, 10 areas, 10 smart bins, 10 devices (printed credentials), 3 vehicles, sample tasks.

## 4. Authentication

- **Citizen (student)**: login 200, scoped to own complaints/rewards; protected endpoints return 403 when student attempts admin actions.
- **Collector**: login 200, block-scoped complaint access; can claim, complete (image proof), trigger resolution rewards.
- **Admin**: login 200, full visibility.
- **Role mismatch**: hard-fail 401 when the login role does not match the user record; inactive accounts are blocked; unknown emails / wrong passwords → generic 401.

## 5. Database Changes

- **New models**: `City`, `Zone`, `Ward`, `Area`, `SmartBin`, `BinReading`, `Device`, `Vehicle`, `VehicleLocation`, `CollectionTask`, `AIInsight`, `AuditLog`, `RewardTransaction`.
- **Evolved models**:
  - `User`: added `phone`, `city`, `zone`, `ward`, `area`, `isActive`; `block` decoded from an enum to a string for forward compatibility.
  - `Complaint`: new statuses `assigned`, `reopened`, `citizen_confirmed`; new fields `priority`, `slaDeadline`, `slaBreached`, `locationData`, `locationPoint` (GeoJSON), `deviceId`, `binId`, `assignedTo`, `rejectionReason`, `type`, `statusHistory`, `resolvedAt`, `citizenConfirmedAt`, `reopenedAt`, `rewardGiven`, `completionImage`; virtuals `slaRemainingMs`/`isSlaOverdue`.
  - `BinData`: `block` decoded to string.
- **Indexes**: `locationPoint` partial 2dsphere (only docs with coordinate arrays are geo-indexed; malformed/empty entries are stripped by a `pre('save')` sanitizer), explicit indexes on `Complaint.status/priority/slaDeadline/user/block`, plus geospatial fields on SmartBin/Vehicle/Ward/Area.

## 6. API Changes

- **New routes**: `GET /api/localities` + locality CRUD; `GET /api/bins`, `GET /api/bins/nearby`, bin CRUD; `GET /api/vehicles`, vehicle location + history POST/GET, vehicle CRUD; task CRUD/lifecycle + `POST /api/tasks/:id/complete`; `GET /api/analytics/overview|ward-performance|sla-compliance|resolution-time|bin-utilization|hotspots`; `POST /api/ai/insights/run`, `GET /api/ai/insights`, `GET /api/ai/capabilities`; `GET /api/gis/nearby-bins|nearby-complaints`; `GET /api/audit`.
- **Modified routes**: `POST /api/rewards` is admin-only and routes through `rewardService.credit`; `GET /api/rewards` is scoped (admin all, others own); `POST /api/complaints/:id/confirm` and `POST /api/complaints/:id/reopen` added; `GET /api/notifications/unread-count` added; status transitions now enforced by a state machine (`complaintService.STATUS_FLOW`).

## 7. IoT Changes

- **Device authentication**: mandatory `X-Device-Id` + `X-Device-Key` headers verified against `Device.apiKeyHash` (sha-256) using `crypto.timingSafeEqual`; unknown/disabled devices → 401. Dev escape hatch `IOT_ALLOW_PUBLIC_INGEST=true` must stay off in production.
- **Validation**: `binId` required, `level` must be numeric 0–100 → 400 otherwise.
- **Deduplication**: alerts are suppressed while an open alert complaint exists for the bin and via a per-device `alertCooldownUntil`; duplicates return HTTP 409 with `deduplicated: true` (verified live: first ingest 201, immediate repeat 409).
- **Autonomy**: every reading writes `BinReading` + `BinData`, upserts/live-updates the `SmartBin` (level, status ok/near-full/full, lastReadingAt), and auto-creates an `IOT-*` alert complaint at ≥80% assigned to the block's collector.

## 8. Security Changes

- Password values are no longer logged anywhere (was leaking plaintext in auth logs).
- `isActive` gate applied at login and in `authMiddleware` for every request.
- `updateUser` restricted to self-or-admin; user creation role fields validated against a whitelist (no arbitrary roles).
- Rewards are **server-verified only**: `POST /api/rewards` requires admin; balances are atomically incremented and audited via `RewardTransaction`; store redemption validates balance server-side (no client-trusted points).
- CORS origin allow-list from `ALLOWED_ORIGINS`; request logging excludes bodies; rate limiting on auth/IoT/GIS paths.
- IoT keys stored as hashes, compared in constant time.

## 9. AI/ML Integration

- **Implemented**: rule-based insight generation (`aiService` + `/api/ai/insights/run`): hotspot detection, anomaly/overshoot detection, planning observations, confidence scores, explicit `mode: 'demo-rule-based'` labeling; insights persisted in `AIInsight` and surfaced read-only.
- **Integration-ready (not implemented with a live model, honestly reported)**: `GET /api/ai/capabilities` returns `FEATURE_NOT_AVAILABLE` with `integrationReady: true` and `modelBacked: false` for forecasting/classification pipelines, plus documented env-key stubs in `aiService`. No fabricated model outputs are returned.

## 10. Testing

- **Unit/integration (node:test, 34/34 passing)**: auth (role mismatch, wrong password, unknown user, /me), authorization/RBAC (student vs admin vs collector scoping, rewards restrictions, bins admin-only), complaints (SLA, priority mapping, valid state machine, invalid transitions, image-proof completion, citizen confirm/reopen), IoT (401 no/unknown creds, 400 bad level, ingest < threshold, full-bin alert + dedupe, GET latest), rewards (credit transaction, redeem debit + order, insufficient balance).
- **Static validation**: `node --check` clean across all 102 server JS files.
- **Lint/build (frontend)**: previously green and closed for the frontend workstream; no frontend changes required beyond additive status mapping.
- **Live smoke validation**: server restarted on port 5000; `GET /api/health` and `GET /api/health/db` OK; admin login OK; `/api/localities` returns seeded hierarchy (2 zones, 5 wards, 10 areas), `/api/bins` 10, `/api/vehicles` 3; IoT ingest from seeded `DEV-001` returned 201 then 409 on duplicate.