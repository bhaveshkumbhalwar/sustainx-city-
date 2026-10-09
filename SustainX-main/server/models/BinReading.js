const mongoose = require('mongoose');

const binReadingSchema = new mongoose.Schema(
  {
    bin: { type: mongoose.Schema.Types.ObjectId, ref: 'SmartBin', default: null },
    binId: { type: String, required: true, index: true },
    block: { type: String, uppercase: true, trim: true, default: null },
    level: { type: Number, required: true, min: 0, max: 100 },
    temperature: { type: Number, default: null },
    signal: { type: Number, default: null },
    source: { type: String, default: 'public' },
    readAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

binReadingSchema.index({ binId: 1, readAt: -1 });

module.exports = mongoose.model('BinReading', binReadingSchema);