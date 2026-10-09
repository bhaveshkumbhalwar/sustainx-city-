const aiService = require('../services/aiService');

const getCapabilities = async (req, res) => {
  res.json({ capabilities: aiService.CAPABILITIES });
};

const getFillEstimate = async (req, res) => {
  const { binId } = req.params;
  const estimate = await aiService.predictBinFill({ binId });
  if (!estimate) {
    return res.status(404).json({ message: 'Bin not found', status: 'FEATURE_NOT_AVAILABLE' });
  }
  res.json(estimate);
};

const runInsights = async (req, res) => {
  const insights = await aiService.runInsights({
    actorId: req.user._id,
    binId: req.query.binId,
  });
  res.status(201).json({ insights, note: 'Rule-based demo insights. Model-backed predictions are FEATURE_NOT_AVAILABLE.' });
};

const listInsights = async (req, res) => {
  const insights = await aiService.listInsights({ limit: req.query.limit });
  res.json(insights);
};

module.exports = { getCapabilities, getFillEstimate, runInsights, listInsights };