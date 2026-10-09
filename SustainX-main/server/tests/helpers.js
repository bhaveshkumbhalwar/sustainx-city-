process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/sustainx_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.IOT_ALLOW_PUBLIC_INGEST = 'false';
process.env.UPLOAD_DRIVER = 'local';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Device = require('../models/Device');
const SmartBin = require('../models/SmartBin');
const iotService = require('../services/iotService');

let server;
let env;

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();

  const student = await User.create({
    password: '112233',
    role: 'student',
    name: 'Test Student',
    email: 'tstudent@test.edu',
    block: 'A',
    rewardPoints: 100,
  });
  const collector = await User.create({
    password: '112233',
    role: 'collector',
    name: 'Test Collector',
    email: 'tcollector@test.edu',
    block: 'A',
  });
  const admin = await User.create({
    password: '112233',
    role: 'admin',
    name: 'Test Admin',
    email: 'tadmin@test.edu',
    block: 'A',
  });

  const bin = await SmartBin.create({ binId: 'TEST-BIN-001', name: 'Test Bin', block: 'A' });
  await Device.create({
    deviceId: 'DEV-TEST',
    name: 'Test device',
    binId: 'TEST-BIN-001',
    block: 'A',
    apiKeyHash: iotService.hashKey('test-dev-key'),
  });

  env = {
    users: { student, collector, admin },
    bin,
    iot: { deviceId: 'DEV-TEST', key: 'test-dev-key' },
  };

  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    env,
  };
};

const stop = async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  try {
    await mongoose.connection.dropDatabase();
  } catch (err) {}
  await mongoose.connection.close();
};

const login = async (baseUrl, role, email, password = '112233') => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  const json = await res.json();
  return { status: res.status, body: json };
};

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { start, stop, login, authHeaders };