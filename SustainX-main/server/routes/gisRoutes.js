const express = require('express');
const router = express.Router();
const gisController = require('../controllers/gisController');
const { protect } = require('../middleware/authMiddleware');

router.get('/nearby-bins', protect, gisController.nearbyBins);
router.get('/nearby-complaints', protect, gisController.nearbyComplaints);

module.exports = router;