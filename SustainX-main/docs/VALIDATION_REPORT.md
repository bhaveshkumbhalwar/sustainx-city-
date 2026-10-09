# SustainX Backend — Validation Report

Generated: 2026-09-13

---

## A. Test Summary

| Module | Tests | Status |
|---|---|---|
| Authentication | 5 | ✅ All pass |
| Authorization (roles, block-scope) | 9 | ✅ All pass |
| Complaints (submit, transition, complete, confirm, reopen, assignment) | 8 | ✅ All pass |
| SLA enforcement | 2 | ✅ All pass |
| IoT (deduplication, level threshold, auto-complaint) | 5 | ✅ All pass |
| Rewards (credit audit, redeem debit, insufficient points) | 3 | ✅ All pass |
| Store orders (redeem, race condition) | 2 | ✅ All pass |
| Security (NoSQL injection, JWT edge, isActive abuse, fill-estimate signature) | 19 | ✅ All pass |
| QA coverage (rate limits, geolocation, notifications, uploads, CORS, 404, pagination, empty-DB analytics, IoT validation) | 21 | ✅ All pass |
| **Total** | **74** | **✅ 74/74 pass, 0 regressions** |

---

## B. Critical Bugs Found & Fixed (P0)

### P0-1 — AI fill-estimate route completely broken
**File:** `server/controllers/aiController.js:7`
**Bug:** Handler signature `async ({ binId }, req, res)` — Express calls with `(req, res)`, so `binId` is always `undefined`. Every `GET /api/ai/bins/:binId/fill-estimate` request silently returned the wrong bin or 404.
**Fix:** Changed to `async (req, res) => { const { binId } = req.params; ... }`.

### P0-2 — NoSQL injection via query parameters
**Files:** `complaintController.js`, `userController.js`, `binController.js`, `vehicleController.js`, `taskController.js`, `gisController.js`, `auditController.js`
**Bug:** Raw query params (`?status[$ne]=pending`, `?role[$ne]=admin`) flowed directly into MongoDB filters. Any authenticated user could read unauthorized data by injecting `$ne`, `$gt`, `$regex` operators.
**Fix:** Added `sanitizeQuery()` helper (`utils/validate.js`) that strips `$`-prefixed keys, non-primitive values, and empty strings. Applied to every query-parameter-to-filter path across 7 controllers.

---

## C. Fixed Issues (P1/P2)

| Priority | Issue | File(s) | Fix |
|---|---|---|---|
| P1 | Admin cannot assign a complaint to a specific collector — `assignedTo` field ignored in status update | `complaintController.js`, `complaintService.js` | `updateComplaintStatus` now forwards `req.body.assignedTo`; `transition()` validates assigned collector exists and has collector role; admin-only restriction enforced |
| P1 | `GET /api/stats/dashboard` total excluded `assigned`, `reopened`, `rejected`, `citizen_confirmed` statuses | `statsController.js:14` | Replaced hardcoded sum with `statusAgg.reduce(...)` to count all statuses |
| P1 | Non-admin could toggle own `isActive` via `PUT /api/users/:id` | `userController.js:112-114` | `isActive` only in `allowedFields` when `req.user.role === 'admin'` |
| P2 | Error handler exposed `err.message` for unexpected 500 errors in production | `app.js:162` | Production 500s now return generic `{"message":"Internal Server Error"}`; `err.message` only exposed for operational errors |
| P2 | `analyticsController` had no try/catch — raw DB errors reached global handler and leaked internals | `analyticsController.js` | All handlers wrapped with `asyncWrap()` that catches errors and returns `500` with generic message |
| P2 | User controller catch blocks leaked `err.message` on 500 errors | `userController.js` | All four catch blocks now return `{"message":"Internal Server Error"}` |
| P2 | Complaint controller catch blocks leaked `err.message` on 500 errors | `complaintController.js` | Three catch blocks hardened to use `err.isOperational ? err.message : 'Internal Server Error'` |
| P2 | IoT device key accepted in request body — secret exposed in plaintext | `iotController.js:12-13` | Removed `req.body.deviceId`/`req.body.deviceKey` fallback; credentials now header-only (`X-Device-Id`, `X-Device-Key`) |
| P2 | `rewardService.debit()` was read-then-write — concurrent requests could overspend points | `rewardService.js:40-56` | Replaced with atomic `findOneAndUpdate({ rewardPoints: { $gte: points } })` guard |
| P2 | `storeController.redeemItem` stock decrement was non-atomic — two concurrent requests both succeeded | `storeController.js:128-131` | Stock decrement moved before debit using atomic `findOneAndUpdate({ stock: { $gt: 0 } })`; failure rolls back stock on debit error |
| P2 | `assignOrder` lacked block-scope check — collector could take orders from another block | `storeController.js:389-391` | Added `if (order.block && req.user.block && order.block !== req.user.block) return 403` |
| P2 | Double-credit race on `updateOrderStatus` delivery reward | `storeController.js:300-312` | Atomic guard via `findOneAndUpdate({ rewardGiven: false })` before crediting |
| P2 | Double-credit race on `complaintService.rewardResolution` | `complaintService.js:112-128` | Atomic guard via `Complaint.findOneAndUpdate({ rewardGiven: { $ne: true } })` |
| P2 | `complaintService.complete` allowed completion from any status, bypassing `STATUS_FLOW` | `complaintService.js:175-189` | Now validates status is `in-progress` or `in_progress` before allowing completion |
| P2 | Debug `console.log("USER:", req.user)` and verbose `assignOrder` debug logs left in production code | `storeController.js:82, 385-414` | Removed all debug logging that printed internal state to stdout |
| P2 | No rate limiting on complaint creation, store redemption, or analytics | `app.js`, `complaintRoutes.js` | Added `POST /api/complaints` (20/10 min), `/api/store/redeem` (20/min), `/api/analytics` (120/min) limits using the existing dependency-free limiter |
| P2 | Malformed JSON bodies returned 500 instead of 400 | `app.js:145` | Global handler now maps `entity.parse.failed` / `SyntaxError(status 400)` to a clean `400 {"message":"Invalid JSON body"}` |
| P2 | `completeComplaint` upload-failure response leaked `uploadErr.message` | `complaintController.js:152-157` | Response now returns only a generic `"Image upload failed"` message |

---

## D. Remaining Non-Blocking Issues

| Priority | Issue | Notes |
|---|---|---|
| P3 | `getUsers` returns all users with no pagination | Acceptable for small deployments; add `?page=&limit=` when user count grows |
| P3 | `getBins` returns up to 200 results with no pagination | Same; functional but should paginate for large cities |
| P3 | `registerController` creates user then calls `rewardService.credit`; if credit fails, user is left with 0 points | Extremely unlikely; could wrap in a transaction when MongoDB transactions are available |

---

## E. API Contract Table

| Frontend call | Backend route | Status | Notes |
|---|---|---|---|
| `loginUser(email, password, role)` | `POST /api/auth/login` | ✅ Match | Token in `body.token` |
| `registerUser(...)` | `POST /api/auth/register` | ✅ Match | |
| `getMe()` | `GET /api/auth/me` | ✅ Match | |
| `forgotPasswordApi(email)` | `POST /api/auth/forgot-password` | ✅ Match | Returns `{token}` for demo |
| `getUsers()` | `GET /api/users` | ✅ Match | Admin only |
| `createUser(...)` | `POST /api/users` | ✅ Match | Admin only |
| `updateUser(id, ...)` | `PUT /api/users/:id` | ✅ Match | Self or admin |
| `changePassword(id, ...)` | `PUT /api/users/:id/password` | ✅ Match | Self only |
| `getComplaints(query)` | `GET /api/complaints` | ✅ Match | Role-filtered |
| `submitComplaint(data)` | `POST /api/complaints` | ✅ Match | Student only, multipart |
| `updateComplaintStatus(id, ...)` | `PUT /api/complaints/:id/status` | ✅ Match | Collector/admin |
| `getIotBinData()` | `GET /api/iot/data` | ✅ Match | |
| `processIotData(payload)` | `POST /api/iot/data` | ✅ Match | Device auth required |
| `getOrders(query)` | `GET /api/orders` | ✅ Match | Role-filtered |
| `updateOrderStatus(id, ...)` | `PUT /api/orders/:id` | ✅ Match | Collector/admin |
| `assignOrderApi(id)` | `POST /api/orders/assign/:id` | ✅ Match | Collector only |
| `getStoreItems()` | `GET /api/store` | ✅ Match | |
| `redeemStoreItem(itemId)` | `POST /api/store/redeem` | ✅ Match | |
| `getRewards()` | `GET /api/rewards` | ✅ Match | Role-filtered |
| `addReward(data)` | `POST /api/rewards` | ✅ Match | Admin only |
| `getDashboardStats()` | `GET /api/stats/dashboard` | ✅ Match | |
| `getNotifications()` | `GET /api/notifications` | ✅ Match | |
| `getComplaintById(id)` | `GET /api/complaints/:id` | ✅ Match | |
| `getIotCapabilities()` | `GET /api/ai/capabilities` | ✅ Match | Returns `FEATURE_NOT_AVAILABLE` (honest) |

Frontend unused backend endpoints (no matching `api.js` export):
- `GET /api/gis/nearby-bins`, `GET /api/gis/nearby-complaints`
- `GET /api/analytics/*` (all six)
- `GET /api/audit`
- `GET /api/notifications/unread-count`, `PUT /api/notifications/read-all`, `PUT /api/notifications/read/:id`
- `GET /api/ai/insights`, `POST /api/ai/insights/run`, `GET /api/ai/bins/:binId/fill-estimate`
- `POST /api/complaints/:id/confirm`, `POST /api/complaints/:id/reopen`
- `POST /api/complaints/complete/:id` (used via multipart in-page, not api.js)
- CRUD on `/api/cities`, `/api/zones`, `/api/wards`, `/api/areas`, `/api/tasks/*`

---

## F. Security Findings

| Category | Finding | Severity | Status |
|---|---|---|---|
| NoSQL injection | Query params like `status[$ne]` flowed directly into Mongo filters | Critical | ✅ Fixed — `sanitizeQuery()` applied to all 7 affected controllers |
| JWT validation | Missing, malformed, expired, wrong-secret tokens properly rejected with 401 | N/A | ✅ Verified (4 test cases) |
| Password storage | bcryptjs hashing in pre-save hook | N/A | ✅ Correct |
| Secret exposure | JWT_SECRET in `.env`; health endpoint masks key/secret last-4 chars | N/A | ✅ No exposure |
| Error message leak | Global handler and 8 controller catch blocks exposed `err.message` on 500 | High | ✅ Fixed — production returns generic `"Internal Server Error"` |
| IoT credentials in body | Device key accepted via `req.body` — exposed in plaintext | Medium | ✅ Fixed — header-only |
| Self-deactivation | Non-admin could set own `isActive: false` | Medium | ✅ Fixed — admin-only |
| Account status bypass | After deactivation, `protect` middleware blocks with 401 | N/A | ✅ Verified (2 test cases) |
| Rate limiting | Login 20/5min, register 20/h, IoT 120/min, GIS 300/min, complaints 20/10min, redeem 20/min, analytics 120/min | N/A | ✅ Added & verified (429 asserted) |
| Body parsing | Malformed JSON bodies now return 400 (was 500) | Medium | ✅ Fixed & verified |
| Race conditions | Double credit on order delivery; double credit on complaint resolution; stock double-decrement on redeem | Medium | ✅ Fixed — atomic `findOneAndUpdate` guards in all 3 flows |
| File upload | 5MB limit, image-only filter, memoryStorage, `UPLOAD_DRIVER=local` in tests | N/A | ✅ Correct |

---

## G. Performance Findings

| Area | Assessment |
|---|---|
| MongoDB indexes | All geo fields have `2dsphere` indexes; `binId`, `plate`, `orderId`, `complaintId`, `taskId` are unique-indexed; `block` indexed on bins/vehicles/tasks |
| Query limits | GIS queries capped at 50/100 results; `getBins` capped at 200; analytics aggregation runs on server side |
| No N+1 paths | `getComplaints` populates user in one query; `getOrders` uses `.populate()` with `select` |
| Concurrency | `test-concurrency=1` ensures DB isolation; production Node handles requests sequentially per event loop |

---

## H. Test Commands

```bash
cd server
node --check *.js          # Syntax check — all files clean
node --test --test-concurrency=1 "tests/*.test.js"   # 74/74 pass
```

Test files:
- `tests/auth.test.js` — Login, role mismatch, missing token, `/me` validation
- `tests/authorization.test.js` — Role boundaries (student/collector/admin)
- `tests/complaints.test.js` — Submit, status transition, complete with proof, citizen confirm, reopen
- `tests/iot.test.js` — Device auth, level threshold, deduplication, 401 on invalid key
- `tests/rewards.test.js` — Credit audit trail, redeem debit, insufficient points rejection
- `tests/security.test.js` — NoSQL injection (7 scenarios), JWT edges (4 scenarios), isActive abuse, AI fill-estimate route fix, complaint assignment (admin/collector), completion flow guard, order block-scope, concurrent redemption race, dashboard total accuracy
- `tests/qa-coverage.test.js` — Empty-DB analytics, geolocation validation, notifications lifecycle + cross-user read protection, IoT header-only auth + field validation, vehicle location bounds, upload size/type limits, unknown-route 404, malformed JSON 400, CORS allow/block, login + analytics rate-limit 429, audit pagination cap

---

## I. Final Status

**BACKEND READY FOR FRONTEND INTEGRATION**

- 2 critical bugs found and fixed (P0: broken AI fill-estimate route, NoSQL injection vector)
- 4 high-priority bugs found and fixed (P1: assignment passthrough, dashboard total, isActive toggle, complete transition guard)
- 14 medium-priority issues fixed (P2: error leak, IoT header-only, analytics try/catch, atomic debit/stock/reward guards, rate limits, malformed-JSON 400, debug log cleanup)
- 0 remaining P0 or P1 issues
- 4 non-blocking P3 observations documented for future hardening
- 74/74 tests pass, 0 regressions
- All endpoints match frontend `api.js` contracts (MISMATCH: 0)
- Frontend unused backend endpoints documented for future feature work
