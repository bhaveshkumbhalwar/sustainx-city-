# SustainX — Ward Identity Unification Audit

Date: 2026-10-09 · Mode: **audit only** — no code edits, no seeds, no migrations, no database writes or connections. Evidence is code inspection plus `git status` (clean). Anything not directly observed is labeled assumption/open question.

## 0. One-paragraph verdict

Authorization, filtering, analytics, AI hotspots, IoT alerts, and route planning all run on legacy **block letters (A–E)**. The city hierarchy (`City → Zone → Ward → Area`, codes **W1–W5**) exists as reference data plus a documented-but-unenforced bridge (`Ward.legacyBlock`). No runtime path resolves one namespace to the other, and `ward` currently means three different things depending on the collection. Unification is feasible and low-risk **iff** a single canonical form is chosen first (recommended below) and the migration stays additive until cutover.

## 1. Complete field inventory

### 1a. Models — every `block` / `ward` field

| Model (file) | `block` | `ward` | Notes |
|---|---|---|---|
| `User.js:34,61` | String, **required for student/collector** (validator L37-44) | Plain String, free text, **never read by backend logic** | `dept` still present |
| `Complaint.js:57` | String, **required**, indexed | **absent** | Core record has no ward identity at all |
| `BinData.js:10` | String, required | absent | |
| `BinReading.js:7` | String, optional | absent | |
| `Device.js:10-11` | String code | String code (`'W1'`-style from `seed-city.js:107`) | Two alphabets on one doc |
| `Vehicle.js:10` | String | absent | |
| `CollectionTask.js:10-11` | String | String code | |
| `CollectionRoute.js:14,54` | — (stops carry `block`? no — stops carry `ward` String, L14) | String code, indexed (L104) | Route header `ward` String |
| `Order.js:20` | String, indexed | absent | |
| `SmartBin.js:10,12` | String | **ObjectId → Ward** (the only true ward reference on an operational record) | Indexed on `block` only (L29) |
| `Ward.js:6,10` | — | `code` String (unique per city, L20); `legacyBlock` String optional (L9-10) | Bridge field, unenforced |
| `Area.js:9` | — | ObjectId → Ward | Fully relational |
| `City/Zone.js` | — | hierarchy refs only | |

`wardCode` / `wardId` as identifiers: **zero occurrences** anywhere in `server/` or `client/src` (verified by grep).

### 1b. Enforcement points — geographic scope → authorization/filtering

All eight compare **block strings**; none consults `Ward`:

- `complaintController.js:27` collector list filter `query.block = req.user.block`
- `complaintController.js:69` single-view `complaint.block !== req.user.block` → 403
- `complaintService.js:107` (`assertCollectorScope`), `:160` (assign backfill from collector's block)
- `statsController.js:12-13` collector stats match on block; empty block → zeros
- `storeController.js:248,374,398` order view/update/assign block checks
- `gisController.js:34` nearby-complaints collector filter on block
- JWT itself carries `block` (`authController.js:13`); registration defaults `block 'A'` (`:72,90`)
- `taskController.js:27`, `vehicle/device/iot/binControllers` `?block=` filters

`cityController.js:90-108` manages `Ward` CRUD including `legacyBlock` — pure administration, zero authorization effect.

### 1c. Grouping/analytics/AI — all block-keyed

`analyticsService.js:9,37,58,65,79`, `aiService.js:40,87`, `statsController.js:34`, `iotController.js:48,53`, `iotService.js:60,70` (collector lookup + `String(block\|\|'A')` default). Route optimizer aliases block into `ward` at `routeOptimization.js:188,198,236,247` and filters `ward: {$in: wards}` at `:178,218` — against fields that are ObjectId (`SmartBin.ward`) or nonexistent (`Complaint.ward`), so ward-scoped planning silently matches nothing.

### 1d. Seeds and tests

- `seed.js`: college users (`student`, `@campus.edu`, `dept`, blocks); destructive (`deleteMany` ×4, L14-17); **do not run**.
- `seed-city.js`: NMMC city, Z1–Z2, **W1–W5 with `legacyBlock` A–E** (L33-39), bins/devices/vehicles/tasks; additive upserts, no users.
- `seed-city-dev.js` (never executed): guarded dev users/complaints, block-based, consistent with current schema.
- `tests/helpers.js`: fixtures scoped by `block: 'A'` only; no ward-code fixtures exist anywhere in the suite.

### 1e. Frontend (`client/src`)

- Display-only layering is disciplined: `lib/geography.js:16-23` hardcodes `WARD_CONFIG` A–E ("must stay A-E today"); `adapters/complaint.adapter.js:53-55`, `bin.adapter.js:33-34` derive `ward: wardLabel(block)`; `services/geo.js:5,32-43` bridges map centers/labels via `Ward.legacyBlock`; every page reads `user.block` / `row.block` (`CollectorHome.jsx:24,28`, `ReportWaste.jsx:28,93,186`, `AdminAi.jsx:55`, etc.).
- `SettingsPanel.jsx:167` already renders `Ward {user?.ward \|\| user?.block}` — forward-compatible display.

## 2. Labels vs codes vs ObjectIds

- **Display labels** (never persisted, never compared): `wardLabel()` → "Ward A"; aiService `` `Block ${h.block}` `` strings; `wardLabelFor`.
- **String codes, two alphabets**: block `A–E` (operational truth) vs ward `W1–W5` (reference truth). `Device.ward`/`Task.ward`/`Route.ward` hold codes but nothing constrains which alphabet.
- **ObjectIds** (true relations): `SmartBin.ward`, `Area.ward`, `Ward.zone/city`. Note the asymmetry: bins point at wards, but nothing points at bins' wards for auth.

## 3. How scope affects authorization and filtering (trace)

Login (email+password+role → JWT with `role, block`) → `protect` refreshes user from DB → `authorize(role)` → per-handler block comparison or block-keyed query (table in §1b). Consequences: a collector sees exactly one block letter's data; a user with empty `block` sees zeros/403s; changing someone's operational territory today means editing `User.block`. Ward documents can be renamed, deactivated, or deleted with **zero effect** on who sees what.

## 4. A–E vs W1–W5: what the evidence actually supports

**Evidence for designed equivalence:** `Ward.js:9` comment ("existing block-based data (A-E) maps onto wards"); `seed-city.js:33-39` pairs W1←A … W5←E; bins/devices/vehicles/tasks co-store both values; client `geo.js:32-43` joins map data on `legacyBlock`.
**Evidence against runtime equivalence:** no code path resolves `block`↔`ward` (single exception: display-only map labels); `Complaint` — the highest-volume operational record — has no ward slot; `?ward=` on `binController.js:20` puts a code string against an ObjectId field (CastError → 500 via the global handler; `getBins` has no try/catch); route-planner `ward` filters match nothing (§1c); client static zones list a `Zone 3` the server never seeded.
**Verdict:** equivalence is *intended and seeded* but *not implemented*. Per this audit's constraints, A≡W mapping must be treated as **unverified assumption** until the diagnostics in §6 confirm it per record.

## 5. Recommended canonical form

**Canonical: ward CODE string (`'W1'`) on all operational collections.** Reasons: stable in URLs/logs/tests; groupable without `$lookup`; immune to ward-doc renames; matches the existing `Device/Task/Route.ward` string columns and the already-string `Ward.code`. Keep ObjectId refs only where true navigation is needed (`SmartBin.ward`, `Area.ward`).
Resulting usage contract:
- Models: add `ward` (String, uppercase, indexed) to `Complaint, BinData, BinReading, Vehicle, Order`; tighten `User.ward` (required for student/collector); keep `block` nullable during transition.
- Enforcement: compare normalized ward codes; fall back to `Ward.legacyBlock` translation **only** while legacy rows exist.
- Analytics/AI/IoT/routes: group/filter by ward-with-block-fallback (`$ifNull`), never block-only.
- Client: drive `geography.js` from `/api/localities` (codes + names), keeping the A–E table as offline fallback; stop inventing `Zone 3`.

## 6. Duplicates, orphans, ambiguities + read-only diagnostics

| ID | Class | Detail |
|---|---|---|
| D1 | Ambiguous | `ward` = free text (`User`), code (`Device/Task/Route`), ObjectId (`SmartBin/Area`) |
| D2 | Duplicate | `SmartBin.ward` (ref, usually null — fixtures/seeds set block only) vs `SmartBin.block` |
| D3 | Conflation | Optimizer writes `ward: bin.block` / `ward: complaint.block` (`routeOptimization.js:188,198,236,247`) |
| D4 | Broken filter | `GET /api/bins?ward=<code>` type-mismatch → 500 (`binController.js:20`) |
| D5 | Dead filter | `complaintFilter.ward` (`routeOptimization.js:218`) matches a nonexistent field |
| D6 | Unused | `User.ward`, `Device.ward` written but never read for authz |
| D7 | Drift | Client zones (`Zone 1/2/3`) vs server zones (`Z1/Z2`) |

Read-only `mongosh` diagnostics (no writes; replace `<db>` as needed):
```js
// Distinct scope alphabets per collection — expect {A-E} operationally, {W1-W5} on Device/Task/Route
['users','complaints','bindatas','binreadings','devices','vehicles','collectiontasks','orders','smartbins']
  .forEach(c => print(c, JSON.stringify(db[c].distinct('block')), JSON.stringify(db[c].distinct('ward'))));
// Records whose ward code has no Ward document
db.devices.aggregate([{ $group: { _id: '$ward', n: { $sum: 1 } } }]);
db.wards.find({}, { code: 1, legacyBlock: 1 }).sort({ code: 1 });
// Bins whose ward ObjectId dangles (expect [] after healthy seeding)
db.smartbins.aggregate([
  { $match: { ward: { $ne: null } } },
  { $lookup: { from: 'wards', localField: 'ward', foreignField: '_id', as: 'w' } },
  { $match: { 'w.0': { $exists: false } } },
  { $count: 'dangling' },
]);
// Wards missing the bridge field (blocks migration mapping)
db.wards.find({ $or: [{ legacyBlock: null }, { legacyBlock: '' }] }, { code: 1 });
// Cross-check: open complaints per block vs per ward-code (should converge post-migration)
db.complaints.aggregate([{ $match: { status: { $in: ['pending','assigned','in-progress'] } } },
  { $group: { _id: { block: '$block', ward: '$ward' }, n: { $sum: 1 } } }]);
```

## 7. Staged, backward-compatible migration plan

- **Stage 0 — Backup & freeze.** `mongodump` Atlas → versioned snapshot; record per-collection counts + the §6 diagnostic outputs as the baseline; freeze `seed.js` (already policy: never run).
- **Stage 1 — Additive schema.** Add nullable indexed `ward` (String code) where missing; keep `block` and all validators untouched. Deploy; rollback = redeploy previous build (new fields ignored). Verify: suite green, §6 diagnostics unchanged.
- **Stage 2 — Backfill (dry-run first).** Script maps `block`→ward code via `Ward.legacyBlock`, writes only where `ward` is null, skips+reports unmapped rows (never deletes, idempotent, re-runnable). Verify: zero unmapped rows OR explicit exception list; counts unchanged.
- **Stage 3 — Dual-read.** Enforcement and grouping try `ward` first, fall back to translated `block`; new writes populate both. Verify: full suite + new cross-namespace tests (W-coded collector sees legacy-block rows and vice versa); spot-check dashboards.
- **Stage 4 — Cutover.** Validators require `ward`; `block` becomes nullable legacy (fields retained). Verify: create-path tests with ward-only payloads; grep confirms no `x.block` comparisons remain in authz paths.
- **Stage 5 (later release, after retention window) — Drop `block` columns.** Only after one full release with zero reads of `block` in logs/metrics.
- **Rollback per stage:** 0–1: redeploy prior build. 2: `$unset` backfilled `ward` values using the script's own report, or restore snapshot. 3–4: redeploy prior build (writes still dual-populate `block`, so old code keeps working).

## 8. Required regression tests (isolated DB, existing conventions)

- Auth: W1 collector login; W1 vs W2 collector list/view/assign isolation on ward-coded fixtures (mirrors today's block tests).
- Complaints: ward-only submit → stored code; legacy block-only submit → bridged code; cross-ward 403 on view + status change.
- Analytics/AI: mixed legacy + migrated fixtures group under one ward bucket; hotspot rows carry ward codes.
- Bins/IoT: `GET /api/bins?ward=W1` returns bins; IoT alert from a W1 bin creates a W1 complaint assigned in-ward.
- Routes: plan with `wards: ['W1']` yields stops; preview matches plan shape; failure cases persist nothing (already covered for blocks in `tests/routes.test.js` — extend, don't duplicate).
- Seeds: idempotency + no-overwrite + wrong-DB refusal (pattern exists in `tests/seed-city-dev.test.js`).

## Appendix — files inspected, verification, change confirmation

Inspected (read fully or via targeted grep): `models/` (all 22), `controllers/` (complaint, stats, store, gis, task, vehicle, bin, device, iot, city, auth, route, user), `services/` (complaint, iot, analytics, ai, routing inputs, sla reward paths), `middleware/authMiddleware.js`, `config/roles.js`, `routes/routeRoutes.js`, `seed.js`, `seed-city.js`, `seed-city-dev.js` (+ its tests), `tests/helpers.js`, client `lib/geography.js`, `services/geo.js`, `hooks/useGeo.js` + `useOpsMap.js`, `adapters/*`, collector/citizen pages, `SettingsPanel.jsx`, `esp32_iot_client.ino` references (device header auth only).
`git status --short`: clean before and after (only this new file added). **No application code or database data was changed.** Open questions left for implementation: real-world A≡W ground truth per neighborhood (needs municipal confirmation, not code); whether `Zone 3` exists operationally; retention window length for `block` columns.
