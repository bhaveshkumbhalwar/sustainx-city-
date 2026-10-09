const Complaint = require('../models/Complaint');
const SmartBin = require('../models/SmartBin');
const ApiError = require('../utils/ApiError');
const { isLat, isLng, sanitizeQuery } = require('../utils/validate');

// GET /api/gis/nearby-bins?lat=&lng=&radiusKm=
const nearbyBins = async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isLat(lat) || !isLng(lng)) throw new ApiError(400, 'Valid lat and lng are required');
  const radiusM = Math.min((Number(req.query.radiusKm) || 2) * 1000, 50000);

  const bins = await SmartBin.find({
    isActive: true,
    location: {
      $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusM },
    },
  }).limit(50).lean();

  res.json(bins);
};

// GET /api/gis/nearby-complaints?lat=&lng=&radiusKm=&status=
const nearbyComplaints = async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isLat(lat) || !isLng(lng)) throw new ApiError(400, 'Valid lat and lng are required');
  const radiusM = Math.min((Number(req.query.radiusKm) || 2) * 1000, 50000);

  const filter = { locationPoint: { $exists: true, $ne: null } };
  const status = sanitizeQuery(req.query.status);
  if (status) filter.status = status;
  if (req.user.role === 'student') filter.user = req.user._id;
  if (req.user.role === 'collector') filter.block = req.user.block;

  const complaints = await Complaint.find({
    ...filter,
    locationPoint: {
      $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusM },
    },
  })
    .populate('user', 'name email')
    .limit(100);

  res.json(complaints);
};

module.exports = { nearbyBins, nearbyComplaints };