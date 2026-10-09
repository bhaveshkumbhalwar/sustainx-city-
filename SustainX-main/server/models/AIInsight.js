const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    scopeType: { type: String, enum: ['city', 'zone', 'ward', 'bin'], default: 'city' },
    scopeId: { type: String, default: null },
    summary: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    mode: { type: String, default: 'demo-rule-based' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

aiInsightSchema.index({ key: 1, createdAt: -1 });

module.exports = mongoose.model('AIInsight', aiInsightSchema);