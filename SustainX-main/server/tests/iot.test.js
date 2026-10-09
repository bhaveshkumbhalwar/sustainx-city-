const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop } = require('./helpers');
const BinReading = require('../models/BinReading');
const SmartBin = require('../models/SmartBin');

let baseUrl;
let env;

before(async () => {
  ({ baseUrl, env } = await start());
});

after(async () => {
  await stop();
});

const iotHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Device-Id': env.iot.deviceId,
  'X-Device-Key': env.iot.key,
});

test('IoT ingest rejects requests without device credentials', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 92, block: 'A' }),
  });
  assert.equal(res.status, 401);
});

test('IoT ingest rejects an unknown device', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': 'DEV-UNKNOWN', 'X-Device-Key': 'nope' },
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 92, block: 'A' }),
  });
  assert.equal(res.status, 401);
});

test('IoT ingest rejects invalid level', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: iotHeaders(),
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 150, block: 'A' }),
  });
  assert.equal(res.status, 400);
});

test('IoT ingest below threshold stores reading without alert', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: iotHeaders(),
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 40, block: 'A' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.message, /below threshold/i);

  const reading = await BinReading.countDocuments({ binId: 'TEST-BIN-001' });
  assert.equal(reading, 1);
});

test('IoT full bin creates an alert complaint and updates SmartBin', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: iotHeaders(),
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 92, block: 'A' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.complaintId);

  const bin = await SmartBin.findOne({ binId: 'TEST-BIN-001' });
  assert.equal(bin.currentLevel, 92);
  assert.equal(bin.alert, true);
  assert.equal(bin.status, 'full');
});

test('duplicate alert within cooldown is deduplicated', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`, {
    method: 'POST',
    headers: iotHeaders(),
    body: JSON.stringify({ binId: 'TEST-BIN-001', level: 95, block: 'A' }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.deduplicated, true);
});

test('GET /api/iot/data returns latest per-bin readings', async () => {
  const res = await fetch(`${baseUrl}/api/iot/data`);
  assert.equal(res.status, 200);
  const bins = await res.json();
  assert.ok(Array.isArray(bins));
  assert.ok(bins.some((b) => b.binId === 'TEST-BIN-001'));
});