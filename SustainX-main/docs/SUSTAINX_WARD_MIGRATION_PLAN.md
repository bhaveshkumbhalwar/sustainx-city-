# SustainX — Ward Migration Plan (Dry-Run Preparation)

Status: **design + dry-run planning only**. No applier exists yet, no database was touched, no seeds or migrations ran. See "Why no executable applier yet" below.

## 1. Verified mapping evidence (no inference)

The A–E → W1–W5 correspondence is supported **only** where Ward records say so:

| Block | Ward code | Evidence |
|---|---|---|
| A | W1 | `seed-city.js:34` (`['W1','Sector 1',…,'A']`) + `Ward.legacyBlock` (`models/Ward.js:10`) |
| B | W2 | `seed-city.js:35` |
| C | W3 | `seed-city.js:36` (spec; confirm live Ward docs before relying on it) |
| D | W4 | `seed-city.js:37` (spec; confirm live) |
| E | W5 | `seed-city.js:38` (spec; confirm live) |

Rules enforced by the planner (`server/utils/wardMigration.js`): a block maps **iff** ≥1 live Ward record claims it via `legacyBlock`; duplicate claims → conflict (never auto-resolved); Wards without `legacyBlock` map nothing; blocks without claims stay `unmapped`. Naming similarity alone never creates a mapping.

## 2. Canonical form

**Ward code strings** (`'W1'`) on all operational collections (rationale: stable in URLs/logs/aggregations, no `$lookup` needed; see `SUSTAINX_WARD_IDENTITY_AUDIT.md` §5). `SmartBin.ward` stays an ObjectId ref, resolved code→document at apply time — the planner intentionally does not rewrite refs.

## 3. Collections requiring a ward code

| Collection | Today | Migration need |
|---|---|---|
| `Complaint` | `block` required, no `ward` | Add nullable `ward`; backfill from block map |
| `BinData`, `BinReading`, `Vehicle`, `Order` | `block` set; no `ward` (except none) | Add nullable `ward`; backfill |
| `User` | `block` required (student/collector); `ward` free text, unused | Tighten `ward` to required-after-cutover; backfill |
| `Device`, `CollectionTask`, `CollectionRoute` | string `ward` already exists | Backfill where empty; verify alphabet |
| `SmartBin` | `block` string + `ward` ObjectId (often null) | Resolve code→`_id` at apply time |
| `Ward` | `code` + `legacyBlock` | Source of truth; **never written by migration** |

Out of scope: `City/Zone/Area` hierarchy, rewards/store, notifications, audit logs.

## 4. Dry-run report format

Produced by `planMigration({ wards, collections })` (`server/utils/wardMigration.js`, pure — no I/O). Per collection: `total`, `already-correct`, `mapped`, `missing`, `unmapped`, `conflicting`, plus a `manifest[]` and an `issues[]` list with record ids and reasons. Global `mapConflicts[]` lists ambiguous blocks. `summarize()` renders the console/text form. Deterministic: identical input → identical report (records sorted by id).

## 5. Migration manifest format (rollback-precise)

Each entry: `{ collection, id, field: 'ward', from, to, basis }` where `from` is the pre-state (`null` for backfills) and `basis` cites the mapping (`legacyBlock 'A'`). Only `mapped` records get entries — `conflicting`/`unmapped`/`missing` rows are reported, never proposed. `verifyManifest(manifest, lookup)` re-checks live values into `safe` / `notApplied` / `unsafe` / `needsReview`; entries that would overwrite a pre-existing value (`from !== null`) are **never** auto-revertable — this is how rule 6 (no `$unset` of pre-existing data) is enforced mechanically.

## 6. Preflight checks (future applier MUST enforce, in order)

1. Explicit enable flag present (e.g. `ALLOW_WARD_MIGRATION=true`), else exit 2 with zero I/O beyond the check.
2. Parse target DB name from the URI; abort unless it is the named isolated dev database.
3. Connect; re-verify `connection.name`; abort + disconnect on mismatch.
4. Backup confirmation: require a `BACKUP_REF` (mongodump snapshot id) passed explicitly; refuse without it.
5. Sanity bounds: fail if any collection count differs from the approved dry-run report by more than an explicit tolerance (default: zero) — catches a moved target database.
6. Emit the full dry-run report + manifest to a review file and stop unless `--apply --manifest <file>` names the reviewed artifact.

## 7. Why no executable applier yet (proposal, not implementation)

A planner can be pure, but an applier inherently needs: live record reads at volume, batched ordered writes, backup verification, and human-reviewed manifest intake. That cannot be achieved with read-only diagnostics, so an applier **will** be necessary — proposed interface:

```text
node migrate-ward.js --dry-run --out ward-plan.json   # read-only; planner + manifest
node migrate-ward.js --apply --manifest ward-plan.json --backup <ref> --db sustainx_city_dev
```

Guards: default-dry-run, opt-in env, pinned DB name (flag + live check), manifest-required (refuses to invent changes), per-batch verify-then-write with stop-on-first-mismatch, full-run report. It must import `utils/wardMigration.js` (already created and tested) rather than reimplementing mapping. Explicitly **not built in this task** per the prefer-docs-and-tests-first rule.

## 8. Backup, verification, rollback

- Backup: `mongodump` of the target DB before any apply; store snapshot id as `BACKUP_REF`.
- Verification: re-run planner post-apply — expect `mapped: 0`, `already-correct` increased by exactly the manifest length, `missing/unmapped/conflicting` unchanged.
- Rollback: restore from snapshot (primary path). Selective revert is supported only for `safe` entries per `verifyManifest` (restore `from`, which for backfills is `null` → set-null, never `$unset` of data that predates the migration); `needsReview` entries require manual handling. Rollback itself must be manifest-driven and re-verified with a second planner pass.

## 9. Regression tests (implemented: `server/tests/ward-migration.test.js`, 6 tests)

Mapping only from explicit claims; duplicate-claim conflicts; all five classification statuses incl. case-insensitivity; planner determinism + empty manifest for clean input; verifier buckets (`safe`/`notApplied`/`unsafe`/`needsReview`); isolated-DB read path (Ward + User + Complaint fixtures in throwaway `sustainx_test`) asserting exact per-status counts and manifest `from/to/basis` shape. Full suite: **103/103** (97 prior + 6 new).

## 10. Staged rollout order

Dry-run review (this document + planner output on a staging copy) → backup → apply on isolated dev → verify → dual-read code changes → cutover validators → drop `block` columns in a later release. Each stage independently verifiable and reversible per §8.
