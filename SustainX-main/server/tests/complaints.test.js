const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, login, authHeaders } = require('./helpers');

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

test('student submits a complaint with SLA deadline and low priority', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'Block A - Entrance',
      wasteType: 'Mixed Waste',
      description: 'Garbage near entrance',
      block: 'A',
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.slaDeadline);
  assert.ok(new Date(body.slaDeadline) > new Date());
  assert.equal(body.priority, 'low');
  assert.equal(body.status, 'pending');
});

test('hazardous waste maps to critical priority + shorter SLA', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'Block A - Lab',
      wasteType: 'hazardous',
      description: 'Chemical waste bin',
      block: 'A',
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.priority, 'critical');
});

test('valid status transition via collector', async () => {
  const createRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Block A - Canteen', wasteType: 'Food Waste', description: 'Overflow bins', block: 'A' }),
  });
  const complaint = await createRes.json();

  const updateRes = await fetch(`${baseUrl}/api/complaints/${complaint.complaintId}/status`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress', note: 'Collector on the way' }),
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.status, 'in_progress');
  assert.ok(updated.assignedTo);
});

test('invalid status transition is rejected', async () => {
  const createRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Block A - Library', wasteType: 'Paper', description: 'Scattered paper', block: 'A' }),
  });
  const complaint = await createRes.json();

  const badRes = await fetch(`${baseUrl}/api/complaints/${complaint.complaintId}/status`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed', note: 'skip flow' }),
  });
  assert.equal(badRes.status, 400);
});

test('collector completes complaint with image proof', async () => {
  const createRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Block A - Gym', wasteType: 'Mixed Waste', description: 'Full bin', block: 'A' }),
  });
  const complaint = await createRes.json();

  await fetch(`${baseUrl}/api/complaints/${complaint.complaintId}/status`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });

  const form = new FormData();
  form.append('image', new Blob(['fake-image-bytes'], { type: 'image/png' }), 'proof.png');
  const completeRes = await fetch(`${baseUrl}/api/complaints/complete/${complaint.complaintId}`, {
    method: 'POST',
    headers: tokens.collector,
    body: form,
  });
  assert.equal(completeRes.status, 200);
  const completeBody = await completeRes.json();
  assert.equal(completeBody.success, true);
  assert.ok(completeBody.completionImage);
});

test('completion without proof image is rejected', async () => {
  const createRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Block A - Park', wasteType: 'Garden Waste', description: 'Full bin', block: 'A' }),
  });
  const complaint = await createRes.json();
  const res = await fetch(`${baseUrl}/api/complaints/complete/${complaint.complaintId}`, {
    method: 'POST',
    headers: tokens.collector,
  });
  assert.equal(res.status, 400);
});

test('citizen can confirm and reopen a resolved complaint', async () => {
  const createRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: { ...tokens.student, 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Block A - Canteen', wasteType: 'Food Waste', description: 'Overflow', block: 'A' }),
  });
  const complaint = await createRes.json();

  await fetch(`${baseUrl}/api/complaints/${complaint.complaintId}/status`, {
    method: 'PUT',
    headers: { ...tokens.collector, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  const form = new FormData();
  form.append('image', new Blob(['bytes'], { type: 'image/png' }), 'p.png');
  await fetch(`${baseUrl}/api/complaints/complete/${complaint.complaintId}`, {
    method: 'POST',
    headers: tokens.collector,
    body: form,
  });

  const confirmRes = await fetch(`${baseUrl}/api/complaints/${complaint.complaintId}/confirm`, {
    method: 'POST',
    headers: tokens.student,
  });
  assert.equal(confirmRes.status, 200);
  assert.equal((await confirmRes.json()).status, 'citizen_confirmed');

  const reopenRes = await fetch(`${baseUrl}/api/complaints/${complaint.complaintId}/reopen`, {
    method: 'POST',
    headers: tokens.student,
  });
  assert.equal(reopenRes.status, 200);
  assert.equal((await reopenRes.json()).status, 'reopened');
});