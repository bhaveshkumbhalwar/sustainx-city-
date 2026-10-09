const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop } = require('./helpers');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Ward = require('../models/Ward');
const {
  buildBlockMap,
  classifyRecord,
  planMigration,
  verifyManifest,
  summarize,
} = require('../utils/wardMigration');

before(async () => {
  await start();
});

after(async () => {
  await stop();
});

// ── Pure mapping: only explicit Ward records count ────────────────────────
test('buildBlockMap uses explicit legacyBlock claims only', () => {
  const { map, conflicts } = buildBlockMap([
    { _id: 'w1', code: 'W1', legacyBlock: 'A' },
    { _id: 'w2', code: 'W2', legacyBlock: 'B' },
    { _id: 'w9', code: 'W9', legacyBlock: null },
    { _id: 'wx', code: null, legacyBlock: 'C' },
  ]);
  assert.deepEqual(map.A, { code: 'W1', wardId: 'w1' });
  assert.deepEqual(map.B, { code: 'W2', wardId: 'w2' });
  assert.ok(!('C' in map), 'a block with no Ward claim must stay unmapped (never inferred)');
  assert.ok(!('W9' in map));
  assert.deepEqual(conflicts, []);
});

test('duplicate legacyBlock claims become conflicts, never a mapping', () => {
  const { map, conflicts } = buildBlockMap([
    { _id: 'a', code: 'W8A', legacyBlock: 'Q' },
    { _id: 'b', code: 'W8B', legacyBlock: 'Q' },
  ]);
  assert.ok(!('Q' in map), 'ambiguous block must not resolve');
  assert.deepEqual(conflicts, [{ block: 'Q', codes: ['W8A', 'W8B'] }]);
});

// ── Classification covers all five statuses ──────────────────────────────
test('classifyRecord distinguishes all record states', () => {
  const map = { A: { code: 'W1' }, B: { code: 'W2' } };
  assert.equal(classifyRecord({ ward: 'W1' }, map).status, 'already-correct');
  assert.equal(classifyRecord({ ward: 'W1', block: 'A' }, map).status, 'already-correct');
  assert.equal(classifyRecord({ block: 'B' }, map).status, 'mapped');
  assert.equal(classifyRecord({}, map).status, 'missing');
  assert.equal(classifyRecord({ block: 'Z9' }, map).status, 'unmapped');
  assert.equal(classifyRecord({ ward: 'W2', block: 'A' }, map).status, 'conflicting');
  assert.equal(classifyRecord({ ward: 'w1', block: 'a' }, map).status, 'already-correct', 'matching is case-insensitive');
});

// ── Planner determinism / idempotency ─────────────────────────────────────
test('planning is deterministic and empty for already-correct input', () => {
  const input = {
    wards: [{ code: 'W1', legacyBlock: 'A' }],
    collections: {
      users: [{ _id: 'u1', ward: 'W1', block: 'A' }, { _id: 'u2', ward: 'W1' }],
    },
  };
  const first = planMigration(input);
  const second = planMigration(input);
  assert.deepEqual(first.manifest ?? first.collections.users.manifest, second.collections.users.manifest);
  assert.deepEqual(first.collections.users.manifest, []);
  assert.equal(first.collections.users.counts['already-correct'], 2);
  assert.deepEqual(summarize(first).length > 0, true);
});

// ── Manifest verification buckets ────────────────────────────────────────
test('verifyManifest separates safe, not-applied, unsafe and needs-review', async () => {
  const manifest = [
    { collection: 'users', id: 'u1', field: 'ward', from: null, to: 'W1' },
    { collection: 'users', id: 'u2', field: 'ward', from: null, to: 'W1' },
    { collection: 'users', id: 'u3', field: 'ward', from: null, to: 'W1' },
    { collection: 'users', id: 'gone', field: 'ward', from: null, to: 'W1' },
    { collection: 'users', id: 'u5', field: 'ward', from: 'W9', to: 'W1' },
  ];
  const live = {
    u1: { ward: 'W1' },
    u2: { ward: null },
    u3: { ward: 'W2' },
    u5: { ward: 'W1' },
  };
  const result = await verifyManifest(manifest, async (collection, id) => live[id] ?? null);
  assert.deepEqual(result.safe.map((e) => e.id), ['u1']);
  assert.deepEqual(result.notApplied.map((e) => e.id), ['u2']);
  assert.deepEqual(result.unsafe.map((e) => e.id).sort(), ['gone', 'u3']);
  assert.deepEqual(result.needsReview.map((e) => e.id), ['u5']);
});

// ── Isolated-DB read path (local throwaway DB only — never Atlas) ─────────
test('planner counts real collections: mapped, conflicting, missing, unmapped', async () => {
  const cityId = new mongoose.Types.ObjectId();
  const wardDocs = await Ward.create([
    { name: 'Ward One', code: 'W1', city: cityId, legacyBlock: 'A' },
    { name: 'Ward Two', code: 'W2', city: cityId, legacyBlock: 'B' },
    { name: 'Ward Nine', code: 'W9', city: cityId },
  ]);
  await User.create([
    { password: '112233', role: 'student', name: 'M1', email: 'm1@test.edu', block: 'A' },
    { password: '112233', role: 'collector', name: 'M2', email: 'm2@test.edu', block: 'B' },
    { password: '112233', role: 'collector', name: 'M3', email: 'm3@test.edu', ward: 'W1', block: 'A' },
    { password: '112233', role: 'collector', name: 'M4', email: 'm4@test.edu', ward: 'W2', block: 'A' },
    { password: '112233', role: 'collector', name: 'M5', email: 'm5@test.edu', block: 'Z9' },
    { password: '112233', role: 'admin', name: 'M6', email: 'm6@test.edu' },
  ]);
  const citizen = await User.findOne({ email: 'm1@test.edu' });
  await Complaint.create([
    { complaintId: 'WM-1', user: citizen._id, location: 'L1', wasteType: 'Plastic', description: 'd1', block: 'A', status: 'pending' },
    { complaintId: 'WM-2', user: citizen._id, location: 'L2', wasteType: 'Plastic', description: 'd2', block: 'Z9', status: 'pending' },
  ]);
  // Dirty legacy row with no scope at all (bypasses validation, like real dirt).
  await Complaint.collection.insertOne({
    complaintId: 'WM-3', user: citizen._id, location: 'L3', wasteType: 'Plastic',
    description: 'd3', status: 'pending', createdAt: new Date(), updatedAt: new Date(),
  });

  const wards = await Ward.find({}).lean();
  const users = await User.find({ email: /^m\d@test\.edu$/ }).lean();
  const complaints = await Complaint.find({ complaintId: /^WM-/ }).lean();
  const report = planMigration({ wards, collections: { users, complaints } });

  assert.equal(report.collections.users.counts.mapped, 2, 'm1 (A) and m2 (B) map');
  assert.equal(report.collections.users.counts['already-correct'], 1, 'm3 consistent');
  assert.equal(report.collections.users.counts.conflicting, 1, 'm4 W2-vs-A conflicts');
  assert.equal(report.collections.users.counts.unmapped, 1, 'm5 Z9 unmapped');
  assert.equal(report.collections.users.counts.missing, 1, 'm6 admin has no scope');
  assert.equal(report.collections.complaints.counts.mapped, 1, 'WM-1 maps');
  assert.equal(report.collections.complaints.counts.unmapped, 1, 'WM-2 Z9 unmapped');
  assert.equal(report.collections.complaints.counts.missing, 1, 'WM-3 missing scope');
  assert.ok(
    report.collections.users.manifest.every((e) => e.from === null && e.to && e.basis),
    'manifest entries carry from/to/basis for precise rollback'
  );
  assert.ok(report.collections.users.manifest.some((e) => e.to === 'W1'));
  assert.ok(wardDocs.length === 3);
});
