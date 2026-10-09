const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/overview', protect, authorize('admin'), analyticsController.getOverview);
router.get('/ward-performance', protect, authorize('admin'), analyticsController.getWardPerformance);
router.get('/sla-compliance', protect, authorize('admin'), analyticsController.getSlaCompliance);
router.get('/resolution-time', protect, authorize('admin'), analyticsController.getResolutionTime);
router.get('/bin-utilization', protect, authorize('admin'), analyticsController.getBinUtilization);
router.get('/hotspots', protect, authorize('admin'), analyticsController.getHotspots);

module.exports = router;