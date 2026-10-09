/**
 * Route Optimization Service
 *
 * Implements:
 * 1. Collection point prioritization engine
 * 2. Nearest-neighbor route construction
 * 3. 2-opt route improvement
 * 4. Vehicle capacity constraints
 * 5. Priority-aware routing
 *
 * All distances use Haversine formula (great-circle distance).
 * For production, integrate with OSRM/OpenRouteService for road distances.
 */

const { SmartBin } = require('../models/SmartBin');
const { Complaint } = require('../models/Complaint');
const { Vehicle } = require('../models/Vehicle');
const { CollectionTask } = require('../models/CollectionTask');
const { CollectionRoute } = require('../models/CollectionRoute');
const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeQuery, isLat, isLng } = require('../utils/validate');

const EARTH_RADIUS_KM = 6371;
const DEFAULT_AVG_SPEED_KMH = 25; // urban waste collection speed
const DEFAULT_SERVICE_TIME_MIN = 8; // minutes per stop
const CAPACITY_BUFFER = 0.9; // 90% capacity buffer

/**
 * Haversine distance between two points [lng, lat]
 * Returns distance in kilometers
 */
function haversineDistance(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Calculate priority score for a collection point
 * Returns { score: number, reasons: string[] }
 */
function calculatePriorityScore(point) {
  let score = 0;
  const reasons = [];

  // Bin fill level urgency (0-40 points)
  if (point.kind === 'bin' && point.currentLevel !== undefined) {
    if (point.currentLevel >= 90) {
      score += 40;
      reasons.push(`Bin fill level ${point.currentLevel}% — critical overflow risk`);
    } else if (point.currentLevel >= 80) {
      score += 30;
      reasons.push(`Bin fill level ${point.currentLevel}% — high overflow risk`);
    } else if (point.currentLevel >= 70) {
      score += 20;
      reasons.push(`Bin fill level ${point.currentLevel}% — approaching capacity`);
    } else if (point.currentLevel >= 50) {
      score += 10;
      reasons.push(`Bin fill level ${point.currentLevel}% — moderate`);
    }
  }

  // Complaint priority urgency (0-35 points)
  if (point.kind === 'complaint') {
    const priorityMap = { critical: 35, high: 25, medium: 15, low: 5 };
    const priorityScore = priorityMap[point.priority] || 5;
    score += priorityScore;
    if (priorityScore >= 25) {
      reasons.push(`${point.priority.toUpperCase()} priority complaint`);
    }
  }

  // SLA urgency (0-25 points)
  if (point.slaRemainingMs !== undefined && point.slaRemainingMs !== null) {
    const hoursLeft = point.slaRemainingMs / (1000 * 60 * 60);
    if (hoursLeft <= 0) {
      score += 25;
      reasons.push('SLA already breached');
    } else if (hoursLeft <= 2) {
      score += 20;
      reasons.push(`SLA due within ${Math.round(hoursLeft)} hours`);
    } else if (hoursLeft <= 6) {
      score += 15;
      reasons.push(`SLA due within ${Math.round(hoursLeft)} hours`);
    } else if (hoursLeft <= 24) {
      score += 10;
      reasons.push(`SLA due within ${Math.round(hoursLeft)} hours`);
    }
  }

  // Overflow/alert status (0-20 points)
  if (point.kind === 'bin' && point.alert) {
    score += 20;
    reasons.push('Bin alert active — overflow detected');
  }

  // Complaint type urgency (0-15 points)
  if (point.kind === 'complaint' && point.type === 'iot') {
    score += 10;
    reasons.push('IoT-generated alert — automated overflow detection');
  }

  // Age of complaint (0-10 points)
  if (point.createdAt) {
    const ageHours = (Date.now() - new Date(point.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > 72) {
      score += 10;
      reasons.push(`Complaint open for ${Math.round(ageHours)} hours`);
    } else if (ageHours > 24) {
      score += 5;
      reasons.push(`Complaint open for ${Math.round(ageHours)} hours`);
    }
  }

  // Ward/zone priority (0-5 points) — can be extended with ward importance config
  if (point.ward && ['A', 'B'].includes(point.ward.toUpperCase())) {
    score += 5;
    reasons.push(`High-density ward ${point.ward}`);
  }

  return { score: Math.round(score), reasons: reasons.slice(0, 5) }; // limit reasons
}

/**
 * Estimate waste volume for a collection point
 */
function estimateWasteVolume(point) {
  if (point.kind === 'bin') {
    const capacity = point.capacityL || 240;
    const level = point.currentLevel || 0;
    return Math.round((capacity * level) / 100);
  }
  if (point.kind === 'complaint') {
    // Estimate based on waste type
    const typeVolumes = {
      'Mixed Waste': 100,
      'Plastic': 50,
      'Food Waste': 80,
      'E-Waste': 30,
      'Hazardous': 20,
      'Construction': 150,
      'Mixed': 80,
    };
    return typeVolumes[point.wasteType] || 80;
  }
  return 50; // default
}

/**
 * Estimate service time in minutes for a stop
 */
function estimateServiceTime(point) {
  const baseTime = 8; // base minutes per stop
  const volume = estimateWasteVolume(point);
  const volumeFactor = Math.min(volume / 100, 2); // up to 2x for large volumes
  return Math.round(baseTime * (1 + volumeFactor));
}

/**
 * Build prioritized collection points from smart bins and complaints
 */
async function buildCollectionPoints(options = {}) {
  const { wards, blocks, includeBins = true, includeComplaints = true, maxPoints = 50 } = options;

  const points = [];

  // Smart bins
  if (includeBins) {
    const binFilter = { isActive: true };
    if (wards && wards.length) binFilter.ward = { $in: wards };
    if (blocks && blocks.length) binFilter.block = { $in: blocks.map((b) => b.toUpperCase()) };

    const bins = await SmartBin.find(binFilter).lean();
    for (const bin of bins) {
      const priority = calculatePriorityScore({
        kind: 'bin',
        currentLevel: bin.currentLevel,
        alert: bin.alert,
        capacityL: bin.capacityL,
        ward: bin.block,
        createdAt: bin.createdAt,
      });
      points.push({
        id: `bin-${bin._id}`,
        kind: 'bin',
        binId: bin.binId,
        name: bin.name || bin.binId,
        location: bin.location?.coordinates ? [bin.location.coordinates[0], bin.location.coordinates[1]] : null,
        address: bin.street || `${bin.block || ''} Ward`,
        ward: bin.block,
        zone: bin.zone,
        currentLevel: bin.currentLevel,
        alert: bin.alert,
        capacityL: bin.capacityL,
        priority: priority.score,
        priorityScore: priority.score,
        priorityReasons: priority.reasons,
        estimatedWasteVolume: estimateWasteVolume({ kind: 'bin', currentLevel: bin.currentLevel, capacityL: bin.capacityL }),
        estimatedDurationMinutes: estimateServiceTime({ kind: 'bin', currentLevel: bin.currentLevel }),
        slaRemainingMs: null,
        type: bin.type,
        createdAt: bin.createdAt,
      });
    }
  }

  // Complaints
  if (includeComplaints) {
    const complaintFilter = { status: { $in: ['pending', 'assigned', 'in-progress', 'in_progress', 'reopened'] } };
    if (wards && wards.length) complaintFilter.ward = { $in: wards };
    if (blocks && blocks.length) complaintFilter.block = { $in: blocks.map((b) => b.toUpperCase()) };

    const complaints = await Complaint.find(complaintFilter)
      .populate('assignedTo', 'name email')
      .lean();

    for (const complaint of complaints) {
      // Skip if no location data
      const coords = complaint.locationPoint?.coordinates || complaint.locationData;
      if (!coords || !coords.lat || !coords.lng) continue;

      const priority = calculatePriorityScore({
        kind: 'complaint',
        priority: complaint.priority,
        type: complaint.type,
        slaRemainingMs: complaint.slaRemainingMs,
        createdAt: complaint.createdAt,
        ward: complaint.block,
      });

      points.push({
        id: `complaint-${complaint._id}`,
        kind: 'complaint',
        complaintId: complaint.complaintId,
        complaintDbId: complaint._id,
        name: complaint.complaintId,
        location: [coords.lng, coords.lat],
        address: complaint.location || complaint.locationData?.address || '',
        ward: complaint.block,
        zone: complaint.zone,
        priority: priority.score,
        priorityScore: priority.score,
        priorityReasons: priority.reasons,
        estimatedWasteVolume: estimateWasteVolume({ kind: 'complaint', wasteType: complaint.wasteType }),
        estimatedDurationMinutes: estimateServiceTime({ kind: 'complaint', wasteType: complaint.wasteType }),
        slaRemainingMs: complaint.slaRemainingMs,
        slaBreached: complaint.slaBreached,
        type: complaint.type,
        wasteType: complaint.wasteType,
        createdAt: complaint.createdAt,
      });
    }
  }

  // Sort by priority score descending, then by proximity to depot (optional)
  points.sort((a, b) => b.priorityScore - a.priorityScore);

  return points.slice(0, maxPoints);
}

/**
 * Nearest-neighbor route construction
 * Returns ordered stops and total distance
 */
function nearestNeighborRoute(stops, startLocation, endLocation = null) {
  if (!stops || stops.length === 0) return { orderedStops: [], totalDistance: 0 };

  const unvisited = [...stops];
  const ordered = [];
  let current = startLocation;
  let totalDistance = 0;

  while (unvisited.length > 0) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i];
      if (!stop.location) continue;
      const dist = haversineDistance(current, stop.location);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx === -1) break; // no valid stops with coordinates

    const next = unvisited.splice(nearestIdx, 1)[0];
    ordered.push({ ...next, sequence: ordered.length + 1, distanceFromPrev: nearestDist });
    totalDistance += nearestDist;
    current = next.location;
  }

  // Add return to depot if specified
  if (endLocation && current) {
    const returnDist = haversineDistance(current, endLocation);
    totalDistance += returnDist;
    ordered.push({
      sequence: ordered.length + 1,
      kind: 'depot',
      location: endLocation,
      distanceFromPrev: returnDist,
    });
  }

  return { orderedStops: ordered, totalDistance: Math.round(totalDistance * 100) / 100 };
}

/**
 * 2-opt route improvement
 * Iteratively reverses segments to reduce total distance
 */
function twoOptRoute(stops, startLocation, endLocation = null, maxIterations = 1000) {
  if (!stops || stops.length < 4) return stops;

  const route = [...stops];
  let bestDistance = calculateRouteDistance(route, startLocation, endLocation);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        if (j - i === 1) continue; // adjacent, reversing does nothing

        const newRoute = [
          ...route.slice(0, i + 1),
          ...route.slice(i + 1, j + 1).reverse(),
          ...route.slice(j + 1),
        ];

        const newDistance = calculateRouteDistance(newRoute, startLocation, endLocation);
        if (newDistance < bestDistance) {
          route.splice(i + 1, j - i, ...route.slice(i + 1, j + 1).reverse());
          bestDistance = newDistance;
          improved = true;
        }
      }
    }

  return route;
}

/**
 * Calculate total route distance
 */
function calculateRouteDistance(stops, startLocation, endLocation = null) {
  if (!stops || stops.length === 0) return 0;

  let total = 0;
  let current = startLocation;

  for (const stop of stops) {
    if (stop.location) {
      total += haversineDistance(current, stop.location);
      current = stop.location;
    }
  }

  if (endLocation && current) {
    total += haversineDistance(current, endLocation);
  }

  return total;
}

/**
 * Apply vehicle capacity constraints
 */
function applyCapacityConstraints(orderedStops, vehicleCapacityKg, estimatedVolumePerLiter = 0.5) {
  // Assuming 1L waste ≈ 0.5kg (loose waste density)
  const capacityLiters = (vehicleCapacityKg || 1000) / estimatedVolumePerLiter;
  const CAPACITY_BUFFER = 0.9; // 90% utilization max

  const constrainedStops = [];
  let accumulatedVolume = 0;

  for (const stop of orderedStops) {
    const volume = stop.estimatedWasteVolume || 0;
    if (accumulatedVolume + volume > capacityLiters * CAPACITY_BUFFER) {
      // Mark as overflow/capacity exceeded
      stop.capacityExceeded = true;
      stop.capacityWarning = `Would exceed vehicle capacity (${Math.round(capacityLiters * CAPACITY_BUFFER)}L limit)`;
    } else {
      accumulatedVolume += volume;
      stop.capacityExceeded = false;
    }
    constrainedStops.push(stop);
  }

  return constrainedStops;
}

/**
 * Apply priority-aware ordering within capacity constraints
 * Higher priority stops are kept even if capacity is tight
 */
function applyPriorityConstraints(orderedStops, vehicleCapacityKg) {
  // Sort by priority score within capacity segments
  // For now, just apply capacity constraints
  // Future: implement priority-aware bin packing
  return applyCapacityConstraints(orderedStops, vehicleCapacityKg);
}

/**
 * Build route geometry (LineString) from ordered stops
 */
function buildRouteGeometry(orderedStops, startLocation, endLocation = null) {
  const coordinates = [];

  if (startLocation) coordinates.push(startLocation);
  for (const stop of orderedStops) {
    if (stop.location) coordinates.push(stop.location);
  }
  if (endLocation) coordinates.push(endLocation);

  return {
    type: 'LineString',
    coordinates,
  };
}

/**
 * Estimate route duration
 */
function estimateRouteDuration(orderedStops, totalDistanceKm, avgSpeedKmh = DEFAULT_AVG_SPEED_KMH) {
  const drivingTimeHours = totalDistanceKm / avgSpeedKmh;
  const serviceTimeMinutes = orderedStops.reduce(
    (sum, stop) => sum + (stop.estimatedDurationMinutes || DEFAULT_SERVICE_TIME_MIN),
    0
  );
  const totalMinutes = Math.round(drivingTimeHours * 60 + serviceTimeMinutes);
  return Math.max(totalMinutes, orderedStops.length * DEFAULT_SERVICE_TIME_MIN);
}

/**
 * Build complete optimized route
 */
async function buildOptimizedRoute(options) {
  const {
    startLocation, // [lng, lat]
    endLocation,
    vehicleId,
    collectorId,
    wards,
    blocks,
    maxStops = 20,
    vehicleCapacityKg = 1000,
    optimizationMethod = 'nearest-neighbor',
    includeBins = true,
    includeComplaints = true,
  } = options;

  // Fetch vehicle
  const vehicle = await Vehicle.findById(vehicleId).lean();
  if (!vehicle) throw new ApiError(404, 'Vehicle not found');
  if (vehicle.status === 'maintenance' || vehicle.status === 'off_duty') {
    throw new ApiError(400, `Vehicle is ${vehicle.status}`);
  }

  // Fetch collector
  const collector = await User.findById(collectorId).lean();
  if (!collector) throw new ApiError(404, 'Collector not found');
  if (collector.role !== 'collector') {
    throw new ApiError(403, 'Assigned user must be a collector');
  }

  // Build collection points
  const points = await buildCollectionPoints({
    wards,
    blocks,
    includeBins,
    includeComplaints,
    maxPoints,
  });

  if (points.length === 0) {
    return {
      route: null,
      message: 'No collection points found for the specified criteria',
      stops: [],
    };
  }

  // Determine start location (vehicle current location or depot)
  const start = startLocation || vehicle.currentLocation?.coordinates || [0, 0];
  const end = endLocation || start;

  // Build initial route
  let { orderedStops, totalDistance } = nearestNeighborRoute(points, start, end);

  // Apply 2-opt improvement if requested
  if (optimizationMethod === '2-opt') {
    orderedStops = twoOptRoute(orderedStops, start, end);
    totalDistance = calculateRouteDistance(orderedStops, start, end);
  }

  // Apply capacity constraints
  const constrainedStops = applyPriorityConstraints(orderedStops, vehicle.capacityKg || vehicleCapacityKg);

  // Build route geometry
  const routeGeometry = buildRouteGeometry(constrainedStops, start, end);

  // Estimate duration
  const estimatedDuration = estimateRouteDuration(constrainedStops, totalDistance);

  // Calculate capacity usage
  const totalVolume = constrainedStops.reduce((sum, s) => sum + (s.estimatedWasteVolume || 0), 0);
  const capacityLiters = (vehicle.capacityKg || 1000) / 0.5; // kg to liters (assuming 0.5 kg/L)
  const capacityUsage = Math.round((totalVolume / capacityLiters) * 100);

  // Identify SLA-risk stops
  const slaRiskStops = constrainedStops.filter(
    (s) => s.slaRemainingMs !== undefined && s.slaRemainingMs !== null && s.slaRemainingMs < 6 * 60 * 60 * 1000
  ).length;

  // Build warnings
  const warnings = [];
  const capacityExceeded = constrainedStops.some((s) => s.capacityExceeded);
  if (capacityExceeded) warnings.push('Route exceeds vehicle capacity — some stops may be skipped');
  if (slaRiskStops.length > 0) warnings.push(`${slaRiskStops} stops at SLA risk`);
  if (constrainedStops.length > 20) warnings.push('Route has many stops — consider splitting');

  // Build route object
  const routeId = 'ROUTE-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

  const route = {
    routeId,
    name: `Route ${wards?.join(',') || 'Custom'}`,
    status: 'planned',
    vehicle: vehicle._id,
    collector: collectorId,
    ward: wards?.[0] || null,
    startLocation: { type: 'Point', coordinates: start, address: 'Depot' },
    endLocation: { type: 'Point', coordinates: end, address: 'Depot' },
    stops: constrainedStops.map((stop, idx) => ({
      sequence: idx + 1,
      ...stop,
      status: 'pending',
    })),
    plannedDistanceKm: Math.round(totalDistance * 100) / 100,
    plannedDurationMinutes: estimateRouteDuration(constrainedStops, totalDistance),
    vehicle: vehicle._id,
    collector: collectorId,
    ward: wards?.[0] || null,
    vehicleCapacityKg: vehicle.capacityKg,
    estimatedCapacityUsage: capacityUsage,
    totalStops: constrainedStops.length,
    estimatedWasteVolume: Math.round(constrainedStops.reduce((sum, s) => sum + (s.estimatedWasteVolume || 0), 0)),
    estimatedDurationMinutes: estimateRouteDuration(constrainedStops, totalDistance),
    slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
    routeGeometry: buildRouteGeometry(constrainedStops, start, end),
    optimizationMethod,
    optimizationScore: Math.round(100 - (warnings.length * 10)),
    optimizationWarnings: warnings,
  };

  return route;
}

module.exports = {
  haversineDistance,
  calculatePriorityScore,
  estimateWasteVolume,
  estimateServiceTime,
  buildCollectionPoints,
  nearestNeighborRoute,
  twoOptRoute,
  calculateRouteDistance,
  applyCapacityConstraints,
  applyPriorityConstraints,
  buildRouteGeometry,
  estimateRouteDuration,
  buildOptimizedRoute,
  PRIORITY_WEIGHTS: {
    binFill: 40,
    complaintPriority: 35,
    slaUrgency: 25,
    overflowAlert: 20,
    complaintType: 15,
    age: 10,
    ward: 5,
  },
};
