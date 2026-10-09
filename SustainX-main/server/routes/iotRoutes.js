const express = require('express');
const router = express.Router();
const { processIotData, getIotData, getReadings } = require('../controllers/iotController');
const { protect } = require('../middleware/authMiddleware');

// GET  /api/iot/data  → Latest bin readings (public)
router.get('/data', getIotData);

// GET  /api/iot/readings  → Reading history for charts/diagnostics (protected)
router.get('/readings', protect, getReadings);

// POST /api/iot/data  → Receive sensor data from ESP32 (public)
router.post('/data', processIotData);

module.exports = router;
