require('dotenv').config();
const mongoose = require('mongoose');
const City = require('./models/City');
const Zone = require('./models/Zone');
const Ward = require('./models/Ward');
const Area = require('./models/Area');
const SmartBin = require('./models/SmartBin');
const Device = require('./models/Device');
const Vehicle = require('./models/Vehicle');
const CollectionTask = require('./models/CollectionTask');
const crypto = require('crypto');

const hashKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

const seedCity = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for city seeding');

  // ── City / Zones / Wards / Areas ──
  const city = await City.findOneAndUpdate(
    { code: 'NMMC' },
    { name: 'Navi Mumbai Municipal Corporation', state: 'Maharashtra', isActive: true },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('City:', city.code);

  const zones = [];
  for (const [code, name] of [['Z1', 'North Zone'], ['Z2', 'South Zone']]) {
    zones.push(await Zone.findOneAndUpdate({ city: city._id, code }, { name, isActive: true }, { upsert: true, returnDocument: 'after' }));
  }

  // legacyBlock maps the existing A-E block data onto wards
  const wardSpecs = [
    ['W1', 'Sector 1', zones[0]._id, 'A'],
    ['W2', 'Sector 2', zones[0]._id, 'B'],
    ['W3', 'Sector 3', zones[0]._id, 'C'],
    ['W4', 'Sector 4', zones[1]._id, 'D'],
    ['W5', 'Sector 5', zones[1]._id, 'E'],
  ];
  const baseLat = 19.0167;
  const baseLng = 73.0158;
  const wards = [];
  for (let i = 0; i < wardSpecs.length; i++) {
    const [code, name, zone, legacyBlock] = wardSpecs[i];
    const idx = i + 1;
    const ward = await Ward.findOneAndUpdate(
      { city: city._id, code },
      {
        name,
        zone,
        legacyBlock,
        isActive: true,
        center: { type: 'Point', coordinates: [baseLng + idx * 0.002, baseLat + idx * 0.001] },
      },
      { upsert: true, returnDocument: 'after' }
    );
    wards.push(ward);

    for (let a = 1; a <= 2; a++) {
      await Area.findOneAndUpdate(
        { ward: ward._id, code: `${code}-A${a}` },
        {
          name: `${name} Area ${a}`,
          city: city._id,
          zone,
          ward: ward._id,
          isActive: true,
          center: { type: 'Point', coordinates: [baseLng + idx * 0.002 + a * 0.0005, baseLat + idx * 0.001] },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
  }
  console.log('Zones:', zones.length, '| Wards:', wards.length);

  // ── Smart Bins + Devices ──
  const credentials = [];
  for (let b = 1; b <= 10; b++) {
    const ward = wards[(b - 1) % wards.length];
    const binId = `NMMC-BIN-${String(b).padStart(3, '0')}`;
    const deviceId = `DEV-${String(b).padStart(3, '0')}`;
    const devKey = `sx-dev-key-${String(b).padStart(3, '0')}`;

    const bin = await SmartBin.findOneAndUpdate(
      { binId },
      {
        name: binId,
        kind: b % 3 === 0 ? 'market' : 'public',
        city: city._id,
        zone: ward.zone,
        ward: ward._id,
        block: ward.legacyBlock || null,
        capacityL: 240,
        location: { type: 'Point', coordinates: [baseLng + b * 0.001, baseLat + b * 0.0008] },
        isActive: true,
      },
      { upsert: true, returnDocument: 'after' }
    );

    await Device.findOneAndUpdate(
      { deviceId },
      {
        name: `Dustbin sensor ${deviceId}`,
        bin: bin._id,
        binId,
        block: ward.legacyBlock || null,
        ward: ward.code,
        apiKeyHash: hashKey(devKey),
        enabled: true,
      },
      { upsert: true, returnDocument: 'after' }
    );

    credentials.push({ deviceId, apiKey: devKey, binId, block: ward.legacyBlock || null });
  }
  console.log('Smart bins + devices seeded:', credentials.length);

  // ── Vehicles ──
  const vehiclesSeed = [
    ['MH-43-BK-0001', 'compactor', 5000, 'A'],
    ['MH-43-BK-0002', 'tipper', 3500, 'B'],
    ['MH-43-BK-0003', 'mini_vehicle', 1200, 'C'],
  ];
  for (const [plate, type, capacityKg, block] of vehiclesSeed) {
    await Vehicle.findOneAndUpdate(
      { plate },
      { type, capacityKg, block, status: 'available', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
  }
  console.log('Vehicles seeded:', vehiclesSeed.length);

  // ── Sample scheduled collection tasks ──
  const taskNum = await CollectionTask.countDocuments();
  if (taskNum === 0) {
    for (let t = 1; t <= 2; t++) {
      const ward = wards[(t - 1) % wards.length];
      await CollectionTask.create({
        taskId: `TASK-${1000 + t}`,
        type: 'scheduled',
        block: ward.legacyBlock || null,
        ward: ward.code,
        priority: 'low',
        status: 'pending',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location: { type: 'Point', coordinates: [baseLng + t * 0.001, baseLat + t * 0.001] },
        notes: 'Routine scheduled collection (seeded demo data)',
      });
    }
    console.log('Sample collection tasks seeded');
  } else {
    console.log('Collection tasks already present, skipping');
  }

  console.log('\nDemo IoT device credentials for esp32_iot_client.ino:');
  console.log('──────────────────────────────────────────────────────');
  credentials.forEach((c) =>
    console.log(`  deviceId: ${c.deviceId}  key: ${c.apiKey}  bin: ${c.binId}  block: ${c.block}`)
  );
  console.log('──────────────────────────────────────────────────────');
  console.log('City-scale seed complete.');

  await mongoose.connection.close();
  process.exit(0);
};

seedCity().catch(async (err) => {
  console.error('City seed error:', err.message);
  try {
    await mongoose.connection.close();
  } catch (e) {}
  process.exit(1);
});