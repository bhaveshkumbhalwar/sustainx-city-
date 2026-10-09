const City = require('../models/City');
const Zone = require('../models/Zone');
const Ward = require('../models/Ward');
const Area = require('../models/Area');
const ApiError = require('../utils/ApiError');
const { nonEmpty, isObjectId } = require('../utils/validate');
const { audit } = require('../services/auditService');

const mustBeObjectId = (id, label) => {
  if (!isObjectId(id)) throw new ApiError(400, `Invalid ${label} id`);
  return id;
};

const errOf = (err) => {
  if (err.isOperational) return err;
  if (err.code === 11000) return new ApiError(400, 'Duplicate code. Use a unique code for this record.');
  if (err.name === 'CastError') return new ApiError(400, 'Invalid id provided');
  return new ApiError(500, err.message);
};

const localitiesOf = async (cityId) => {
  const zones = await Zone.find({ city: cityId }).lean();
  const zoneIds = zones.map((z) => z._id);
  const wards = await Ward.find({ city: cityId }).lean();
  const areas = await (zoneIds.length ? Area.find({ zone: { $in: zoneIds } }).lean() : []);
  return { zones: zones.map((z) => ({ ...z, wards: wards.filter((w) => String(w.zone) === String(z._id)) })), areas };
};

// GET /api/localities (protected) — nested city hierarchy for pickers
const listLocalities = async (req, res) => {
  const cities = await City.find({ isActive: true }).sort({ name: 1 }).lean();
  const results = [];
  for (const city of cities) {
    const { zones, areas } = await localitiesOf(city._id);
    results.push({ ...city, zones, areas });
  }
  res.json(results);
};

// ── Cities ──
const createCity = async (req, res) => {
  const { name, code, state } = req.body;
  if (!nonEmpty(name) || !nonEmpty(code)) throw new ApiError(400, 'City name and code are required');
  const city = await City.create({ name, code: code.toUpperCase(), state: state || '' });
  await audit({ actor: req.user, action: 'city.created', targetType: 'City', targetId: city._id, meta: { name: city.name }, req });
  res.status(201).json(city);
};

const updateCity = async (req, res) => {
  const city = await City.findById(mustBeObjectId(req.params.id, 'city'));
  if (!city) throw new ApiError(404, 'City not found');
  ['name', 'state', 'isActive'].forEach((f) => { if (req.body[f] !== undefined) city[f] = req.body[f]; });
  await city.save();
  res.json(city);
};

const deleteCity = async (req, res) => {
  const city = await City.findByIdAndDelete(mustBeObjectId(req.params.id, 'city'));
  if (!city) throw new ApiError(404, 'City not found');
  await audit({ actor: req.user, action: 'city.deleted', targetType: 'City', targetId: city._id, req });
  res.json({ message: `City ${city.name} deleted` });
};

// ── Zones ──
const createZone = async (req, res) => {
  const { name, code, city } = req.body;
  if (!nonEmpty(name) || !nonEmpty(code) || !isObjectId(city)) throw new ApiError(400, 'Zone name, code and city are required');
  const zone = await Zone.create({ name, code: code.toUpperCase(), city });
  await audit({ actor: req.user, action: 'zone.created', targetType: 'Zone', targetId: zone._id, req });
  res.status(201).json(zone);
};

const updateZone = async (req, res) => {
  const zone = await Zone.findById(mustBeObjectId(req.params.id, 'zone'));
  if (!zone) throw new ApiError(404, 'Zone not found');
  ['name', 'code', 'isActive'].forEach((f) => { if (req.body[f] !== undefined) zone[f] = f === 'code' ? String(req.body[f]).toUpperCase() : req.body[f]; });
  await zone.save();
  res.json(zone);
};

const deleteZone = async (req, res) => {
  const zone = await Zone.findByIdAndDelete(mustBeObjectId(req.params.id, 'zone'));
  if (!zone) throw new ApiError(404, 'Zone not found');
  await audit({ actor: req.user, action: 'zone.deleted', targetType: 'Zone', targetId: zone._id, req });
  res.json({ message: `Zone ${zone.name} deleted` });
};

// ── Wards ──
const createWard = async (req, res) => {
  const { name, code, city, zone, legacyBlock, center } = req.body;
  if (!nonEmpty(name) || !nonEmpty(code) || !isObjectId(city)) throw new ApiError(400, 'Ward name, code and city are required');
  const ward = await Ward.create({
    name,
    code: code.toUpperCase(),
    city,
    zone: zone || null,
    legacyBlock: legacyBlock ? String(legacyBlock).toUpperCase() : null,
    center: center && Array.isArray(center) ? { type: 'Point', coordinates: center } : undefined,
  });
  await audit({ actor: req.user, action: 'ward.created', targetType: 'Ward', targetId: ward._id, req });
  res.status(201).json(ward);
};

const updateWard = async (req, res) => {
  const ward = await Ward.findById(mustBeObjectId(req.params.id, 'ward'));
  if (!ward) throw new ApiError(404, 'Ward not found');
  ['name', 'code', 'zone', 'legacyBlock', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) ward[f] = f === 'code' || f === 'legacyBlock' ? String(req.body[f]).toUpperCase() : req.body[f];
  });
  await ward.save();
  res.json(ward);
};

const deleteWard = async (req, res) => {
  const ward = await Ward.findByIdAndDelete(mustBeObjectId(req.params.id, 'ward'));
  if (!ward) throw new ApiError(404, 'Ward not found');
  await audit({ actor: req.user, action: 'ward.deleted', targetType: 'Ward', targetId: ward._id, req });
  res.json({ message: `Ward ${ward.name} deleted` });
};

// ── Areas ──
const createArea = async (req, res) => {
  const { name, code, city, zone, ward, center } = req.body;
  if (!nonEmpty(name) || !nonEmpty(code) || !isObjectId(city)) throw new ApiError(400, 'Area name, code and city are required');
  const area = await Area.create({
    name,
    code: code.toUpperCase(),
    city,
    zone: zone || null,
    ward: ward || null,
    center: center && Array.isArray(center) ? { type: 'Point', coordinates: center } : undefined,
  });
  await audit({ actor: req.user, action: 'area.created', targetType: 'Area', targetId: area._id, req });
  res.status(201).json(area);
};

const deleteArea = async (req, res) => {
  const area = await Area.findByIdAndDelete(mustBeObjectId(req.params.id, 'area'));
  if (!area) throw new ApiError(404, 'Area not found');
  await audit({ actor: req.user, action: 'area.deleted', targetType: 'Area', targetId: area._id, req });
  res.json({ message: `Area ${area.name} deleted` });
};

module.exports = {
  listLocalities,
  createCity,
  updateCity,
  deleteCity,
  createZone,
  updateZone,
  deleteZone,
  createWard,
  updateWard,
  deleteWard,
  createArea,
  deleteArea,
  errOf,
};