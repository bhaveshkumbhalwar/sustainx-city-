const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');
const Notification = require('../models/Notification');
const Complaint = require('../models/Complaint');
const Vehicle = require('../models/Vehicle');
const iotService = require('../services/iotService');

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

// ── Analytics on (near-)empty DB ────────────────────────────────────────────
test('analytics overview returns 200 with empty dataset', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body, 'object');
});

test('analytics endpoints are admin-only', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview`, { headers: tokens.student });
  assert.equal(res.status, 403);
});

// ── Geolocation ─────────────────────────────────────────────────────────────
test('GIS nearby-bins rejects missing coordinates', async () => {
  const res = await fetch(`${baseUrl}/api/gis/nearby-bins`, { headers: tokens.student });
  assert.equal(res.status, 400);
});

test('GIS nearby-bins accepts valid coordinates and returns an array', async () => {
  const res = await fetch(`${baseUrl}/api/gis/nearby-bins?lat=20.0&lng=73.0`, { headers: tokens.student });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

test('complaint submitted with lat/lng stores a valid locationPoint', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'Block A - Lab 3',
      wasteType: 'Plastic',
      description: 'Geo probe',
      block: 'A',
      lat: 20.5,
      lng: 73.1,
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.deepEqual(body.locationPoint.coordinates, [73.1, 20.5]);
  assert.equal(body.locationData.lat, 20.5);
});

test('complaint submitted without lat/lng has no locationPoint', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'Block A - Gate',
      wasteType: 'Plastic',
      description: 'No geo probe',
      block: 'A',
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.locationPoint, undefined);
});

// ── Notifications lifecycle ─────────────────────────────────────────────────
test('notifications: unread count, mark read, mark all read', async () => {
  await Notification.create({ user: env.users.student._id, message: 'N1', type: 'info', isRead: false });
  await Notification.create({ user: env.users.student._id, message: 'N2', type: 'info', isRead: false });

  const unread1 = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: tokens.student });
  assert.equal(unread1.status, 200);
  const unreadBefore = (await unread1.json()).unread;
  assert.ok(unreadBefore >= 2);

  const list = await fetch(`${baseUrl}/api/notifications?page=0&limit=-3`, { headers: tokens.student });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('x-total-count'), String(unreadBefore));
  const clamped = await list.json();
  // Limit clamped: page=1, limit=1 => 1 item
  assert.equal(clamped.length, Math.min(unreadBefore, 1));

  const readOne = await fetch(`${baseUrl}/api/notifications/read/${clamped[0]._id}`, {
    method: 'PUT',
    headers: tokens.student,
  });
  assert.equal(readOne.status, 200);

  const unread2 = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: tokens.student });
  const afterRead = (await unread2.json()).unread;
  assert.equal(afterRead, unreadBefore - 1);

  const readAll = await fetch(`${baseUrl}/api/notifications/read-all`, {
    method: 'PUT',
    headers: tokens.student,
  });
  assert.equal(readAll.status, 200);

  const unread3 = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: tokens.student });
  assert.equal((await unread3.json()).unread, 0);
});

test('user cannot mark another users notification as read', async () => {
  const n = await Notification.create({ user: env.users.collector._id, message: 'foreign', type: 'info', isRead: false });
  const res = await fetch(`${baseUrl}/api/notifications/read/${n._id}`, {
    method: 'PUT',
    headers: tokens.student,
  });
  assert.equal(res.status, 401);
});

// ── IoT validation ──────────────────────────────────────────────────────────
test('IoT rejects missing binId or invalid level', async () => {
  const creds = { 'X-Device-Id': env.iot.deviceId, 'X-Device-Key': env.iot.key };

  const noBin = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: { ...creds, 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: 50 }),
  });
  assert.equal(noBin.status, 400);

  const badLevel = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: { ...creds, 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 101 }),
  });
  assert.equal(badLevel.status, 400);
});

test('IoT auth is header-only: credentials in body are rejected', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 10, deviceId: env.iot.deviceId, deviceKey: env.iot.key }),
  });
  assert.equal(res.status, 401);
});

test('IoT valid reading below threshold returns 201 without alert', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: { 'X-Device-Id': env.iot.deviceId, 'X-Device-Key': env.iot.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 30 }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.message, 'Level below threshold, no alert created');
});

// ── Vehicle location ────────────────────────────────────────────────────────
test('vehicle location update validates coordinates', async () => {
  const vehicle = await Vehicle.create({ plate: 'QA-VEH-1', block: 'A' });

  const bad = await fetch(`${baseUrl}/api/vehicles/${vehicle._id}/location`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 200, lng: 1000 }),
  });
  assert.equal(bad.status, 400);

  const good = await fetch(`${baseUrl}/api/vehicles/${vehicle._id}/location`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 20.5, lng: 73.1, speed: 12 }),
  });
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.deepEqual(body.vehicle.currentLocation.coordinates, [73.1, 20.5]);

  const history = await fetch(`${baseUrl}/api/vehicles/${vehicle._id}/history`, { headers: tokens.admin });
  assert.equal(history.status, 200);
  const hist = await history.json();
  assert.ok(hist.length >= 1);
});

// ── Upload limits & validation ──────────────────────────────────────────────
test('non-image upload rejected with 400', async () => {
  const fd = new FormData();
  fd.append('image', new Blob(['hello world'], { type: 'text/plain' }), 'note.txt');
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: tokens.student,
    body: fd,
  });
  assert.equal(res.status, 400);
});

test('image larger than 5MB rejected with 413', async () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 1);
  const fd = new FormData();
  fd.append('image', new Blob([big], { type: 'image/png' }), 'big.png');
  fd.append('location', 'Block A');
  fd.append('wasteType', 'Plastic');
  fd.append('description', 'oversized');
  fd.append('block', 'A');
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: tokens.student,
    body: fd,
  });
  assert.equal(res.status, 413);
});

// ── Route-level robustness ──────────────────────────────────────────────────
test('unknown API route returns 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/api/definitely-not-real`, { headers: tokens.student });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.message, 'API route not found');
});

test('malformed JSON body returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: '{ this is not json',
  });
  assert.equal(res.status, 400);
});

test('CORS: allowed origin gets access-control-allow-origin header', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('CORS: disallowed origin is blocked (no CORS headers)', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://evil.example.com' } });
  assert.notEqual(res.headers.get('access-control-allow-origin'), 'http://evil.example.com');
});

// ── Rate limiting ───────────────────────────────────────────────────────────
test('login endpoint rate-limits after 20 attempts per window', async () => {
  let lastStatus = 0;
  let saw429 = false;
  // 3 valid logins already consumed in `before`. Fire enough to cross the quota.
  for (let i = 0; i < 30; i += 1) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tstudent@test.edu', password: 'wrongpass', role: 'student' }),
    });
    lastStatus = res.status;
    if (res.status === 429) {
      saw429 = true;
      break;
    }
  }
  assert.ok(saw429, 'expected at least one 429 after exceeding login quota');
  assert.equal(lastStatus, 429);
});

test('analytics endpoint rate-limits after 120 requests per minute', async () => {
  let saw429 = false;
  for (let i = 0; i < 130; i += 1) {
    const res = await fetch(`${baseUrl}/api/analytics/overview`, { headers: tokens.admin });
    if (res.status === 429) {
      saw429 = true;
      break;
    }
  }
  assert.ok(saw429, 'expected a 429 once analytics quota is exceeded');
});

test('audit endpoint caps requested limit at 200', async () => {
  const res = await fetch(`${baseUrl}/api/audit?limit=5000`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('x-total-count') !== null);
  const body = await res.json();
  assert.ok(body.length <= 200);
});