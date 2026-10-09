# SustainX — API Integration Report

Generated: 2026-09-14
Backend baseline: 74/74 PASS (unchanged — no backend modifications)
Frontend: `client/` (React 19 + Vite + axios + Leaflet) — `npm run lint` clean, `npm run build` passes

---

## 1. Contract table

| Feature | Frontend service | Backend endpoint | Method | Auth | Role | Status |
|---|---|---|---|---|---|---|
| Login | `loginUser` | `/api/auth/login` | POST | No | — | CONNECTED |
| Register (citizen) | `registerUser` | `/api/auth/register` | POST | No | — | CONNECTED |
| Session | `getMe` | `/api/auth/me` | GET | Yes | all | CONNECTED |
| Forgot password | `forgotPasswordApi` | `/api/auth/forgot-password` | POST | No | — | CONNECTED |
| List users | `getUsers(role?)` | `/api/users` | GET | Yes | admin | CONNECTED |
| User detail | `getUserById` | `/api/users/:id` | GET | Yes | all | CONNECTED |
| Create user | `createUser` | `/api/users` | POST | Yes | admin | CONNECTED |
| Update user | `updateUser` | `/api/users/:id` | PUT | Yes | self/admin | CONNECTED |
| Change password | `changePassword` | `/api/users/:id/password` | PUT | Yes | self | CONNECTED |
| Delete user | `deleteUserApi` | `/api/users/:id` | DELETE | Yes | admin | CONNECTED |
| List complaints | `getComplaints(params)` | `/api/complaints` | GET | Yes | all (scoped) | CONNECTED |
| Complaint detail | `getComplaintById` | `/api/complaints/:id` | GET | Yes | all (scoped) | CONNECTED |
| Submit complaint | `submitComplaint` | `/api/complaints` | POST | Yes | student | CONNECTED |
| Update status | `updateComplaintStatus` | `/api/complaints/:id/status` | PUT | Yes | collector/admin | CONNECTED |
| Complete w/ proof | `completeComplaintApi` | `/api/complaints/complete/:id` | POST | Yes | collector | CONNECTED |
| Confirm resolution | `confirmComplaintApi` | `/api/complaints/:id/confirm` | POST | Yes | all (owner) | CONNECTED (was unused) |
| Reopen | `reopenComplaintApi` | `/api/complaints/:id/reopen` | POST | Yes | all (owner) | CONNECTED (was unused) |
| List tasks | `getTasks` | `/api/tasks` | GET | Yes | all (scoped) | CONNECTED (new) |
| Task detail | `getTaskById` | `/api/tasks/:id` | GET | Yes | all (scoped) | CONNECTED (new) |
| Create task | `createTaskApi` | `/api/tasks` | POST | Yes | admin | CONNECTED (new) |
| Assign task | `assignTaskApi` | `/api/tasks/:id/assign` | POST | Yes | admin | CONNECTED (new) |
| Accept task | `acceptTaskApi` | `/api/tasks/:id/accept` | POST | Yes | collector | CONNECTED (new) |
| Start task | `startTaskApi` | `/api/tasks/:id/start` | POST | Yes | collector | CONNECTED (new) |
| Complete task | `completeTaskApi` | `/api/tasks/:id/complete` | POST | Yes | collector | CONNECTED (new) |
| Cancel task | `cancelTaskApi` | `/api/tasks/:id/cancel` | POST | Yes | admin | CONNECTED (new) |
| Rewards ledger | `getRewards` | `/api/rewards` | GET | Yes | all (scoped) | CONNECTED |
| Award points | `addReward` | `/api/rewards` | POST | Yes | admin | CONNECTED |
| Dashboard stats | `getDashboardStats` | `/api/stats/dashboard` | GET | Yes | all | CONNECTED |
| Store items | `getStoreItems` | `/api/store` | GET | Yes | all | CONNECTED |
| Create item | `createStoreItemApi` | `/api/store` | POST | Yes | admin | CONNECTED (new) |
| Redeem | `redeemStoreItem` | `/api/store/redeem` | POST | Yes | student/collector | CONNECTED |
| Orders | `getOrders` | `/api/orders` | GET | Yes | all (scoped) | CONNECTED |
| Order detail | `getOrderById` | `/api/orders/:id` | GET | Yes | all (scoped) | CONNECTED |
| Order status | `updateOrderStatus` | `/api/orders/:id` | PUT | Yes | collector/admin | CONNECTED |
| Take order | `assignOrderApi` | `/api/orders/assign/:id` | POST | Yes | collector | CONNECTED (fixed: `_id`, collector-only) |
| Notifications | `getNotifications(params)` | `/api/notifications` | GET | Yes | all (scoped) | CONNECTED |
| Unread count | `getUnreadCount` | `/api/notifications/unread-count` | GET | Yes | all | CONNECTED (new) |
| Mark read | `markNotificationRead` | `/api/notifications/read/:id` | PUT | Yes | owner | CONNECTED |
| Mark all read | `markAllNotificationsRead` | `/api/notifications/read-all` | PUT | Yes | all | CONNECTED |
| Bin register | `getBins` | `/api/bins` | GET | Yes | all | CONNECTED (new) |
| Bin detail | `getBinById` | `/api/bins/:id` | GET | Yes | all | CONNECTED (new) |
| Create/update/delete bin | `createBinApi`/`updateBinApi`/`deleteBinApi` | `/api/bins` | POST/PUT/DELETE | Yes | admin | CONNECTED (new) |
| IoT readings | `getIotBinData` | `/api/iot/data` | GET | No | — | CONNECTED |
| Vehicles | `getVehicles` | `/api/vehicles` | GET | Yes | all | CONNECTED (new) |
| Vehicle detail/history | `getVehicleById`/`getVehicleHistory` | `/api/vehicles/:id`, `/:id/history` | GET | Yes | all | CONNECTED (new) |
| Vehicle CRUD | `create/update/deleteVehicleApi` | `/api/vehicles` | POST/PUT/DELETE | Yes | admin | CONNECTED (new) |
| Vehicle GPS ping | `updateVehicleLocationApi` | `/api/vehicles/:id/location` | PUT | Yes | collector/admin | CONNECTED (new) |
| Nearby bins | `getNearbyBins` | `/api/gis/nearby-bins` | GET | Yes | all | CONNECTED (new) |
| Nearby complaints | `getNearbyComplaints` | `/api/gis/nearby-complaints` | GET | Yes | all (scoped) | CONNECTED (new) |
| Localities | `getLocalities` | `/api/localities` | GET | Yes | all | CONNECTED (new) |
| Locality CRUD | `create/update/delete*Api` | `/api/localities/*` | POST/PUT/DELETE | Yes | admin | CONNECTED (new) |
| Analytics ×6 | `getAnalyticsOverview`, `getWardPerformance`, `getSlaCompliance`, `getResolutionTime`, `getBinUtilization`, `getHotspots` | `/api/analytics/*` | GET | Yes | admin | CONNECTED (new) |
| AI capabilities | `getAiCapabilities` | `/api/ai/capabilities` | GET | Yes | all | CONNECTED (new) |
| AI insights | `getAiInsights` | `/api/ai/insights` | GET | Yes | all | CONNECTED (new) |
| Run insights | `runAiInsights` | `/api/ai/insights/run` | POST | Yes | admin | CONNECTED (new) |
| Fill estimate | `getBinFillEstimate` | `/api/ai/bins/:binId/fill-estimate` | GET | Yes | all | CONNECTED (new) |
| Audit logs | `getAuditLogs` | `/api/audit` | GET | Yes | admin | CONNECTED (new) |

**NOT IMPLEMENTED (no backend endpoint — honest empty states, no fabrication):**
- Route planning (`MOCK_ROUTES` removed; LiveOperations + AdminVehicles show "Route planning not available")
- Ward efficiency % / satisfaction % (`MOCK_WARD_PERFORMANCE` removed; replaced with real resolved-rate)
- ML-backed predictions (`predict_bin_fill` etc. report `FEATURE_NOT_AVAILABLE`; UI labels rule-based estimates)

---

## 2. Integration fixes applied (frontend only)

1. **Central API client** (`services/api.js`): request interceptor (single token attach point), response interceptor (401 → clear token + one-time redirect to `/login`, loop-guarded; 403 surfaced, never treated as logout), `ApiError {message, code, status}` normalization with friendly copy per status (401/403/404/409/413/429/500), 30s timeout. Removed stray `console.log` of the login URL.
2. **Auth** (`context/AuthContext.jsx`): uses centralized token helpers, added `isAuthenticated`. Login sends `{email, password, role}` with role tabs student→Citizen, collector→Field Officer, admin→Municipal Admin (backend values preserved).
3. **Error reads**: all pages migrated from `err?.response?.data?.message` to normalized `err?.message`.
4. **Complaint priority**: adapter no longer overrides backend priority with a client derivation; `PriorityBadge` renders real `low/medium/high/critical` and "Not available" for null.
5. **ReportWaste**: GPS capture with denied/timeout/unavailable handling + manual fallback; file pre-validation (image type, ≤5MB); sends real `lat`/`lng`.
6. **MyComplaints**: detail shows real SLA (`slaRemainingMs` formatted, breach-aware), `statusHistory` timeline, and working Confirm/Reopen actions.
7. **RewardsStore**: added real rewards-ledger history section.
8. **CollectorTasks**: "Done" restricted to in-progress (backend rejects pending→completed); proof pre-validation; new real task workflow section (accept → start → complete with `proofImage` + notes).
9. **CollectorOrders**: "Take" action via `POST /orders/assign/:_id` (collector-only).
10. **AdminOrders**: removed broken admin "Assign to me" (admins get 403 by design; also used wrong id).
11. **AdminComplaints**: collector assignment dropdown via real `assignedTo` API + SLA + timeline + assignee column.
12. **Bins (NearbyBins/AdminBins/CollectorBins)**: register (`/bins`) joined with readings (`/iot/data`); markers from real `location.coordinates`, else live ward centers, else list-only (no fake pins); demo-note removed.
13. **AdminVehicles / LiveOperations**: real fleet API (table, register, delete, live GPS display); routes show honest unavailable state.
14. **ControlRoom**: AI card now lists real stored insights with empty state.
15. **AdminAnalytics**: all six analytics endpoints + dashboard stats; weekly trend aggregated from real `createdAt`; empty-safe.
16. **AdminAi**: real capabilities (honest `FEATURE_NOT_AVAILABLE` labels), insights list + Run, per-bin estimate lookup with Observed-vs-Estimated labeling, hotspots from real endpoint.
17. **AdminWards**: real localities hierarchy + real ward-performance; static fallback labeled as fallback.
18. **Geo layer** (`services/geo.js`, `hooks/useGeo.js`/`useWardOptions`): localities index, real coord resolvers; ward pickers prefer live hierarchy.
19. **NotificationBell**: 5s full-list polling replaced with 30s lightweight `unread-count` polling; full list fetched on open.
20. **Mock removal**: `src/mock/` deleted (zero remaining importers). Terminology audit: no user-facing college wording; `student/collector/admin` appear only as backend values.

## 3. Verified live (through Vite proxy → backend)

Login citizen/collector/admin 200 · `/auth/me` role correct · role-mismatch login 401 · analytics 200 admin / 403 student · tasks/bins/localities/vehicles/audit/AI 200 · fill-estimate 200 + 404 unknown · unread-count 200 · GIS 200 · AI run 403 for student.

## 4. Validation

- `npx eslint src` — clean (0 errors, 0 warnings)
- `npm run build` — passes
- Backend suite — 74/74 (backend untouched)
