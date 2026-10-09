/**
 * City development seed for the `sustainx_city_dev` database.
 *
 * SAFE BY DESIGN — read the guards before running anything:
 * - OPT-IN ONLY: refuses to run unless ALLOW_CITY_DEV_SEED=true is set.
 * - DATABASE PINNED: aborts unless the connected database is exactly
 *   `sustainx_city_dev` (checked before AND after connecting). Nothing is
 *   written on abort.
 * - NEVER DESTRUCTIVE: no dropDatabase / deleteMany / updateMany / drops.
 *   Demo users are inserted ONLY when their email is absent — an existing
 *   account's password, role and scope are never read-modified-written.
 * - IDEMPOTENT: demo complaints are inserted only when their complaintId is
 *   absent. Re-running changes nothing.
 * - Uses ONLY roles the current schema accepts (student/collector/admin).
 *   The canonical `citizen` role is NOT yet a schema value — the demo
 *   citizen-type account uses role `student` (the UI already labels it
 *   "Citizen"). See SEED_CITY_DEV.md for this documented limitation.
 * - Creates NO IoT device secrets and logs NO passwords, tokens or URIs.
 *
 * Usage (manual, developer-invoked only):
 *   ALLOW_CITY_DEV_SEED=true node seed-city-dev.js [--with-infra]
 * PowerShell:
 *   $env:ALLOW_CITY_DEV_SEED='true'; node seed-city-dev.js
 *
 * --with-infra explicitly delegates city infrastructure (wards, bins,
 * devices, vehicles) to the existing seed-city.js in the same database.
 * NEVER run the obsolete college-era seed.js (it wipes 4 collections).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { execFile } = require('child_process');

const User = require('./models/User');
const Complaint = require('./models/Complaint');

const DEV_DB_NAME = 'sustainx_city_dev';
const OPT_IN_VAR = 'ALLOW_CITY_DEV_SEED';
// Repository-wide development password convention (also used by tests).
// Dev-only credential, never a production secret; never logged by this script.
const DEV_PASSWORD = '112233';

class SeedAbortError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SeedAbortError';
  }
}

const isOptedIn = (env = process.env) => env[OPT_IN_VAR] === 'true';

/** Extract the database name from a MongoDB URI without exposing anything. */
const extractDbName = (uri) => {
  if (!uri || typeof uri !== 'string') return null;
  try {
    const u = new URL(uri);
    const p = (u.pathname || '').replace(/^\/+|\/+$/g, '');
    return p || null;
  } catch {
    // Fallback for multi-host URIs that URL cannot parse: db is the path
    // segment after the authority section.
    const noQuery = uri.split('?')[0];
    const atIdx = noQuery.lastIndexOf('@');
    const slashIdx = noQuery.indexOf('/', atIdx >= 0 ? atIdx : 0);
    if (slashIdx < 0) return null;
    const p = noQuery.slice(slashIdx + 1).replace(/\/+$/g, '');
    return p || null;
  }
};

const checkDbName = (name) => {
  if (name !== DEV_DB_NAME) {
    throw new SeedAbortError(
      `Refusing city dev seed: connected database is '${name || '(unknown)'}', ` +
        `expected '${DEV_DB_NAME}'. No writes performed.`
    );
  }
};

const DEMO_USERS = [
  {
    key: 'citizen',
    name: 'Dev Citizen',
    email: 'dev.citizen@sustainx.example',
    // LIMITATION (documented): schema roles are student/collector/admin, so
    // the demo citizen-type account uses role 'student' (UI label: Citizen).
    role: 'student',
    block: 'A',
    rewardPoints: 120,
  },
  {
    key: 'collector',
    name: 'Dev Collector',
    email: 'dev.collector@sustainx.example',
    role: 'collector',
    block: 'A',
    rewardPoints: 0,
  },
  {
    key: 'admin',
    name: 'Dev Admin',
    email: 'dev.admin@sustainx.example',
    role: 'admin',
    rewardPoints: 0,
  },
];

const DEMO_COMPLAINTS = [
  (users) => ({
    complaintId: 'DEV-CITY-001',
    user: users.citizen._id,
    location: 'Sector 1 - Market Road, Vashi',
    locationData: { lat: 19.018, lng: 73.018, address: 'Sector 1, Vashi' },
    wasteType: 'Mixed Waste',
    description: 'Demo report: overflowing bin near the bus stop (seeded development data).',
    block: 'A',
    assignedTo: null,
    status: 'pending',
    type: 'complaint',
    statusHistory: [
      { status: 'pending', note: 'Demo complaint submitted', updatedBy: users.citizen._id, timestamp: new Date() },
    ],
  }),
  (users) => ({
    complaintId: 'DEV-CITY-002',
    user: users.citizen._id,
    location: 'Sector 1 - Food Court Lane, Vashi',
    wasteType: 'Food Waste',
    description: 'Demo report: food waste overflow at market bins (seeded development data).',
    block: 'A',
    assignedTo: users.collector._id,
    status: 'in-progress',
    type: 'complaint',
    statusHistory: [
      { status: 'pending', note: 'Demo complaint submitted', updatedBy: users.citizen._id, timestamp: new Date() },
      { status: 'in-progress', note: 'Demo collector assigned', updatedBy: users.collector._id, timestamp: new Date() },
    ],
  }),
];

/**
 * Insert a demo user ONLY when the email is absent. Existing accounts are
 * returned untouched — password, role and scope are never overwritten.
 */
const ensureDemoUser = async (spec) => {
  const existing = await User.findOne({ email: spec.email });
  if (existing) return { user: existing, created: false };
  const user = await User.create({
    password: DEV_PASSWORD,
    role: spec.role,
    name: spec.name,
    email: spec.email,
    block: spec.block || null,
    rewardPoints: spec.rewardPoints ?? 0,
  });
  return { user, created: true };
};

const ensureDemoComplaint = async (spec) => {
  const existing = await Complaint.findOne({ complaintId: spec.complaintId });
  if (existing) return { complaint: existing, created: false };
  const complaint = await Complaint.create(spec);
  return { complaint, created: true };
};

/** Write phase only — assumes guards already passed. Safe to re-run. */
const seedDatabase = async () => {
  const summary = { usersCreated: 0, usersSkipped: 0, complaintsCreated: 0, complaintsSkipped: 0 };
  const users = {};
  for (const spec of DEMO_USERS) {
    const { user, created } = await ensureDemoUser(spec);
    users[spec.key] = user;
    if (created) summary.usersCreated += 1;
    else summary.usersSkipped += 1;
  }
  // The demo reports require the ensured citizen + collector ObjectIds.
  if (!users.citizen || !users.collector) {
    throw new SeedAbortError('Demo users unavailable; refusing to create demo complaints.');
  }
  for (const build of DEMO_COMPLAINTS) {
    const { created } = await ensureDemoComplaint(build(users));
    if (created) summary.complaintsCreated += 1;
    else summary.complaintsSkipped += 1;
  }
  return summary;
};

const runInfraSeed = (env) =>
  new Promise((resolve, reject) => {
    execFile('node', ['seed-city.js'], { cwd: __dirname, env }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(`[seed-city] ${stdout}`);
      if (stderr) process.stderr.write(`[seed-city] ${stderr}`);
      if (err) reject(new Error(`City infrastructure seed failed: ${err.message}`));
      else resolve();
    });
  });

/**
 * Guarded entry point. Throws SeedAbortError (exit 2) on any guard refusal
 * before performing writes; never closes a connection it did not open
 * (keeps the shared test-harness connection intact).
 */
const run = async ({ env = process.env, argv = process.argv.slice(2) } = {}) => {
  if (!isOptedIn(env)) {
    throw new SeedAbortError(
      `Refusing city dev seed: ${OPT_IN_VAR} is not 'true'. No writes performed.`
    );
  }
  const uri = env.MONGO_URI;
  if (!uri) {
    throw new SeedAbortError('Refusing city dev seed: MONGO_URI is not set. No writes performed.');
  }
  const parsed = extractDbName(uri);
  if (parsed && parsed !== DEV_DB_NAME) {
    throw new SeedAbortError(
      `Refusing city dev seed: MONGO_URI targets '${parsed}', expected '${DEV_DB_NAME}'. No writes performed.`
    );
  }
  const owned = mongoose.connection.readyState === 0;
  if (owned) await mongoose.connect(uri);
  try {
    checkDbName(mongoose.connection.name);
    if (argv.includes('--with-infra')) await runInfraSeed(env);
    const summary = await seedDatabase();
    return summary;
  } finally {
    if (owned) {
      try {
        await mongoose.connection.close();
      } catch {
        // Connection already gone — nothing to clean up.
      }
    }
  }
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('City dev seed complete:', JSON.stringify(summary));
      process.exit(0);
    })
    .catch((err) => {
      if (err instanceof SeedAbortError) {
        console.error(`Seed refused: ${err.message}`);
        process.exit(2);
      }
      console.error(`Seed failed: ${err.message}`);
      process.exit(1);
    });
}

module.exports = {
  DEV_DB_NAME,
  OPT_IN_VAR,
  DEMO_USERS,
  SeedAbortError,
  isOptedIn,
  extractDbName,
  checkDbName,
  ensureDemoUser,
  ensureDemoComplaint,
  seedDatabase,
  run,
};
