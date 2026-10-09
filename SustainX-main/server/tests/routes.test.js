const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');
const CollectionRoute = require('../models/CollectionRoute');
const SmartBin = require('../models/SmartBin');
const Vehicle = require('../models/Vehicle');
const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');

let baseUrl;
let env;
let tokens;
let vehicleId;

before(async () => {
  ({ baseUrl, env } = await start());
  const admin = await login(baseUrl, 'admin', 'tadmin@test.edu');
  const collector = await login(baseUrl, 'collector', 'tcollector@test.edu');
  const citizen = await login(baseUrl, 'student', 'tstudent@test.edu');
  tokens = {
    admin: authHeaders(admin.body.token),
    collector: authHeaders(collector.body.token),
    citizen: authHeaders(citizen.body.token),
  };

  const vehicle = await Vehicle.create({ plate: 'RT-PLAN-1', type: 'tipper', capacityKg: 3500, block: 'A' });
  vehicleId = vehicle._id;
  await SmartBin.create({
    binId: 'RT-BIN-1',
    name: 'Route Test Bin',
    block: 'A',
    location: { type: 'Point', coordinates: [73.0158, 19.0167] },
    currentLevel: 92,
    isActive: true,
  });
  await Complaint.create({
    complaintId: 'RT-COMP-1',
    user: env.users.student._id,
    location: 'Block A - Route Stop',
    locationPoint: { type: 'Point', coordinates: [73.016, 19.017] },
    wasteType: 'Mixed Waste',
    description: 'Route planning probe',
    block: 'A',
    status: 'pending',
  });
});

after(async () => {
  await stop();
});

const routeCount = () => CollectionRoute.countDocuments({});

test('successful planning persists a route with stops and audit meta', async () => {
  const res = await fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId, collectorId: env.users.collector._id, blocks: ['A'] }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.routeId);
  assert.ok(Array.isArray(body.stops) && body.stops.length >= 1);

  const stored = await CollectionRoute.findOne({ routeId: body.routeId }).lean();
  assert.ok(stored, 'route persisted');
  assert.equal(stored.status, 'planned');
  for (const s of stored.stops) {
    assert.ok(['low', 'medium', 'high', 'critical'].includes(s.priority), 'stop priority is a valid enum');
    assert.ok(s.location && s.location.type === 'Point', 'stop location is GeoJSON');
  }

  const auditEntry = await AuditLog.findOne({ action: 'route.planned' }).lean();
  assert.ok(auditEntry, 'audit entry written');
  assert.ok(auditEntry.meta && auditEntry.meta.routeId === body.routeId);
  assert.ok(auditEntry.meta && auditEntry.meta.wards !== undefined, 'audit meta carries defined wards');
});

test('missing vehicleId/collectorId is rejected without persisting', async () => {
  const before = await routeCount();
  const res = await fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks: ['A'] }),
  });
  assert.equal(res.status, 400);
  assert.equal(await routeCount(), before);
});

test('unknown vehicle is rejected without persisting', async () => {
  const before = await routeCount();
  const res = await fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleId: '000000000000000000000000',
      collectorId: env.users.collector._id,
      blocks: ['A'],
    }),
  });
  assert.equal(res.status, 404);
  assert.equal(await routeCount(), before);
});

test('no collection points returns 400 without persisting', async () => {
  const before = await routeCount();
  const res = await fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleId,
      collectorId: env.users.collector._id,
      includeBins: false,
      includeComplaints: false,
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /no collection points/i);
  assert.equal(await routeCount(), before);
});

test('malformed ward scope is rejected without persisting', async () => {
  const before = await routeCount();
  for (const payload of [
    { vehicleId, collectorId: env.users.collector._id, wards: 'A' },
    { vehicleId, collectorId: env.users.collector._id, startLocation: [999, 999] },
  ]) {
    const res = await fetch(`${baseUrl}/api/routes/plan`, {
      method: 'POST',
      headers: { ...tokens.admin, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 400);
  }
  assert.equal(await routeCount(), before);
});

test('non-admin roles cannot plan routes', async () => {
  const before = await routeCount();
  for (const token of [tokens.collector, tokens.citizen]) {
    const res = await fetch(`${baseUrl}/api/routes/plan`, {
      method: 'POST',
      headers: { ...token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId, collectorId: env.users.collector._id, blocks: ['A'] }),
    });
    assert.equal(res.status, 403);
  }
  assert.equal(await routeCount(), before);
});

test('unavailable vehicle is rejected without persisting', async () => {
  const broken = await Vehicle.create({ plate: 'RT-PLAN-DOWN', status: 'maintenance', block: 'A' });
  const before = await routeCount();
  const res = await fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId: broken._id, collectorId: env.users.collector._id, blocks: ['A'] }),
  });
  assert.equal(res.status, 400);
  assert.equal(await routeCount(), before);
});
