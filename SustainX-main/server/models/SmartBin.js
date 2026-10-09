const mongoose = require('mongoose');

const smartBinSchema = new mongoose.Schema(
  {
    binId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true, default: '' },
    kind: { type: String, enum: ['public', 'residential', 'hospital', 'market', 'garden', 'other'], default: 'public' },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
    ward: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward', default: null },
    area: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', default: null },
    block: { type: String, uppercase: true, trim: true, default: null },
    street: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    capacityL: { type: Number, default: 240 },
    currentLevel: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ['ok', 'near-full', 'full'], default: 'ok' },
    lastReadingAt: { type: Date, default: null },
    alert: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

smartBinSchema.index({ location: '2dsphere' });
smartBinSchema.index({ block: 1 });

module.exports = mongoose.model('SmartBin', smartBinSchema);