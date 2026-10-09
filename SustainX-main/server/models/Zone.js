const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

zoneSchema.index({ city: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Zone', zoneSchema);