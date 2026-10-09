const express = require('express');
const router = express.Router();
const { listDevices, setDeviceEnabled } = require('../controllers/deviceController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Device registry is admin-only. Registration/provisioning stays a
// server-side operation (seed scripts); there is deliberately no public
// self-registration endpoint.
router.get('/', protect, authorize('admin'), listDevices);
router.put('/:id', protect, authorize('admin'), setDeviceEnabled);

module.exports = router;
