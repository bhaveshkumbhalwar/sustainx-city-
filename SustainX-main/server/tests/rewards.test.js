const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');
const RewardTransaction = require('../models/RewardTransaction');
const Reward = require('../models/Reward');
const StoreItem = require('../models/StoreItem');
const Order = require('../models/Order');

let baseUrl;
let env;
let tokens;

before(async () => {
  ({ baseUrl, env } = await start());
  const admin = await login(baseUrl, 'admin', 'tadmin@test.edu');
  const student = await login(baseUrl, 'student', 'tstudent@test.edu');
  tokens = { admin: authHeaders(admin.body.token), student: authHeaders(student.body.token) };
});

after(async () => {
  await stop();
});

test('reward credit is recorded with an audit transaction', async () => {
  const res = await fetch(`${baseUrl}/api/rewards`, {
    method: 'POST',
    headers: { ...tokens.admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: env.users.student._id, activity: 'Verified event', points: 30 }),
  });
  assert.equal(res.status, 201);

  const tx = await RewardTransaction.findOne({ user: env.users.student._id, type: 'credit' });
  assert.ok(tx);
  assert.equal(tx.delta, 30);
  assert.equal(tx.balanceAfter, 130);

  const reward = await Reward.findOne({ user: env.users.student._id });
  assert.ok(reward);
  assert.equal(reward.points, 30);
});

test('redeeming a store item debits points and logs a transaction', async () => {
  const item = await StoreItem.create({
    name: 'Test Mug',
    description: 'A mug',
    image: 'https://example.com/mug.png',
    pointsRequired: 30,
    stock: 10,
  });

  const res = await fetch(`${baseUrl}/api/store/redeem`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: item._id }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.remainingPoints, 100);

  const tx = await RewardTransaction.findOne({ user: env.users.student._id, type: 'debit' });
  assert.ok(tx);
  assert.equal(tx.delta, -30);
  assert.equal(tx.balanceAfter, 100);

  const order = await Order.findOne({ user: env.users.student._id });
  assert.ok(order);
  assert.equal(order.itemName, 'Test Mug');
  assert.ok(order.pickupCode);
});

test('redeeming without enough points is rejected and not logged', async () => {
  const item = await StoreItem.create({
    name: 'Expensive Item',
    description: 'Too costly',
    image: 'https://example.com/x.png',
    pointsRequired: 500,
    stock: 5,
  });
  const res = await fetch(`${baseUrl}/api/store/redeem`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: item._id }),
  });
  assert.equal(res.status, 400);
  const tx = await RewardTransaction.find({ user: env.users.student._id, type: 'debit' }).countDocuments();
  assert.equal(tx, 1);
});