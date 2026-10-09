/**
 * Ward-identity migration PLANNER — dry-run only.
 *
 * Pure functions, zero database I/O, zero writes, zero connections.
 * This module can *propose* a migration (counts + per-record manifest) and
 * *verify* a manifest against current values. It can never apply one: there
 * is intentionally no apply/write function here. A future executable applier
 * must import this planner and add guarded writes (see
 * docs/SUSTAINX_WARD_MIGRATION_PLAN.md).
 *
 * Mapping discipline: a legacy block (A–E) maps to a ward code (W1–W5) ONLY
 * when an explicit Ward record says so via `legacyBlock`. Nothing is ever
 * inferred from naming, position, or frequency.
 *
 * Record statuses:
 * - already-correct : ward code present (nothing to migrate)
 * - mapped          : no ward, block resolves via the map (manifest entry)
 * - missing         : neither ward nor block (human decision required)
 * - unmapped        : block has no Ward-record mapping (human decision required)
 * - conflicting     : ward present but disagrees with the block map, OR the
 *                     block itself is claimed by several Ward records
 *                     (ambiguous map entry — never auto-resolved)
 */

const normBlock = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  return s || null;
};

const normWard = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  return s || null;
};

/**
 * Build the block→ward map from Ward records ONLY.
 * wardDocs: [{ _id?, code, legacyBlock }] (plain objects).
 * Returns { map: { BLOCK: { code, wardId } }, conflicts: [{ block, codes }] }.
 * Duplicate legacyBlock claims become conflicts — the map holds neither.
 */
const buildBlockMap = (wardDocs = []) => {
  const claims = new Map(); // BLOCK -> Set(code)
  const wardIdByCode = new Map();
  for (const w of wardDocs) {
    const code = normWard(w && w.code);
    if (!code) continue;
    if (w && w._id !== undefined) wardIdByCode.set(code, String(w._id));
    const block = normBlock(w && w.legacyBlock);
    if (!block) continue;
    if (!claims.has(block)) claims.set(block, new Set());
    claims.get(block).add(code);
  }
  const map = {};
  const conflicts = [];
  for (const [block, codes] of claims) {
    const list = [...codes].sort();
    if (list.length === 1) {
      map[block] = { code: list[0], wardId: wardIdByCode.get(list[0]) || null };
    } else {
      conflicts.push({ block, codes: list });
    }
  }
  return { map, conflicts };
};

const idOf = (record) => String((record && (record._id ?? record.id)) ?? '?');

/**
 * Classify one operational record: { _id?, block?, ward? }.
 * Returns { status, note } with status in
 * already-correct | mapped | missing | unmapped | conflicting.
 */
const classifyRecord = (record = {}, blockMap = {}) => {
  const block = normBlock(record.block);
  const ward = normWard(record.ward);
  if (ward && !block) return { status: 'already-correct', note: 'ward code present' };
  if (ward && block) {
    const mapped = blockMap[block];
    if (!mapped) return { status: 'already-correct', note: 'ward present; legacy block has no mapping (left for review)' };
    if (mapped.code === ward) return { status: 'already-correct', note: 'ward agrees with block map' };
    return { status: 'conflicting', note: `ward '${ward}' disagrees with block '${block}' → '${mapped.code}'` };
  }
  if (!ward && block) {
    if (Object.prototype.hasOwnProperty.call(blockMap, block)) {
      return { status: 'mapped', note: `block '${block}' → ward '${blockMap[block].code}'` };
    }
    return { status: 'unmapped', note: `block '${block}' has no Ward-record mapping` };
  }
  return { status: 'missing', note: 'neither ward nor block present' };
};

/**
 * Plan one collection. Records with ambiguous-map blocks (listed in
 * mapConflicts) are reported as conflicting, never mapped.
 */
const planCollection = (name, records = [], blockMap = {}, mapConflicts = []) => {
  const ambiguous = new Set(mapConflicts.map((c) => c.block));
  const counts = { total: 0, 'already-correct': 0, mapped: 0, missing: 0, unmapped: 0, conflicting: 0 };
  const manifest = [];
  const issues = [];
  const sorted = [...records].sort((a, b) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0));
  for (const record of sorted) {
    counts.total += 1;
    const block = normBlock(record.block);
    if (block && ambiguous.has(block)) {
      counts.conflicting += 1;
      issues.push({ id: idOf(record), status: 'conflicting', note: `block '${block}' is claimed by several Ward records` });
      continue;
    }
    const { status, note } = classifyRecord(record, blockMap);
    counts[status] += 1;
    if (status === 'mapped') {
      manifest.push({
        collection: name,
        id: idOf(record),
        field: 'ward',
        from: normWard(record.ward),
        to: blockMap[block].code,
        basis: `legacyBlock '${block}'`,
      });
    } else if (status !== 'already-correct') {
      issues.push({ id: idOf(record), status, note });
    }
  }
  return { name, counts, manifest, issues };
};

/**
 * Plan every collection at once.
 * input: { wards: [wardDocs], collections: { name: [records] } }
 * Deterministic: identical input always yields the identical report.
 */
const planMigration = (input = {}) => {
  const { map, conflicts } = buildBlockMap(input.wards || []);
  const collections = {};
  const totals = { total: 0, 'already-correct': 0, mapped: 0, missing: 0, unmapped: 0, conflicting: 0 };
  for (const [name, records] of Object.entries(input.collections || {})) {
    const planned = planCollection(name, records || [], map, conflicts);
    collections[name] = planned;
    for (const k of Object.keys(totals)) totals[k] += planned.counts[k];
  }
  totals.conflicting += 0; // map-level conflicts surface per record above; kept explicit
  return {
    generatedAt: new Date().toISOString(),
    map,
    mapConflicts: conflicts,
    collections,
    totals: { ...totals, mapConflicts: conflicts.length },
  };
};

/**
 * Verify a manifest against CURRENT values before any rollback/action.
 * lookup: async (collection, id) => record | null (read-only, injected).
 * - safe:         live value equals manifest.to (our planned write is intact;
 *                 restoring `from` returns the exact pre-state).
 * - notApplied:   live ward still empty (planned write never happened; no-op).
 * - unsafe:       record gone, or live value changed since planning.
 * - needsReview:  entry would overwrite a pre-existing value — per policy this
 *                 module never auto-suggests $unset/revert of pre-existing data.
 */
const verifyManifest = async (manifest = [], lookup) => {
  const safe = [];
  const notApplied = [];
  const unsafe = [];
  const needsReview = [];
  for (const entry of manifest) {
    const live = lookup ? await lookup(entry.collection, entry.id) : null;
    const liveWard = live ? normWard(live.ward) : undefined;
    if (live === null || live === undefined) {
      unsafe.push({ ...entry, reason: 'record no longer exists' });
    } else if (entry.from !== null && entry.from !== undefined) {
      needsReview.push({ ...entry, liveWard, reason: 'entry overwrote a pre-existing value; manual review required' });
    } else if (liveWard === null) {
      notApplied.push({ ...entry, liveWard });
    } else if (liveWard === normWard(entry.to)) {
      safe.push({ ...entry, liveWard });
    } else {
      unsafe.push({ ...entry, liveWard, reason: 'live value already changed since planning' });
    }
  }
  return { safe, notApplied, unsafe, needsReview };
};

const summarize = (report) => {
  const lines = [
    `Ward migration dry-run: ${report.totals.total} records scanned, ` +
      `${report.totals.mapped} would be mapped, ${report.totals['already-correct']} already correct, ` +
      `${report.totals.missing} missing scope, ${report.totals.unmapped} unmapped, ` +
      `${report.totals.conflicting} conflicting, ${report.totals.mapConflicts} ambiguous map entries.`,
  ];
  for (const [name, c] of Object.entries(report.collections)) {
    lines.push(
      `  ${name}: total=${c.counts.total} ok=${c.counts['already-correct']} mapped=${c.counts.mapped} ` +
        `missing=${c.counts.missing} unmapped=${c.counts.unmapped} conflicting=${c.counts.conflicting}`
    );
  }
  return lines;
};

module.exports = {
  normBlock,
  normWard,
  buildBlockMap,
  classifyRecord,
  planCollection,
  planMigration,
  verifyManifest,
  summarize,
};
