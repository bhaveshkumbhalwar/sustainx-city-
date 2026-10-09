const CollectionRoute = require('../models/CollectionRoute');
const CollectionTask = require('../models/CollectionTask');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const SmartBin = require('../models/SmartBin');
const Complaint = require('../models/Complaint');
const ApiError = require('../utils/ApiError');
const { sanitizeQuery, isLat, isLng, nonEmpty } = require('../utils/validate');
const { audit } = require('../services/auditService');
const { buildOptimizedRoute } = require('../services/routeOptimization');

const genRouteId = async () => {
  let routeId;
  let exists = true;
  while (exists) {
    routeId = 'ROUTE-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    exists = !!(await CollectionRoute.findOne({ routeId }));
  }
  return routeId;
};

// @desc    Plan and optimize a new collection route
// @route   POST /api/routes/plan
// @access  Admin
const planRoute = async (req, res) => {
  try {
    const {
      vehicleId,
      collectorId,
      ward,
      blocks,
      maxStops = 20,
      vehicleCapacityKg,
      optimizationMethod = 'nearest-neighbor',
      includeBins = true,
      includeComplaints = true,
      startLocation,
      endLocation,
    } = req.body;

    if (!vehicleId || !collectorId) {
      throw new ApiError(400, 'vehicleId and collectorId are required');
    }

    const route = await buildOptimizedRoute({
      vehicleId,
      collectorId,
      ward,
      blocks,
      maxStops,
      vehicleCapacityKg,
      optimizationMethod,
      includeBins,
      includeComplaints,
      startLocation,
      endLocation,
    });

    if (!route.route) {
      return res.status(400).json({ message: route.message || 'No collection points found' });
    }

    const routeId = await genRouteId();
    const routeDoc = await CollectionRoute.create({
      ...route.route,
      routeId,
    });

    await audit({
      actor: req.user,
      action: 'route.planned',
      targetType: 'CollectionRoute',
      targetId: routeDoc._id,
      meta: { routeId: routeDoc.routeId, stops: route.route.totalStops, wards },
      req,
    });

    res.status(201).json(routeDoc);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Preview a route without saving
// @route   POST /api/routes/preview
// @access  Admin
const previewRoute = async (req, res) => {
  try {
    const {
      vehicleId,
      collectorId,
      ward,
      blocks,
      maxStops = 20,
      vehicleCapacityKg,
      optimizationMethod = 'nearest-neighbor',
      includeBins = true,
      includeComplaints = true,
      startLocation,
      endLocation,
    } = req.body;

    if (!vehicleId || !collectorId) {
      throw new ApiError(400, 'vehicleId and collectorId are required');
    }

    const route = await buildOptimizedRoute({
      vehicleId,
      collectorId,
      ward,
      blocks,
      maxStops,
      vehicleCapacityKg,
      optimizationMethod,
      includeBins,
      includeComplaints,
      startLocation,
      endLocation,
    });

    if (!route.route) {
      return res.status(400).json({ message: route.message || 'No collection points found' });
    }

    // Return preview without saving
    res.json({
      preview: true,
      routeId: 'PREVIEW-' + Date.now().toString(36).toUpperCase(),
      ...route.route,
      stops: route.route.stops.map((s, i) => ({
        sequence: i + 1,
        kind: s.kind,
        binId: s.binId,
        complaintId: s.complaintId,
        location: s.location,
        address: s.address,
        ward: s.ward,
        priority: s.priority,
        priorityScore: s.priorityScore,
        priorityReasons: s.priorityReasons,
        estimatedWasteVolume: s.estimatedWasteVolume,
        estimatedDurationMinutes: s.estimatedDurationMinutes,
        status: 'pending',
        capacityExceeded: s.capacityExceeded,
        capacityWarning: s.capacityWarning,
      })),
      plannedDistanceKm: route.route.plannedDistanceKm,
      plannedDurationMinutes: route.route.plannedDurationMinutes,
      estimatedWasteVolume: route.route.estimatedWasteVolume,
      estimatedCapacityUsage: route.route.estimatedCapacityUsage,
      optimizationScore: route.route.optimizationScore,
      optimizationWarnings: route.route.optimizationWarnings,
      routeGeometry: route.route.routeGeometry,
    });
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Get all routes (with filters)
// @route   GET /api/routes
// @access  Admin/Collector
const getRoutes = async (req, res) => {
  try {
    const filter = {};

    // Role-based filtering
    if (req.user.role === 'collector') {
      filter.collector = req.user._id;
      if (req.query.assigned === 'true') filter.status = { $in: ['assigned', 'accepted', 'in_progress'] };
    }
    if (req.user.role === 'admin') {
      if (req.query.collector) filter.collector = req.query.collector;
      if (req.query.vehicle) filter.vehicle = req.query.vehicle;
    }

    // Status filter
    const status = sanitizeQuery(req.query.status);
    if (status) filter.status = status;

    // Ward/zone filter (admin only)
    if (req.user.role === 'admin') {
      const ward = sanitizeQuery(req.query.ward);
      if (ward) filter.ward = String(ward).toUpperCase();
      const zone = sanitizeQuery(req.query.zone);
      if (zone) filter.zone = String(zone).toUpperCase();
    }

    const routes = await CollectionRoute.find(filter)
      .populate('vehicle', 'plate type capacityKg status driver')
      .populate('collector', 'name email block')
      .sort({ createdAt: -1 })
      .lean();

    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single route by ID
// @route   GET /api/routes/:id
// @access  Protected (role-based)
const getRouteById = async (req, res) => {
  try {
    const route = await CollectionRoute.findById(req.params.id)
      .populate('vehicle', 'plate type capacityKg status driver currentLocation lastLocationUpdate')
      .populate('collector', 'name email block phone')
      .populate('stops.complaintId', 'complaintId status priority wasteType location')
      .populate('stops.binId', 'binId currentLevel status location block')
      .lean();

    if (!route) throw new ApiError(404, 'Route not found');

    // Authorization check
    if (req.user.role === 'collector' && String(route.collector._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view this route' });
    }

    // Enrich stops with computed fields
    const enrichedStops = route.stops.map((stop, idx) => {
      return {
        ...stop,
        sequence: idx + 1,
        isCompleted: ['serviced', 'completed'].includes(stop.status),
        isCurrent: stop.status === 'arrived' || stop.status === 'serviced',
        canStart: ['pending', 'en_route'].includes(stop.status),
        canComplete: ['arrived', 'en_route'].includes(stop.status),
      };
    });

    res.json({ ...route, stops: enrichedStops });
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Assign route to collector
// @route   PUT /api/routes/:id/assign
// @access  Admin
const assignRoute = async (req, res) => {
  try {
    const { collectorId, vehicleId } = req.body;

    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (route.status !== 'planned') {
      throw new ApiError(400, `Cannot assign route in status: ${route.status}`);
    }

    const collector = await User.findById(collectorId);
    if (!collector || collector.role !== 'collector') {
      throw new ApiError(400, 'Invalid collector');
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new ApiError(404, 'Vehicle not found');
    if (vehicle.status === 'maintenance' || vehicle.status === 'off_duty') {
      throw new ApiError(400, 'Vehicle not available');
    }

    route.collector = collectorId;
    route.vehicle = vehicleId;
    route.status = 'assigned';
    route.assignedAt = new Date();
    await route.save();

    await audit({
      actor: req.user,
      action: 'route.assigned',
      targetType: 'CollectionRoute',
      targetId: route._id,
      meta: { collectorId, vehicleId, routeId: route.routeId },
      req,
    });

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Collector accepts assigned route
// @route   POST /api/routes/:id/accept
// @access  Collector
const acceptRoute = async (req, res) => {
  try {
    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (req.user.role === 'collector' && String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    if (route.status !== 'assigned') {
      throw new ApiError(400, `Route must be assigned to accept, current: ${route.status}`);
    }

    route.status = 'accepted';
    route.acceptedAt = new Date();
    await route.save();

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Collector starts route
// @route   POST /api/routes/:id/start
// @access  Collector
const startRoute = async (req, res) => {
  try {
    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    if (!['assigned', 'accepted'].includes(route.status)) {
      throw new ApiError(400, `Route must be assigned or accepted to start, current: ${route.status}`);
    }

    route.status = 'in_progress';
    route.actualStartAt = new Date();
    await route.save();

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Collector completes a stop
// @route   POST /api/routes/:id/stops/:stopIndex/complete
// @access  Collector
const completeStop = async (req, res) => {
  try {
    const { stopIndex } = req.params;
    const { proofImage, notes, actualWasteCollected } = req.body;

    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    if (route.status !== 'in_progress') {
      throw new ApiError(400, 'Route must be in progress');
    }

    const idx = parseInt(stopIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= route.stops.length) {
      throw new ApiError(400, 'Invalid stop index');
    }

    const stop = route.stops[idx];
    if (['serviced', 'skipped', 'failed'].includes(stop.status)) {
      throw new ApiError(400, `Stop already ${stop.status}`);
    }

    const imageUrl = req.file
      ? await require('../middleware/upload').uploadImage(req.file, 'sustainx/route-proofs')
      : null;

    stop.status = 'serviced';
    stop.actualCompletionAt = new Date();
    stop.proofImage = imageUrl || proofImage || stop.proofImage;
    stop.notes = notes || stop.notes;
    stop.actualWasteCollected = actualWasteCollected ? Number(actualWasteCollected) : stop.actualWasteCollected;
    route.completedStops = route.stops.filter((s) => s.status === 'serviced').length;

    // Check if all stops done
    const pendingStops = route.stops.filter((s) => !['serviced', 'skipped', 'failed'].includes(s.status));
    if (pendingStops.length === 0) {
      route.status = 'completed';
      route.completedAt = new Date();
      route.actualWasteCollected = route.stops.reduce((sum, s) => sum + (s.actualWasteCollected || 0), 0);
    }

    await route.save();

    // If this was a bin/complaint stop, update linked entities
    if (stop.kind === 'bin' && stop.binId) {
      await require('../models/SmartBin').findOneAndUpdate(
        { binId: stop.binId },
        { $set: { currentLevel: 0, status: 'ok', alert: false, lastReadingAt: new Date() } }
      );
    }

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Skip a stop
// @route   POST /api/routes/:id/stops/:stopIndex/skip
// @access  Collector
const skipStop = async (req, res) => {
  try {
    const { stopIndex } = req.params;
    const { notes } = req.body;

    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    const idx = parseInt(stopIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= route.stops.length) {
      throw new ApiError(400, 'Invalid stop index');
    }

    const stop = route.stops[idx];
    if (['serviced', 'skipped', 'failed'].includes(stop.status)) {
      throw new ApiError(400, `Stop already ${stop.status}`);
    }

    stop.status = 'skipped';
    stop.notes = notes || stop.notes;
    route.skippedStops = route.stops.filter((s) => s.status === 'skipped').length;
    await route.save();

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Mark stop as failed
// @route   POST /api/routes/:id/stops/:stopIndex/fail
// @access  Collector
const failStop = async (req, res) => {
  try {
    const { stopIndex } = req.params;
    const { notes } = req.body;

    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    const idx = parseInt(stopIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= route.stops.length) {
      throw new ApiError(400, 'Invalid stop index');
    }

    const stop = route.stops[idx];
    if (['serviced', 'skipped', 'failed'].includes(stop.status)) {
      throw new ApiError(400, `Stop already ${stop.status}`);
    }

    stop.status = 'failed';
    stop.notes = notes || stop.notes;
    route.failedStops = route.stops.filter((s) => s.status === 'failed').length;
    await route.save();

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Pause route
// @route   POST /api/routes/:id/pause
// @access  Collector/Admin
const pauseRoute = async (req, res) => {
  try {
    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (req.user.role === 'collector' && String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    if (route.status !== 'in_progress') {
      throw new ApiError(400, 'Only in-progress routes can be paused');
    }

    route.status = 'paused';
    await route.save();
    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Resume route
// @route   POST /api/routes/:id/resume
// @access  Collector
const resumeRoute = async (req, res) => {
  try {
    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    if (route.status !== 'paused') {
      throw new ApiError(400, 'Route is not paused');
    }

    route.status = 'in_progress';
    await route.save();
    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Cancel route
// @route   POST /api/routes/:id/cancel
// @access  Admin
const cancelRoute = async (req, res) => {
  try {
    const { reason } = req.body;
    const route = await CollectionRoute.findById(req.params.id);
    if (!route) throw new ApiError(404, 'Route not found');

    if (['completed', 'cancelled'].includes(route.status)) {
      throw new ApiError(400, 'Route already closed');
    }

    route.status = 'cancelled';
    route.cancellationReason = reason || 'Cancelled by admin';
    await route.save();

    await audit({
      actor: req.user,
      action: 'route.cancelled',
      targetType: 'CollectionRoute',
      targetId: route._id,
      meta: { routeId: route.routeId, reason },
      req,
    });

    res.json(route);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Get route performance analytics
// @route   GET /api/routes/:id/performance
// @access  Admin/Collector
const getRoutePerformance = async (req, res) => {
  try {
    const route = await CollectionRoute.findById(req.params.id).lean();
    if (!route) throw new ApiError(404, 'Route not found');

    if (req.user.role === 'collector' && String(route.collector) !== String(req.user._id)) {
      throw new ApiError(403, 'Not your route');
    }

    const totalStops = route.totalStops || route.stops?.length || 0;
    const completed = route.completedStops || route.stops?.filter((s) => s.status === 'serviced').length || 0;
    const skipped = route.skippedStops || route.stops?.filter((s) => s.status === 'skipped').length || 0;
    const failed = route.failedStops || route.stops?.filter((s) => s.status === 'failed').length || 0;

    const plannedDuration = route.plannedDurationMinutes || 0;
    const actualDuration = route.actualDurationMinutes || 0;
    const plannedDistance = route.plannedDistanceKm || 0;
    const actualDistance = route.actualDistanceKm || 0;

    const completionRate = totalStops > 0 ? Math.round((completed / totalStops) * 100) : 0;
    const onTime = route.slaBreached ? false : (actualDuration <= plannedDuration * 1.2);
    const distanceVariance = plannedDistance > 0 ? ((actualDistance - plannedDistance) / plannedDistance * 100).toFixed(1) : 0;

    res.json({
      routeId: route.routeId,
      totalStops,
      completed,
      skipped,
      failed,
      completionRate: `${completionRate}%`,
      onTime,
      slaBreached: route.slaBreached,
      plannedDuration,
      actualDuration,
      plannedDistance,
      actualDistance,
      distanceVariance: `${distanceVariance}%`,
      estimatedWasteVolume: route.estimatedWasteVolume,
      actualWasteCollected: route.actualWasteCollected,
      capacityUsage: route.estimatedCapacityUsage,
      optimizationScore: route.optimizationScore,
      optimizationMethod: route.optimizationMethod,
    });
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Get route history for a collector/vehicle
// @route   GET /api/routes/history
// @access  Collector/Admin
const getRouteHistory = async (req, res) => {
  try {
    const filter = { status: { $in: ['completed', 'cancelled'] } };

    if (req.user.role === 'collector') {
      filter.collector = req.user._id;
    } else if (req.query.collector) {
      filter.collector = req.query.collector;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [routes, total] = await Promise.all([
      CollectionRoute.find(filter)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('routeId status completedAt plannedDurationMinutes actualDurationMinutes plannedDistanceKm actualDistanceKm totalStops completedStops skippedStops failedStops vehicle collector ward')
        .populate('vehicle', 'plate')
        .populate('collector', 'name')
        .lean(),
      CollectionRoute.countDocuments(filter),
    ]);

    res.json({
      routes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  planRoute,
  previewRoute,
  getRoutes,
  getRouteById,
  assignRoute,
  acceptRoute,
  startRoute,
  completeStop,
  skipStop,
  failStop,
  pauseRoute,
  resumeRoute,
  cancelRoute,
  getRoutePerformance,
  getRouteHistory,
};