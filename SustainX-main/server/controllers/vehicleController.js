const Vehicle = require('../models/Vehicle');
const VehicleLocation = require('../models/VehicleLocation');
const ApiError = require('../utils/ApiError');
const { isLat, isLng, sanitizeQuery } = require('../utils/validate');
const { audit } = require('../services/auditService');

const getVehicles = async (req, res) => {
  const filter = {};
  const status = sanitizeQuery(req.query.status);
  const block = sanitizeQuery(req.query.block);
  if (status) filter.status = status;
  if (block) filter.block = String(block).toUpperCase();
  const vehicles = await Vehicle.find(filter).populate('driver', 'name email').sort({ plate: 1 });
  res.json(vehicles);
};

const getVehicleById = async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id).populate('driver', 'name email');
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  res.json(vehicle);
};

const createVehicle = async (req, res) => {
  const { plate, type, capacityKg, block, driver } = req.body;
  if (!plate) throw new ApiError(400, 'Vehicle plate is required');
  const vehicle = await Vehicle.create({
    plate: String(plate).toUpperCase(),
    type: type || 'other',
    capacityKg: capacityKg ? Number(capacityKg) : 1000,
    block: block ? String(block).toUpperCase() : null,
    driver: driver || null,
  });
  await audit({ actor: req.user, action: 'vehicle.created', targetType: 'Vehicle', targetId: vehicle._id, meta: { plate: vehicle.plate }, req });
  res.status(201).json(vehicle);
};

const updateVehicle = async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  ['plate', 'type', 'capacityKg', 'status', 'driver', 'block', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) vehicle[f] = f === 'plate' || f === 'block' ? String(req.body[f]).toUpperCase() : req.body[f];
  });
  await vehicle.save();
  res.json(vehicle);
};

const deleteVehicle = async (req, res) => {
  const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  await audit({ actor: req.user, action: 'vehicle.deleted', targetType: 'Vehicle', targetId: vehicle._id, meta: { plate: vehicle.plate }, req });
  res.json({ message: `Vehicle ${vehicle.plate} deleted` });
};

// PUT /api/vehicles/:id/location — GPS ping from a device/collector
const updateLocation = async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');

  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!isLat(lat) || !isLng(lng)) throw new ApiError(400, 'Valid lat and lng are required');

  vehicle.currentLocation = { type: 'Point', coordinates: [lng, lat] };
  vehicle.lastLocationUpdate = new Date();
  await vehicle.save();

  await VehicleLocation.create({
    vehicle: vehicle._id,
    lat,
    lng,
    speed: req.body.speed != null ? Number(req.body.speed) : null,
  });

  res.json({ vehicle, message: 'Location updated' });
};

const getLocationHistory = async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const history = await VehicleLocation.find({ vehicle: req.params.id }).sort({ recordedAt: -1 }).limit(limit);
  res.json(history);
};

module.exports = { getVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle, updateLocation, getLocationHistory };