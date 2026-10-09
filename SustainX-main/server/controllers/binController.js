const SmartBin = require('../models/SmartBin');
const ApiError = require('../utils/ApiError');
const { isLat, isLng, sanitizeQuery } = require('../utils/validate');
const { audit } = require('../services/auditService');

const KM_EARTH_RADIUS = 6371;

// A bin is ONLINE when its last reading arrived within the offline window.
// Threshold is server-configured (IOT_OFFLINE_AFTER_MIN, default 30) so the
// backend stays authoritative; clients must not recompute with own values.
const OFFLINE_AFTER_MS = Number(process.env.IOT_OFFLINE_AFTER_MIN || 30) * 60 * 1000;

// GET /api/bins?ward=&block=&status=&alert=&lat=&lng=&radiusKm=
const getBins = async (req, res) => {
  const filter = { isActive: true };
  const block = sanitizeQuery(req.query.block);
  const ward = sanitizeQuery(req.query.ward);
  const status = sanitizeQuery(req.query.status);
  if (block) filter.block = String(block).toUpperCase();
  if (ward) filter.ward = ward;
  if (status) filter.status = status;
  if (req.query.alert === 'true') filter.alert = true;

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  let query = SmartBin.find(filter);
  if (isLat(lat) && isLng(lng)) {
    const radius = Math.max(Number(req.query.radiusKm) || 2, 0.1);
    query = SmartBin.find({
      ...filter,
      location: {
        $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radius / KM_EARTH_RADIUS * 1000 },
      },
    });
  }

  const bins = await query.sort({ binId: 1 }).limit(200).lean();
  const now = Date.now();
  const withDistance = bins.map((b) => {
    const out = { ...b };
    if (isLat(lat) && isLng(lng) && b.location && b.location.coordinates && b.location.coordinates.length === 2) {
      out.distanceKm = Number((haversine(lat, lng, b.location.coordinates[1], b.location.coordinates[0])).toFixed(2));
    }
    const lastSeen = b.lastReadingAt ? new Date(b.lastReadingAt).getTime() : null;
    out.lastSeen = b.lastReadingAt || null;
    // Offline is staleness only — never interpret a stale bin as empty.
    out.online = lastSeen !== null && now - lastSeen <= OFFLINE_AFTER_MS;
    return out;
  });
  res.json(withDistance);
};

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = KM_EARTH_RADIUS;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const getBinById = async (req, res) => {
  const bin = await SmartBin.findById(req.params.id).lean();
  if (!bin) throw new ApiError(404, 'Bin not found');
  res.json(bin);
};

const createBin = async (req, res) => {
  const { binId, name, kind, block, city, zone, ward, area, street, lat, lng, capacityL } = req.body;
  if (!binId) throw new ApiError(400, 'binId is required');
  const bin = await SmartBin.create({
    binId: String(binId).toUpperCase(),
    name: name || '',
    kind: kind || 'public',
    city: city || null,
    zone: zone || null,
    ward: ward || null,
    area: area || null,
    block: block ? String(block).toUpperCase() : null,
    street: street || '',
    location: isLat(Number(lat)) && isLng(Number(lng)) ? { type: 'Point', coordinates: [Number(lng), Number(lat)] } : undefined,
    capacityL: capacityL ? Number(capacityL) : 240,
  });
  await audit({ actor: req.user, action: 'bin.created', targetType: 'SmartBin', targetId: bin._id, meta: { binId: bin.binId }, req });
  res.status(201).json(bin);
};

const updateBin = async (req, res) => {
  const bin = await SmartBin.findById(req.params.id);
  if (!bin) throw new ApiError(404, 'Bin not found');
  const allowed = ['name', 'kind', 'block', 'street', 'ward', 'zone', 'area', 'city', 'capacityL', 'currentLevel', 'status', 'alert', 'isActive'];
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) bin[f] = f === 'block' ? String(req.body[f]).toUpperCase() : req.body[f];
  });
  if (req.body.lat !== undefined && req.body.lng !== undefined && isLat(Number(req.body.lat)) && isLng(Number(req.body.lng))) {
    bin.currentLocation = undefined;
    bin.location = { type: 'Point', coordinates: [Number(req.body.lng), Number(req.body.lat)] };
  }
  await bin.save();
  res.json(bin);
};

const deleteBin = async (req, res) => {
  const bin = await SmartBin.findByIdAndDelete(req.params.id);
  if (!bin) throw new ApiError(404, 'Bin not found');
  await audit({ actor: req.user, action: 'bin.deleted', targetType: 'SmartBin', targetId: bin._id, req });
  res.json({ message: `Bin ${bin.binId} deleted` });
};

module.exports = { getBins, getBinById, createBin, updateBin, deleteBin };