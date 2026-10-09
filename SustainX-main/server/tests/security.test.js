const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { start, stop, login, authHeaders } = require('./helpers');
const { sanitizeQuery } = require('../utils/validate');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const SmartBin = require('../models/SmartBin');
const Vehicle = require('../models/Vehicle');
const StoreItem = require('../models/StoreItem');
const Order = require('../models/Order');

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

test('sanitizeQuery strips $ operator payloads', () => {
  assert.equal(sanitizeQuery({ $ne: 'pending' }), undefined);
  assert.equal(sanitizeQuery({ $gte: 10 }), undefined);
  assert.equal(sanitizeQuery({ $where: 'this.rewardPoints > 0' }), undefined);
  assert.equal(sanitizeQuery(['a', 'b']), undefined);
  assert.equal(sanitizeQuery('$where'), undefined);
  assert.equal(sanitizeQuery('  '), undefined);
  assert.equal(sanitizeQuery('pending'), 'pending');
  assert.equal(sanitizeQuery(5), 5);
  assert.equal(sanitizeQuery(true), true);
  assert.equal(sanitizeQuery(null), undefined);
});

test('JWT: missing token returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`);
  assert.equal(res.status, 401);
});

test('JWT: malformed token returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, { headers: authHeaders('not-a-token') });
  assert.equal(res.status, 401);
});

test('JWT: token signed with wrong secret returns 401', async () => {
  const bad = jwt.sign({ id: env.users.student._id }, 'wrong-secret');
  const res = await fetch(`${baseUrl}/api/complaints`, { headers: authHeaders(bad) });
  assert.equal(res.status, 401);
});

test('JWT: expired token returns 401', async () => {
  const expired = jwt.sign(
    { id: env.users.student._id, exp: Math.floor(Date.now() / 1000) - 10 },
    process.env.JWT_SECRET || 'test-secret'
  );
  const res = await fetch(`${baseUrl}/api/complaints`, { headers: authHeaders(expired) });
  assert.equal(res.status, 401);
});

test('NoSQL injection: complaint status[$ne] is neutralized', async () => {
  await Complaint.create({
    complaintId: 'INJ-CMP-001',
    user: env.users.student._id,
    location: 'Block A - Cafeteria',
    wasteType: 'Mixed Waste',
    description: 'Injection guard probe',
    block: 'A',
    status: 'pending',
  });
  const res = await fetch(`${baseUrl}/api/complaints?status[$ne]=pending`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  // Sanitized: status filter dropped, so the pending complaint is still returned.
  // Unsanitized: {status:{$ne:'pending'}} would exclude it.
  assert.ok(body.some((c) => c.complaintId === 'INJ-CMP-001'));
});

test('NoSQL injection: user role[$ne] is neutralized', async () => {
  const res = await fetch(`${baseUrl}/api/users?role[$ne]=admin`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  // Sanitized: role filter dropped -> admins still present.
  assert.ok(body.some((u) => u.role === 'admin'));
});

test('NoSQL injection: bin status[$ne] is neutralized', async () => {
  const res = await fetch(`${baseUrl}/api/bins?status[$ne]=ok`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  // TEST-BIN-001 has status 'ok'; an injected $ne filter would exclude it.
  assert.ok(body.some((b) => b.binId === 'TEST-BIN-001'));
});

test('NoSQL injection: vehicle status[$ne] is neutralized', async () => {
  await Vehicle.create({ plate: 'TEST-PLATE-1', block: 'A' });
  const res = await fetch(`${baseUrl}/api/vehicles?status[$ne]=available`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.some((v) => v.plate === 'TEST-PLATE-1'));
});

test('non-admin cannot deactivate own account via updateUser', async () => {
  const before_ = await User.findById(env.users.student._id);
  assert.equal(before_.isActive, true);

  const res = await fetch(`${baseUrl}/api/users/${env.users.student._id}`, {
    method: 'PUT',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(res.status, 200);
  const after_ = await User.findById(env.users.student._id);
  assert.equal(after_.isActive, true, 'non-admin self request must not toggle account status');
});

test('admin can deactivate an account and guarded routes reject it', async () => {
  const isolated = await User.create({
    password: '112233',
    role: 'student',
    name: 'Isolated User',
    email: 'isolated@test.edu',
    block: 'A',
  });
  const loginRes = await login(baseUrl, 'student', 'isolated@test.edu');
  const isoToken = authHeaders(loginRes.body.token);

  const res = await fetch(`${baseUrl}/api/users/${isolated._id}`, {
    method: 'PUT',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(res.status, 200);

  const blocked = await fetch(`${baseUrl}/api/complaints`, { headers: isoToken });
  assert.equal(blocked.status, 401);
});

test('AI bin fill estimate works for known bin and 404s for unknown', async () => {
  const known = await fetch(`${baseUrl}/api/ai/bins/TEST-BIN-001/fill-estimate`, { headers: tokens.admin });
  assert.equal(known.status, 200);
  const body = await known.json();
  assert.equal(body.binId, 'TEST-BIN-001');
  assert.ok('estimatedHoursToFullBoard' in body);

  const unknown = await fetch(`${baseUrl}/api/ai/bins/NOPE/fill-estimate`, { headers: tokens.admin });
  assert.equal(unknown.status, 404);
});

test('admin can assign a complaint to a specific collector', async () => {
  await Complaint.create({
    complaintId: 'INJ-ASG-001',
    user: env.users.student._id,
    location: 'Block A - Library',
    wasteType: 'Plastic',
    description: 'Assignment probe',
    block: 'A',
    status: 'pending',
  });

  const res = await fetch(`${baseUrl}/api/complaints/INJ-ASG-001/status`, {
    method: 'PUT',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'assigned', assignedTo: env.users.collector._id }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.assignedTo, env.users.collector._id.toString());
});

test('collector cannot assign a complaint to a specific other collector', async () => {
  await Complaint.create({
    complaintId: 'INJ-ASG-002',
    user: env.users.student._id,
    location: 'Block A - Gym',
    wasteType: 'Plastic',
    description: 'Assignment abuse probe',
    block: 'A',
    status: 'pending',
  });

  const res = await fetch(`${baseUrl}/api/complaints/INJ-ASG-002/status`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress', assignedTo: env.users.student._id }),
  });
  assert.equal(res.status, 403);
});

test('collector cannot complete a complaint that was never in-progress', async () => {
  await Complaint.create({
    complaintId: 'INJ-SKIP-001',
    user: env.users.student._id,
    location: 'Block A - Hostel',
    wasteType: 'Plastic',
    description: 'Skip-flow probe',
    block: 'A',
    status: 'pending',
  });

  const fd = new FormData();
  fd.append('image', new Blob([Buffer.from('89504e470d0a1a0a')], { type: 'image/png' }), 'proof.png');

  const res = await fetch(`${baseUrl}/api/complaints/complete/INJ-SKIP-001`, {
    method: 'POST',
    headers: tokens.collector,
    body: fd,
  });
  assert.equal(res.status, 400);
});

test('collector can complete after moving the complaint to in-progress', async () => {
  await Complaint.create({
    complaintId: 'INJ-OK-001',
    user: env.users.student._id,
    location: 'Block A - Quad',
    wasteType: 'Plastic',
    description: 'Happy path probe',
    block: 'A',
    status: 'pending',
  });

  const update = await fetch(`${baseUrl}/api/complaints/INJ-OK-001/status`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  assert.equal(update.status, 200);

  const fd = new FormData();
  fd.append('image', new Blob([Buffer.from('89504e470d0a1a0a')], { type: 'image/png' }), 'proof.png');

  const res = await fetch(`${baseUrl}/api/complaints/complete/INJ-OK-001`, {
    method: 'POST',
    headers: tokens.collector,
    body: fd,
  });
  assert.equal(res.status, 200);
  const stored = await Complaint.findOne({ complaintId: 'INJ-OK-001' });
  assert.equal(stored.status, 'completed');
  assert.ok(stored.completionImage);
});

test('collector cannot take an order from another block', async () => {
  const item = await StoreItem.create({
    name: 'Probe Item',
    description: 'probe',
    image: 'probe.png',
    pointsRequired: 10,
    stock: 5,
  });
  const order = await Order.create({
    orderId: 'ORD-PROBE',
    userName: 'Other Block Student',
    user: env.users.student._id,
    block: 'B',
    item: item._id,
    itemName: 'Probe Item',
    pointsUsed: 10,
  });

  const res = await fetch(`${baseUrl}/api/orders/assign/${order._id}`, {
    method: 'POST',
    headers: tokens.collector,
  });
  assert.equal(res.status, 403);
});

test('concurrent redemptions of the last stock unit only create one order', async () => {
  const item = await StoreItem.create({
    name: 'Race Item',
    description: 'race probe',
    image: 'race.png',
    pointsRequired: 50,
    stock: 1,
    isActive: true,
  });
  const student = await User.findById(env.users.student._id);
  await User.findByIdAndUpdate(student._id, { $set: { rewardPoints: 100 } });

  const attempt = () =>
    fetch(`${baseUrl}/api/store/redeem`, {
      method: 'POST',
      headers: { ...tokens.student, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item._id }),
    });

  const responses = await Promise.all([attempt(), attempt()]);
  const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
  assert.deepEqual(statuses, [201, 400]);

  const orderCount = await Order.countDocuments({ user: student._id, item: item._id });
  assert.equal(orderCount, 1);
  const afterItem = await StoreItem.findById(item._id);
  assert.equal(afterItem.stock, 0);
  const afterUser = await User.findById(student._id);
  assert.equal(afterUser.rewardPoints, 50);
});

test('dashboard total counts every complaint status', async () => {
  await Complaint.create({
    complaintId: 'DASH-PENDING',
    user: env.users.student._id,
    location: 'Block A',
    wasteType: 'Plastic',
    description: 'dash pending',
    block: 'A',
    status: 'pending',
  });
  await Complaint.create({
    complaintId: 'DASH-ASSIGNED',
    user: env.users.student._id,
    location: 'Block A',
    wasteType: 'Plastic',
    description: 'dash assigned',
    block: 'A',
    status: 'assigned',
  });
  await Complaint.create({
    complaintId: 'DASH-REOPENED',
    user: env.users.student._id,
    location: 'Block A',
    wasteType: 'Plastic',
    description: 'dash reopened',
    block: 'A',
    status: 'reopened',
  });
  await Complaint.create({
    complaintId: 'DASH-COMPLETED',
    user: env.users.student._id,
    location: 'Block A',
    wasteType: 'Plastic',
    description: 'dash done',
    block: 'A',
    status: 'completed',
  });
  await Complaint.create({
    complaintId: 'DASH-REJECTED',
    user: env.users.student._id,
    location: 'Block A',
    wasteType: 'Plastic',
    description: 'dash rejected',
    block: 'A',
    status: 'rejected',
  });

  const res = await fetch(`${baseUrl}/api/stats/dashboard`, { headers: tokens.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  const total = await Complaint.countDocuments({});
  assert.equal(body.total, total);
  assert.equal(body.assigned, await Complaint.countDocuments({ status: 'assigned' }));
  assert.equal(body.reopened, await Complaint.countDocuments({ status: 'reopened' }));
  assert.equal(body.done, await Complaint.countDocuments({ status: 'completed' }) + await Complaint.countDocuments({ status: 'citizen_confirmed' }));
  assert.equal(body.rejected, await Complaint.countDocuments({ status: 'rejected' }));
});