const analyticsService = require('../services/analyticsService');

const asyncWrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    res.status(500).json({ message: 'Analytics service error' });
  }
};

const getOverview = asyncWrap(() => analyticsService.overview());
const getWardPerformance = asyncWrap(() => analyticsService.wardPerformance());
const getSlaCompliance = asyncWrap(() => analyticsService.slaCompliance());
const getResolutionTime = asyncWrap(() => analyticsService.resolutionTime());
const getBinUtilization = asyncWrap(() => analyticsService.binUtilization());
const getHotspots = asyncWrap(() => analyticsService.hotspots());

module.exports = { getOverview, getWardPerformance, getSlaCompliance, getResolutionTime, getBinUtilization, getHotspots };