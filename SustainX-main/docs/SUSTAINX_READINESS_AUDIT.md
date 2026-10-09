# SustainX — End-to-End Readiness Audit

Date: 2026-10-09 · Mode: read-only (no migrations, no seeds, no database writes; test suite runs only against the throwaway local `sustainx_test` database).
Method: code inspection of `server/` + `client/src` + `ml-service/`, plus `npm test` (90/90), `eslint` (clean), `vite build` (success).
Rule applied throughout: a feature counts as *working* only with test or runtime evidence — files/UI alone prove nothing.

## 1. Verified working features

| Area | Evidence |
|---|---|
| Auth (all 3 roles) + RBAC | `tests/auth.test.js`, `authorization.test.js`, `security.test.js` — login per role, wrong-password/unknown-user 401, role-mismatch 401, citizen-isolated data, admin-only routes 403, JWT tamper/expiry 401. `middleware/authMiddleware.js` (`protect` + `authorize`), `config/roles.js` aliases. |
| Complaint lifecycle | `tests/complaints.test.js` — submit with SLA + priority mapping, valid/invalid status transitions, image-proof completion, confirm/reopen. `services/complaintService.js` state machine + atomic reward guard; `services/slaService.js` deadlines. |
| Collector ward isolation | `authorization.test.js` (cross-block 403), `security.test.js` (assignment abuse, skip-flow, order cross-block 403). Enforced in `complaintController.js:69`, `complaintService.js:104-110`, `storeController.js`. |
| Rewards/store atomicity | `tests/rewards.test.js`, `security.test.js` — credit/debit ledger (`RewardTransaction`), single-winner stock race, pickup-code verify + lockout. `services/rewardService.js`. |
| IoT ingest + alerts | `tests/iot.test.js`, `iot-ops.test.js` — device header auth, level validation, below-threshold store-only, threshold alert + dedupe/cooldown, `lastSeenAt` heartbeat, online flag, no hash leaks. `services/iotService.js`, `controllers/iotController.js`. |
| Analytics/AI honesty | `tests/authorization.test.js`, `qa-coverage.test.js` — admin-only analytics, `FEATURE_NOT_AVAILABLE` model statuses, `demo-rule-based` insight mode asserted. No fake confidence anywhere. |
| Input security | `security.test.js` + `qa-coverage.test.js` — NoSQL `$` operator neutralization (`utils/validate.js`), 5 MB upload cap, malformed JSON 400, CORS allow/deny, login + analytics rate limits, audit limit cap. |
| Seed guardrails | `tests/seed-city-dev.test.js` (7 tests) — opt-in refusal, wrong-DB refusal, no-overwrite, idempotency, valid references. |
| Frontend integration | No mock datasets (`mock|dummy|lorem|faker` → 1 CSS comment only). Every page wires real endpoints with loading skeletons, `EmptyState`, and `ErrorState` + retry. Adapters normalize legacy statuses (`in_progress`, `citizen_confirmed`). |

## 2. Partially implemented or broken features

1. **`POST /api/routes/plan` always 500s (bug, verified by reading).** `controllers/routeController.js:74` builds `meta: { ..., wards }` but no `wards` variable exists in scope → `ReferenceError` on every successful plan. Worse, the `CollectionRoute` document is created (L64) *before* the throw, so the client gets a 500 for an operation that half-succeeded. Route auth itself is fine (`routes/routeRoutes.js:8` has `router.use(protect)`).
2. **Image proof completion is blocked wherever Cloudinary is unconfigured.** `middleware/upload.js:56-66` rejects when `CLOUDINARY_*` are empty (they are, in `server/.env`), and `completeComplaint` returns 500 in that case. Reporting still works (image saved as null), but collector proof-of-completion cannot succeed in production without Cloudinary or `UPLOAD_DRIVER=local` (local mode exists and tests use it).
3. **Ward identity is split-brained.** `Ward` docs use codes `W1–W5` (`seed-city.js:33-39`), but all authorization/scoping, `statsController.js`, `analyticsService.js`, `aiService.js`, and the IoT alert path group by legacy `block` A–E. The frontend hardcodes the same assumption (`client/src/lib/geography.js:16-22` — "must stay A-E today"), so real `W1` codes render raw/unknown in charts, hotspot markers, and ward labels.
4. **ML/AI is scaffolding, not inference.** `ml-service/` has API/schema/training code but **zero trained artifacts** (no `.pkl`/`.joblib`/`.pt`/registry) and no `ML_SERVICE_URL` in `server/.env`, so `services/mlServiceClient.js` always degrades to `modelStatus: 'UNAVAILABLE'` and the backend serves rule-based estimates. Honestly labeled — but not real inference.
5. **Minor inconsistencies (cosmetic, non-blocking):** `statsController.js:56` still returns the `students` key; `server.js:1` + `app.js:1` both call `dotenv.config()` (harmless duplicate); `seed-city.js:155-160` prints demo IoT keys to the console on every run.

## 3. Missing features

- Production image pipeline (Cloudinary credentials **or** a real local-upload store — the `local` driver returns demo references, not files).
- Trained, versioned ML models + `ML_SERVICE_URL` wiring + model-monitoring; hotspot/priority/fill predictions are rules today.
- Any ward-code-aware authorization or display (see §2.3) — the city/college migration was rolled back, so `citizen` role, `ward` scoping, and municipal seeds remain future work (`server/SEED_CITY_DEV.md` documents the designed path; `seed-city-dev.js` exists but has never been run).
- Route-planning E2E coverage: no tests touch `/api/routes/*` (which is how bug §2.1 survived).
- Operational docs for deploying/starting the Python `ml-service` and the ESP32 firmware loop.

## 4. Tests and results (this audit)

- Backend `npm test`: **90/90 pass** (83 baseline + 7 seed-guard tests), `node:test` against local `sustainx_test` only — Atlas untouched.
- Frontend `npx eslint src`: clean. `npx vite build`: success (~9 s).
- Gaps: no tests for route planning, vehicle GPS history edge cases beyond happy path, or multi-ward data (all fixtures are block `A`).

## 5. Security and data-loss risks

| # | Risk | Severity |
|---|---|---|
| 1 | **`npm run seed` (`server/seed.js:14-17`) unconditionally `deleteMany`s `User`, `Complaint`, `Reward`, `StoreItem` on whatever `MONGO_URI` points at** — currently Atlas `sustainx_city_dev` — then crashes on schema mismatches (`userId`/`studentId` fields don't exist). One command = live data loss. | **Critical** |
| 2 | Weak dev credentials baked into seeds/tests (`112233`, `sx-dev-key-00N` printed to console). Acceptable locally; must never reach production envs. | High |
| 3 | JWT 7-day expiry (`authController.js`) with no refresh/rotation or revocation list; deactivation is checked per-request (good) but stolen tokens live a week. | Medium |
| 4 | CORS allowlist includes a hardcoded Render frontend URL plus broad localhost entries (`app.js:34-46`) — review before production. | Medium |
| 5 | No git repository exists, so there is no audit trail, no rollback, and `.gitignore` coverage (`.env`) is currently theoretical. | Medium |

## 6. Five highest-priority fixes

1. **Neutralize `seed.js`.** Reason: single-command live data loss on the Atlas dev DB. Acceptance: running `npm run seed` cannot wipe collections (guard, rename, or delete the file) and suite stays green.
2. **Fix `routeController.js:74` (`wards` ReferenceError).** Reason: route planning is 100% broken with a misleading 500 after a half-write. Acceptance: `POST /api/routes/plan` returns 201 with a persisted route, plus a new test covering plan → 201 and invalid input → 400.
3. **Decide the image pipeline.** Reason: collector proof-of-completion cannot work in production as configured. Acceptance: either Cloudinary credentials are provisioned and an end-to-end proof upload succeeds, or a real file store replaces the demo `local` driver — with a test for the chosen path.
4. **Start a git repository and commit the tree.** Reason: every future fix (including 1–3) is currently unreviewable and unrecoverable. Acceptance: `git status` clean baseline, `.env` untracked/ignored, sensitive files never committed.
5. **Unify ward identity (block vs `W1–W5`).** Reason: authorization, analytics, AI hotspots, and frontend labels disagree on what a ward *is*; city-scale operation is incoherent until one canonical form wins. Acceptance: one mapping table used by backend scoping, analytics grouping, and `lib/geography.js`, with tests covering a `W1`-coded complaint end to end.

## 7. Recommended implementation order

`git init` + baseline commit (5 — unlocks safe work) → neutralize `seed.js` (1 — removes the loaded gun) → fix route `wards` bug + route tests (2) → image pipeline decision (3) → ward-identity unification (4) → ML model training/wiring (follows 4, needs ward-coherent data) → JWT lifetime/rotation + CORS tightening (follow-ups).
