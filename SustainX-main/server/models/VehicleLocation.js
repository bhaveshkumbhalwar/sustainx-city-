const mongoose = require('mongoose');

const vehicleLocationSchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speed: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

vehicleLocationSchema.index({ vehicle: 1, recordedAt: -1 });

module.exports = mongoose.model('VehicleLocation', vehicleLocationSchema);