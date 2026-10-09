const mongoose = require('mongoose');

const wardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
    // Optional legacy alias so existing block-based data (A-E) maps onto wards.
    legacyBlock: { type: String, uppercase: true, trim: true, default: null },
    center: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

wardSchema.index({ city: 1, code: 1 }, { unique: true });
wardSchema.index({ center: '2dsphere' });

module.exports = mongoose.model('Ward', wardSchema);