const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');
const Complaint = require('../models/Complaint');

let baseUrl;
let env;
let tokens;

before(async () => {
  ({ baseUrl, env } = await start());
  const student = await login(baseUrl, 'student', 'tstudent@test.edu');
  const collector = await login(baseUrl, 'collector', 'tcollector@test.edu');
  const admin = await login(baseUrl, 'admin', 'tadmin@test.edu');
  tokens = {
    student: authHeaders(student.body.token),
    collector: authHeaders(collector.body.token),
    admin: authHeaders(admin.body.token),
  };
});

after(async () => {
  await stop();
});

test('student cannot list users', async () => {
  const res = await fetch(`${baseUrl}/api/users`, { headers: tokens.student });
  assert.equal(res.status, 403);
});

test('admin can list users', async () => {
  const res = await fetch(`${baseUrl}/api/users`, { headers: tokens.admin });
  assert.equal(res.status, 200);
});

test('student cannot award rewards', async () => {
  const res = await fetch(`${baseUrl}/api/rewards`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: env.users.student._id, activity: 'hack', points: 1000 }),
  });
  assert.equal(res.status, 403);
});

test('admin award credits points via server-verified pipeline', async () => {
  const res = await fetch(`${baseUrl}/api/rewards`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: env.users.student._id, activity: 'Test Award', points: 50 }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.updatedPoints, 150);
});

test('student only sees their own rewards', async () => {
  const res = await fetch(`${baseUrl}/api/rewards`, { headers: tokens.student });
  const rewards = await res.json();
  assert.ok(Array.isArray(rewards));
  assert.ok(rewards.every((r) => String(r.user?._id || r.user) === String(env.users.student._id)));
});

test('student cannot create bins (admin only)', async () => {
  const res = await fetch(`${baseUrl}/api/bins`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId: 'HACK-BIN' }),
  });
  assert.equal(res.status, 403);
});

test('collector cannot view complaints from another block', async () => {
  await Complaint.create({
    complaintId: 'BIZ-001',
    user: env.users.student._id,
    location: 'Block B - Corridor',
    wasteType: 'Mixed Waste',
    description: 'Other block complaint',
    block: 'B',
    status: 'pending',
  });
  const res = await fetch(`${baseUrl}/api/complaints/BIZ-001`, { headers: tokens.collector });
  assert.equal(res.status, 403);
});

test('analytics endpoints are admin only', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview`, { headers: tokens.student });
  assert.equal(res.status, 403);
});

test('admin can run AI insights (rule-based demo)', async () => {
  const res = await fetch(`${baseUrl}/api/ai/insights/run`, {
    method: 'POST',
    headers: tokens.admin,
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(Array.isArray(body.insights));
  assert.ok(body.insights.every((i) => i.mode === 'demo-rule-based'));
});

test('AI capabilities report FEATURE_NOT_AVAILABLE for model services', async () => {
  const res = await fetch(`${baseUrl}/api/ai/capabilities`, { headers: tokens.admin });
  const body = await res.json();
  assert.equal(body.capabilities.predict_bin_fill.status, 'FEATURE_NOT_AVAILABLE');
  assert.equal(body.capabilities.classify_waste_image.status, 'FEATURE_NOT_AVAILABLE');
});