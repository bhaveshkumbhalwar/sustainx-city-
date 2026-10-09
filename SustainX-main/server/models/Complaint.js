const mongoose = require('mongoose');

const COMPLAINT_STATUSES = ['pending', 'assigned', 'in-progress', 'in_progress', 'completed', 'citizen_confirmed', 'reopened', 'rejected'];

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      required: true,
    },
    note: { type: String, default: '' },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
    },
    locationData: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, default: '' },
    },
    locationPoint: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    wasteType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    block: {
      type: String,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },
    slaDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    slaBreached: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['complaint', 'scan', 'iot'],
      default: 'complaint',
    },
    binId: {
      type: String,
      default: null,
    },
    deviceId: {
      type: String,
      default: null,
    },
    statusHistory: [statusHistorySchema],
    image: {
      type: String,
      default: null,
    },
    completionImage: {
      type: String,
      default: null,
    },
    rewardGiven: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    citizenConfirmedAt: {
      type: Date,
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

complaintSchema.pre('save', function () {
  const lp = this.locationPoint;
  if (
    lp &&
    !(
      Array.isArray(lp.coordinates) &&
      lp.coordinates.length === 2 &&
      lp.coordinates.every(Number.isFinite)
    )
  ) {
    this.locationPoint = undefined;
  }
});

complaintSchema.index(
  { locationPoint: '2dsphere' },
  { partialFilterExpression: { 'locationPoint.coordinates': { $type: 'array' } } }
);

complaintSchema.virtual('slaRemainingMs').get(function () {
  if (!this.slaDeadline) return null;
  return Math.max(0, new Date(this.slaDeadline).getTime() - Date.now());
});

complaintSchema.virtual('isSlaOverdue').get(function () {
  return !!this.slaDeadline && new Date(this.slaDeadline).getTime() < Date.now();
});

module.exports = mongoose.model('Complaint', complaintSchema);
module.exports.COMPLAINT_STATUSES = COMPLAINT_STATUSES;