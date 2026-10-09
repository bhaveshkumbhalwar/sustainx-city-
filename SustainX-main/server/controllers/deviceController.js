const Device = require('../models/Device');
const ApiError = require('../utils/ApiError');
const { sanitizeQuery } = require('../utils/validate');
const { audit } = require('../services/auditService');

// @desc    List IoT devices (admin). apiKeyHash is stripped by Device.toJSON.
// @route   GET /api/devices
const listDevices = async (req, res) => {
  const filter = {};
  const enabled = sanitizeQuery(req.query.enabled);
  if (enabled === 'true') filter.enabled = true;
  if (enabled === 'false') filter.enabled = false;
  const block = sanitizeQuery(req.query.block);
  if (block) filter.block = String(block).toUpperCase();

  const devices = await Device.find(filter)
    .populate('bin', 'binId currentLevel status')
    .sort({ deviceId: 1 })
    .lean();
  // Belt-and-braces: never leak credential hashes even if toJSON is bypassed.
  res.json(devices.map(({ apiKeyHash, ...d }) => d));
};

// @desc    Enable/disable a device (admin). Disabling stops ingest auth.
// @route   PUT /api/devices/:id
const setDeviceEnabled = async (req, res) => {
  const device = await Device.findById(req.params.id);
  if (!device) throw new ApiError(404, 'Device not found');
  if (typeof req.body.enabled !== 'boolean') throw new ApiError(400, 'enabled must be true or false');

  device.enabled = req.body.enabled;
  await device.save();
  await audit({
    actor: req.user,
    action: req.body.enabled ? 'device.enabled' : 'device.disabled',
    targetType: 'Device',
    targetId: device._id,
    meta: { deviceId: device.deviceId },
    req,
  });
  const { apiKeyHash, ...safe } = device.toObject();
  res.json(safe);
};

module.exports = { listDevices, setDeviceEnabled };
