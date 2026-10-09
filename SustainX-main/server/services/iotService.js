const crypto = require('crypto');
const Device = require('../models/Device');
const SmartBin = require('../models/SmartBin');
const BinReading = require('../models/BinReading');
const BinData = require('../models/BinData');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { inRange, nonEmpty } = require('../utils/validate');
const { createNotification, notifyMany } = require('./notificationService');
const { slaDeadlineFor } = require('./slaService');

const THRESHOLD = Number(process.env.IOT_ALERT_THRESHOLD || 80);
const COOLDOWN_MS = Number(process.env.IOT_ALERT_COOLDOWN_MS || 15 * 60 * 1000);
// Dev convenience: IOT_ALLOW_PUBLIC_INGEST=true skips device auth.
// Production deployments must leave this off and seed real devices.
const PUBLIC_INGEST = process.env.IOT_ALLOW_PUBLIC_INGEST === 'true';

const hashKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

const timingSafeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

const authenticate = async ({ deviceId, deviceKey }) => {
  if (PUBLIC_INGEST) return null;
  if (!nonEmpty(deviceId) || !nonEmpty(deviceKey)) {
    throw new ApiError(401, 'Device authentication required (X-Device-Id and X-Device-Key headers)');
  }
  const device = await Device.findOne({ deviceId: String(deviceId).trim() });
  if (!device || !device.enabled) throw new ApiError(401, 'Device not found or disabled');
  if (!timingSafeEqual(device.apiKeyHash, hashKey(deviceKey))) {
    throw new ApiError(401, 'Invalid device key');
  }
  return device;
};

const validateReading = ({ binId, level }) => {
  if (!nonEmpty(binId)) throw new ApiError(400, 'Missing required field: binId');
  if (level === undefined || level === null || !inRange(Number(level), 0, 100)) {
    throw new ApiError(400, 'Level must be a number between 0 and 100');
  }
  return Number(level);
};

const openAlertForBin = (binId) =>
  Complaint.findOne({
    binId,
    type: 'iot',
    status: { $in: ['pending', 'assigned', 'in-progress', 'in_progress'] },
  });

const maybeCreateAlert = async ({ binLabel, numericLevel, deviceId, block, ward }) => {
  const existing = await openAlertForBin(binLabel);
  if (existing) return { duplicate: true, complaint: existing };

  const collector = block ? await User.findOne({ role: 'collector', block }).select('_id') : null;
  const admin = await User.findOne({ role: 'admin' }).select('_id');
  if (!admin) throw new ApiError(500, 'No admin user available to own system complaints');

  const complaint = await Complaint.create({
    complaintId: 'IOT-' + Date.now(),
    user: admin._id,
    location: `Smart Dustbin ${binLabel}${ward ? ` (${ward})` : block ? ` (Block ${block})` : ''}`,
    wasteType: 'Mixed Waste',
    description: `AUTOMATED IoT ALERT: Dustbin "${binLabel}" is ${numericLevel}% FULL. Immediate collection required.`,
    block: String(block || 'A').toUpperCase(),
    status: 'pending',
    priority: 'high',
    slaDeadline: slaDeadlineFor('high'),
    type: 'iot',
    binId: binLabel,
    assignedTo: collector ? collector._id : null,
    deviceId: deviceId || null,
    statusHistory: [
      {
        status: 'pending',
        note: 'IoT Alert triggered by smart bin',
        updatedBy: admin._id,
        timestamp: new Date(),
      },
    ],
  });

  if (collector) {
    await createNotification(collector._id, `New IoT Alert! Bin ${binLabel} is full (${numericLevel}%)`, 'iot');
  }
  await notifyMany([admin._id], `IoT Alert: Bin ${binLabel} reached ${numericLevel}%!`, 'iot');

  return { duplicate: false, complaint };
};

const processReading = async ({ device, body }) => {
  const numericLevel = validateReading(body);
  const binLabel = String(body.binId).trim();
  const block = device ? (device.block || body.block) : body.block;
  const ward = device ? (device.ward || body.ward) : body.ward;

  // Heartbeat: every authenticated reading refreshes last-seen, including
  // below-threshold readings. Offline detection depends on this.
  if (device) {
    device.lastSeenAt = new Date();
    await device.save();
  }

  await BinReading.create({
    bin: device && device.bin ? device.bin : null,
    binId: binLabel,
    level: numericLevel,
    block: block ? String(block).toUpperCase() : null,
    temperature: body.temperature != null ? Number(body.temperature) : null,
    signal: body.signal != null ? Number(body.signal) : null,
    source: device ? device.deviceId : 'public',
  });

  await BinData.create({
    binId: binLabel,
    block: String(block || 'A').toUpperCase(),
    level: numericLevel,
  });

  await SmartBin.findOneAndUpdate(
    { binId: binLabel },
    {
      $set: {
        currentLevel: numericLevel,
        lastReadingAt: new Date(),
        status: numericLevel >= THRESHOLD ? 'full' : numericLevel >= 60 ? 'near-full' : 'ok',
        alert: numericLevel >= THRESHOLD,
      },
      $setOnInsert: {
        binId: binLabel,
        name: binLabel,
        block: String(block || 'A').toUpperCase(),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (numericLevel < THRESHOLD) {
    return {
      message: 'Level below threshold, no alert created',
      level: numericLevel,
      binId: binLabel,
    };
  }

  if (device && device.alertCooldownUntil && device.alertCooldownUntil.getTime() > Date.now()) {
    return {
      message: 'Alert already active (cooldown)',
      level: numericLevel,
      binId: binLabel,
      deduplicated: true,
    };
  }

  const result = await maybeCreateAlert({
    binLabel,
    numericLevel,
    deviceId: device ? device.deviceId : null,
    block,
    ward,
  });

  if (device) {
    const cooldownUntil = new Date();
    cooldownUntil.setTime(cooldownUntil.getTime() + COOLDOWN_MS);
    device.alertCooldownUntil = cooldownUntil;
    await device.save();
  }

  if (result.duplicate) {
    return {
      message: 'Alert already active',
      complaintId: result.complaint.complaintId,
      binId: binLabel,
      level: numericLevel,
      deduplicated: true,
    };
  }

  return {
    message: 'Complaint created successfully',
    complaintId: result.complaint.complaintId,
    binId: binLabel,
    level: numericLevel,
    assignedTo: result.complaint.assignedTo,
  };
};

module.exports = {
  THRESHOLD,
  COOLDOWN_MS,
  hashKey,
  authenticate,
  validateReading,
  processReading,
  openAlertForBin,
};