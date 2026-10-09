const AIInsight = require('../models/AIInsight');
const Complaint = require('../models/Complaint');
const SmartBin = require('../models/SmartBin');
const mlClient = require('./mlServiceClient');

const CAPABILITIES = {
  predict_bin_fill: {
    status: 'FEATURE_NOT_AVAILABLE',
    integrationReady: true,
    modelBacked: false,
    note: 'No ML model deployed. Rule-based fill estimates use live sensor data. ML service returns INSUFFICIENT_DATA.',
  },
  predict_complaint_priority: {
    status: 'FEATURE_NOT_AVAILABLE',
    integrationReady: true,
    modelBacked: false,
    note: 'Rule-based + ML hybrid. ML service returns INSUFFICIENT_DATA (1 labeled sample).',
  },
  classify_waste_image: {
    status: 'FEATURE_NOT_AVAILABLE',
    integrationReady: true,
    modelBacked: false,
    note: 'No ML model deployed. No training images available. ML service returns INSUFFICIENT_DATA.',
  },
  predict_hotspots: {
    status: 'FEATURE_NOT_AVAILABLE',
    integrationReady: true,
    modelBacked: false,
    note: 'Hotspot detection is rule-based on open complaint density. ML service returns INSUFFICIENT_DATA.',
  },
};

const predictHotspots = async () => {
  const rows = await Complaint.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'assigned', 'in-progress', 'in_progress', 'reopened', 'citizen_confirmed'] },
      },
    },
    { $group: { _id: '$block', open: { $sum: 1 } } },
    { $sort: { open: -1 } },
    { $limit: 10 },
  ]);
  return rows.map((r) => ({ block: r._id, openComplaints: r.open, mode: 'demo-rule-based' }));
};

const predictBinFill = async ({ binId }) => {
  // Try ML service first
  try {
    const mlResult = await mlClient.predictBinFill({ binId, readings: [], horizons: [60, 360, 1440] });
    if (mlResult.modelStatus !== 'UNAVAILABLE' && mlResult.modelStatus !== 'INSUFFICIENT_DATA') {
      return {
        binId: mlResult.binId,
        currentLevel: mlResult.currentFill,
        estimatedHoursToFullBoard: mlResult.predictions['120'] ? Math.round((80 - mlResult.predictions['120']) / ((mlResult.predictions['120'] - mlResult.currentFill) / 120)) : null,
        mode: 'ml-prediction',
        mlResult,
      };
    }
  } catch (error) {
    console.warn('ML service unavailable for bin fill prediction, falling back to rule-based:', error.message);
  }

  // Fallback to rule-based
  const bin = await SmartBin.findOne({ binId }).lean();
  if (!bin) return null;
  const hoursToFull = bin.currentLevel >= 80 ? 0 : Math.round((80 - bin.currentLevel) * 12);
  return {
    binId: bin.binId,
    currentLevel: bin.currentLevel,
    estimatedHoursToFullBoard: hoursToFull,
    mode: 'demo-rule-based',
  };
};

const runInsights = async ({ actorId, binId }) => {
  const hotspots = await predictHotspots();
  const nearFull = await SmartBin.find({}).sort({ currentLevel: -1 }).limit(5).lean();
  const pul = binId ? await predictBinFill({ binId }) : null;

  const insights = [
    {
      key: 'hotspot_blocks',
      title: 'Top complaint hotspots',
      scopeType: 'city',
      summary:
        hotspots.map((h) => `Block ${h.block}: ${h.openComplaints} open`).join(' | ') || 'No open hotspots',
      data: hotspots,
      mode: 'demo-rule-based',
    },
    {
      key: 'bin_fill_forecast',
      title: 'Near-full bins',
      scopeType: 'city',
      summary: nearFull.map((b) => `${b.binId}: ${b.currentLevel}%`).join(' | ') || 'No bins',
      data: nearFull.map((b) => ({ binId: b.binId, level: b.currentLevel, block: b.block })),
      mode: 'demo-rule-based',
    },
  ];

  if (pul) {
    insights.push({
      key: 'bin_fill_single',
      title: `Fill forecast: ${binId}`,
      scopeType: 'bin',
      scopeId: binId,
      summary: pul.mode === 'ml-prediction' 
        ? `ML: Estimated ~${pul.mlResult?.predictions?.['120'] || 'N/A'}% in 2h (current ${pul.currentLevel}%)`
        : `Rule-based: Estimated at full fill in ~${pul.estimatedHoursToFullBoard} hours (current ${pul.currentLevel}%)`,
      data: pul,
      mode: pul.mode,
    });
  }

  const docs = await AIInsight.create(insights.map((i) => ({ ...i, generatedBy: actorId })));
  return docs.map((d) => d.toObject());
};

const listInsights = async ({ limit = 20 }) =>
  AIInsight.find({}).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 20, 100));

module.exports = { CAPABILITIES, runInsights, listInsights, predictHotspots, predictBinFill };