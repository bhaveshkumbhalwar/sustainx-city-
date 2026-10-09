const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
    ward: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward', default: null },
    center: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

areaSchema.index({ ward: 1, code: 1 }, { unique: true });
areaSchema.index({ center: '2dsphere' });

module.exports = mongoose.model('Area', areaSchema);