const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/capabilities', protect, aiController.getCapabilities);
router.get('/insights', protect, aiController.listInsights);
router.get('/bins/:binId/fill-estimate', protect, aiController.getFillEstimate);
router.post('/insights/run', protect, authorize('admin'), aiController.runInsights);

module.exports = router;