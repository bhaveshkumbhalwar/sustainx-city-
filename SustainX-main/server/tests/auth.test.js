const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');

let baseUrl;
let env;

before(async () => {
  ({ baseUrl, env } = await start());
});

after(async () => {
  await stop();
});

test('login succeeds for student role', async () => {
  const { status, body } = await login(baseUrl, 'student', 'tstudent@test.edu');
  assert.equal(status, 200);
  assert.ok(body.token);
  assert.equal(body.user.role, 'student');
});

test('login succeeds for collector role', async () => {
  const { status, body } = await login(baseUrl, 'collector', 'tcollector@test.edu');
  assert.equal(status, 200);
  assert.equal(body.user.role, 'collector');
});

test('login succeeds for admin role', async () => {
  const { status } = await login(baseUrl, 'admin', 'tadmin@test.edu');
  assert.equal(status, 200);
});

test('login rejects wrong password', async () => {
  const { status } = await login(baseUrl, 'student', 'tstudent@test.edu', 'wrongpass');
  assert.equal(status, 401);
});

test('login rejects unknown email', async () => {
  const { status } = await login(baseUrl, 'student', 'nobody@test.edu');
  assert.equal(status, 401);
});

test('login rejects role mismatch', async () => {
  const { status, body } = await login(baseUrl, 'collector', 'tstudent@test.edu');
  assert.equal(status, 401);
  assert.match(body.message, /not a collector account/i);
});

test('GET /api/auth/me works with token and fails without', async () => {
  const { body } = await login(baseUrl, 'student', 'tstudent@test.edu');
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeaders(body.token) });
  assert.equal(me.status, 200);

  const noToken = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(noToken.status, 401);
});
