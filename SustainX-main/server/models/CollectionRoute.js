const mongoose = require('mongoose');

const routeStopSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true },
    kind: { type: String, enum: ['bin', 'complaint', 'depot'], required: true },
    binId: { type: String, default: null },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: { type: String, default: '' },
    ward: { type: String, uppercase: true, trim: true, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    priorityScore: { type: Number, default: 0 },
    priorityReasons: [{ type: String }],
    estimatedWasteVolume: { type: Number, default: 0 }, // liters
    estimatedDurationMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'en_route', 'arrived', 'serviced', 'skipped', 'failed'],
      default: 'pending',
    },
    actualArrivalAt: { type: Date, default: null },
    actualCompletionAt: { type: Date, default: null },
    proofImage: { type: String, default: null },
    notes: { type: String, default: '' },
    actualWasteCollected: { type: Number, default: 0 }, // liters
  },
  { _id: false }
);

const collectionRouteSchema = new mongoose.Schema(
  {
    routeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'planned',
        'assigned',
        'accepted',
        'in_progress',
        'paused',
        'completed',
        'cancelled',
      ],
      default: 'planned',
    },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    collector: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ward: { type: String, uppercase: true, trim: true, default: null },
    zone: { type: String, uppercase: true, trim: true, default: null },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    startLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String, default: '' },
    },
    endLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String, default: '' },
    },
    stops: [routeStopSchema],
    plannedDistanceKm: { type: Number, default: 0 },
    plannedDurationMinutes: { type: Number, default: 0 },
    actualDistanceKm: { type: Number, default: 0 },
    actualDurationMinutes: { type: Number, default: 0 },
    plannedStartAt: { type: Date, default: null },
    actualStartAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    estimatedWasteVolume: { type: Number, default: 0 }, // liters
    actualWasteCollected: { type: Number, default: 0 }, // liters
    vehicleCapacityKg: { type: Number, default: 0 },
    estimatedCapacityUsage: { type: Number, default: 0 }, // percentage
    slaDeadline: { type: Date, default: null },
    slaBreached: { type: Boolean, default: false },
    totalStops: { type: Number, default: 0 },
    completedStops: { type: Number, default: 0 },
    skippedStops: { type: Number, default: 0 },
    failedStops: { type: Number, default: 0 },
    routeGeometry: {
      type: { type: String, enum: ['LineString'], default: 'LineString' },
      coordinates: { type: [[Number]], default: [] }, // [ [lng, lat], ... ]
    },
    optimizationMethod: { type: String, enum: ['nearest-neighbor', '2-opt', 'manual'], default: 'nearest-neighbor' },
    optimizationScore: { type: Number, default: 0 },
    optimizationWarnings: [{ type: String }],
    notes: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },
  },
  { timestamps: true }
);

collectionRouteSchema.index({ vehicle: 1, status: 1 });
collectionRouteSchema.index({ collector: 1, status: 1 });
collectionRouteSchema.index({ ward: 1, status: 1 });
collectionRouteSchema.index({ status: 1, createdAt: -1 });
collectionRouteSchema.index({ 'stops.location': '2dsphere' });

module.exports = mongoose.model('CollectionRoute', collectionRouteSchema);