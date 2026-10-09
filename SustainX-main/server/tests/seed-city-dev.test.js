const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login } = require('./helpers');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const {
  DEV_DB_NAME,
  OPT_IN_VAR,
  SeedAbortError,
  isOptedIn,
  extractDbName,
  checkDbName,
  ensureDemoUser,
  seedDatabase,
  run,
} = require('../seed-city-dev');

const DEMO_EMAILS = [
  'dev.citizen@sustainx.example',
  'dev.collector@sustainx.example',
  'dev.admin@sustainx.example',
];

let baseUrl;

before(async () => {
  ({ baseUrl } = await start());
});

after(async () => {
  delete process.env[OPT_IN_VAR];
  await stop();
});

test('refuses to run without the explicit opt-in flag', async () => {
  delete process.env[OPT_IN_VAR];
  await assert.rejects(run(), (err) => err instanceof SeedAbortError);
  assert.equal(await User.countDocuments({ email: { $in: DEMO_EMAILS } }), 0);
});

test('refuses to run against the wrong database name', async () => {
  process.env[OPT_IN_VAR] = 'true';
  try {
    await assert.rejects(run(), (err) => err instanceof SeedAbortError && /sustainx_test/.test(err.message));
    assert.equal(await User.countDocuments({ email: { $in: DEMO_EMAILS } }), 0);
    assert.equal(await Complaint.countDocuments({ complaintId: /^DEV-CITY-/ }), 0);
  } finally {
    delete process.env[OPT_IN_VAR];
  }
});

test('extractDbName reads names without exposing values', () => {
  assert.equal(extractDbName('mongodb://127.0.0.1:27017/sustainx_test'), 'sustainx_test');
  assert.equal(
    extractDbName('mongodb+srv://user@cluster0.example.net/sustainx_city_dev?retryWrites=true'),
    'sustainx_city_dev'
  );
  assert.equal(extractDbName('not a uri at all'), null);
  assert.equal(extractDbName(''), null);
  assert.equal(extractDbName(undefined), null);
});

test('checkDbName accepts only the dev database', () => {
  assert.doesNotThrow(() => checkDbName(DEV_DB_NAME));
  assert.throws(() => checkDbName('sustainx_test'), SeedAbortError);
  assert.throws(() => checkDbName('production'), SeedAbortError);
  assert.equal(isOptedIn({ [OPT_IN_VAR]: 'true' }), true);
  assert.equal(isOptedIn({}), false);
});

test('existing user accounts are never overwritten', async () => {
  const beforeUser = await User.create({
    password: 'oldpass99',
    role: 'collector',
    name: 'Pre-existing Owner',
    email: 'custom.owner@sustainx.example',
    block: 'B',
  });
  const { user, created } = await ensureDemoUser({
    name: 'Would-be Overwrite',
    email: 'custom.owner@sustainx.example',
    role: 'student',
    block: 'A',
  });
  assert.equal(created, false);
  assert.equal(String(user._id), String(beforeUser._id));
  const fresh = await User.findById(beforeUser._id);
  assert.equal(fresh.role, 'collector');
  assert.equal(fresh.block, 'B');
  assert.ok(await fresh.matchPassword('oldpass99'));
  assert.ok(!(await fresh.matchPassword('112233')));
});

test('re-running creates no duplicates (idempotent)', async () => {
  const first = await seedDatabase();
  assert.equal(first.usersCreated, 3);
  assert.equal(first.complaintsCreated, 2);

  const second = await seedDatabase();
  assert.equal(second.usersCreated, 0);
  assert.equal(second.complaintsCreated, 0);
  assert.equal(second.usersSkipped, 3);
  assert.equal(second.complaintsSkipped, 2);

  assert.equal(await User.countDocuments({ email: { $in: DEMO_EMAILS } }), 3);
  assert.equal(await Complaint.countDocuments({ complaintId: /^DEV-CITY-/ }), 2);
});

test('demo references are valid and role checks stay consistent', async () => {
  await seedDatabase();
  for (const complaintId of ['DEV-CITY-001', 'DEV-CITY-002']) {
    const c = await Complaint.findOne({ complaintId });
    assert.ok(c, `${complaintId} exists`);
    assert.ok(await User.findById(c.user), 'reporting user exists');
    assert.ok(c.block, 'block scope present');
    if (c.assignedTo) assert.ok(await User.findById(c.assignedTo), 'assignee exists');
  }
  const ok = await login(baseUrl, 'student', 'dev.citizen@sustainx.example');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'student');
  const mismatch = await login(baseUrl, 'collector', 'dev.citizen@sustainx.example');
  assert.equal(mismatch.status, 401);
});
