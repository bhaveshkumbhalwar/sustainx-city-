const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');
const BinReading = require('../models/BinReading');
const Device = require('../models/Device');

let baseUrl;
let env;
let adminHeaders;
let studentHeaders;

before(async () => {
  ({ baseUrl, env } = await start());
  const admin = await login(baseUrl, 'admin', 'tadmin@test.edu');
  const student = await login(baseUrl, 'student', 'tstudent@test.edu');
  adminHeaders = authHeaders(admin.body.token);
  studentHeaders = authHeaders(student.body.token);
});

after(async () => {
  await stop();
});

const iotHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Device-Id': env.iot.deviceId,
  'X-Device-Key': env.iot.key,
});

const postReading = (level, binId = 'TEST-BIN-001') =>
  fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: iotHeaders(),
    body: JSON.stringify({ binId, level, block: 'A' }),
  });

test('GET /api/iot/readings requires authentication', async () => {
  const res = await fetch(`${baseUrl}/api/iot/readings?binId=TEST-BIN-001`);
  assert.equal(res.status, 401);
});

test('below-threshold reading updates device lastSeenAt and is stored', async () => {
  const res = await postReading(40);
  assert.equal(res.status, 201);

  const device = await Device.findOne({ deviceId: 'DEV-TEST' });
  assert.ok(device.lastSeenAt instanceof Date);

  const count = await BinReading.countDocuments({ binId: 'TEST-BIN-001' });
  assert.ok(count >= 1);
});

test('GET /api/iot/readings returns history with limit', async () => {
  await postReading(45);
  await postReading(50);

  const res = await fetch(`${baseUrl}/api/iot/readings?binId=TEST-BIN-001&limit=2`, {
    headers: studentHeaders,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 2);
  assert.ok(body.every((r) => r.binId === 'TEST-BIN-001'));
  assert.ok(body.every((r) => typeof r.level === 'number' && r.readAt));
  assert.ok(body.every((r) => !('apiKeyHash' in r)));
});

test('GET /api/iot/readings honors since filter', async () => {
  const since = new Date(Date.now() + 60 * 1000).toISOString();
  const res = await fetch(
    `${baseUrl}/api/iot/readings?binId=TEST-BIN-001&since=${encodeURIComponent(since)}`,
    { headers: studentHeaders }
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test('GET /api/bins exposes online flag and lastSeen', async () => {
  const res = await fetch(`${baseUrl}/api/bins`, { headers: adminHeaders });
  assert.equal(res.status, 200);
  const bins = await res.json();
  const bin = bins.find((b) => b.binId === 'TEST-BIN-001');
  assert.ok(bin);
  assert.equal(bin.online, true);
  assert.ok(bin.lastSeen);
});

test('overflow reading creates exactly one IoT complaint (deduplicated)', async () => {
  const first = await postReading(92);
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.ok(firstBody.complaintId);

  const dup = await postReading(95);
  assert.equal(dup.status, 409);

  const res = await fetch(`${baseUrl}/api/complaints?binId=TEST-BIN-001&type=iot`, {
    headers: adminHeaders,
  });
  assert.equal(res.status, 200);
  const complaints = await res.json();
  assert.equal(complaints.length, 1);
  assert.equal(complaints[0].complaintId, firstBody.complaintId);
});

test('GET /api/devices is admin-only and never leaks key hashes', async () => {
  const anon = await fetch(`${baseUrl}/api/devices`);
  assert.equal(anon.status, 401);

  const student = await fetch(`${baseUrl}/api/devices`, { headers: studentHeaders });
  assert.equal(student.status, 403);

  const admin = await fetch(`${baseUrl}/api/devices`, { headers: adminHeaders });
  assert.equal(admin.status, 200);
  const devices = await admin.json();
  const dev = devices.find((d) => d.deviceId === 'DEV-TEST');
  assert.ok(dev);
  assert.ok(!('apiKeyHash' in dev));
});

test('disabling a device blocks ingest; re-enabling restores it', async () => {
  const device = await Device.findOne({ deviceId: 'DEV-TEST' });

  const disable = await fetch(`${baseUrl}/api/devices/${device._id}`, {
    method: 'PUT',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(disable.status, 200);
  assert.equal((await disable.json()).enabled, false);

  const blocked = await postReading(30);
  assert.equal(blocked.status, 401);

  const enable = await fetch(`${baseUrl}/api/devices/${device._id}`, {
    method: 'PUT',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(enable.status, 200);

  const ok = await postReading(30);
  assert.equal(ok.status, 201);
});

test('device toggle rejects non-boolean enabled flag', async () => {
  const device = await Device.findOne({ deviceId: 'DEV-TEST' });
  const res = await fetch(`${baseUrl}/api/devices/${device._id}`, {
    method: 'PUT',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: 'yes' }),
  });
  assert.equal(res.status, 400);
});
