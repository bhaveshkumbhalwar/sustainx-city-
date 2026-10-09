# City development database seed (`seed-city-dev.js`)

Safe, repeatable initializer for the **`sustainx_city_dev`** database (MongoDB Atlas, development only).

## What it creates
- **Demo users** (inserted only if their email is absent — existing accounts are never touched):
  - `dev.citizen@sustainx.example` — citizen-type account (see roles note), block `A`
  - `dev.collector@sustainx.example` — collector, block `A`
  - `dev.admin@sustainx.example` — municipal admin
  - Dev password for all three: `112233` (repository-wide dev convention, dev-only)
- **Demo complaints** (inserted only if their `complaintId` is absent):
  - `DEV-CITY-001` (pending) and `DEV-CITY-002` (in-progress, assigned to the demo collector), both linked to real demo-user ObjectIds with valid `statusHistory`.
- With `--with-infra`: delegates to the existing additive `seed-city.js` for NMMC wards, bins, devices, and vehicles in the same database.

It never creates IoT device secrets of its own, never deletes anything, and never logs passwords, tokens, or connection strings.

## How to run it (manual only — never automatic)
```bash
cd server
ALLOW_CITY_DEV_SEED=true node seed-city-dev.js            # users + demo reports
ALLOW_CITY_DEV_SEED=true node seed-city-dev.js --with-infra  # + city infrastructure
```
PowerShell:
```powershell
$env:ALLOW_CITY_DEV_SEED='true'; node seed-city-dev.js
```
Requirements: `server/.env` must point `MONGO_URI` at the `sustainx_city_dev` database; the script aborts otherwise. Exit code `2` = guard refusal (nothing written), `1` = failure.

## Demo roles supported today
`student` (used for the citizen-type demo account), `collector`, `admin` — exactly what `models/User.js` and `middleware/authMiddleware.js` accept.

## Remaining college-domain limitations (not changed by this script)
- The canonical citizen role is still `student` in the schema; `citizen` works only as a login alias (`config/roles.js`). The demo citizen logs in with role `student`.
- Geographic scope is still `block`; `dept` still exists on users. The city `Ward` hierarchy is reference data only until a future migration.
- `seed.js` is obsolete and dangerous: `npm run seed` **wipes `User`, `Complaint`, `Reward`, `StoreItem`** and writes broken college fixtures. Never run it against Atlas. This script is its replacement for development.

## How to avoid running the obsolete seed
- Use only `node seed-city-dev.js` (guarded) and `node seed-city.js` (additive).
- Treat `npm run seed` as disabled-by-policy; it is kept in `package.json` untouched for history only.
