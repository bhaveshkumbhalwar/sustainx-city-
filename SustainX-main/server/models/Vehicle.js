const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    plate: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['compactor', 'tipper', 'mini_vehicle', 'tricycle', 'other'], default: 'other' },
    capacityKg: { type: Number, default: 1000 },
    status: { type: String, enum: ['available', 'on_route', 'off_duty', 'maintenance'], default: 'available' },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    block: { type: String, uppercase: true, trim: true, default: null },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    lastLocationUpdate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vehicleSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Vehicle', vehicleSchema);