const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, vehicleController.getVehicles);
router.get('/:id', protect, vehicleController.getVehicleById);
router.get('/:id/history', protect, vehicleController.getLocationHistory);
router.post('/', protect, authorize('admin'), vehicleController.createVehicle);
router.put('/:id', protect, authorize('admin'), vehicleController.updateVehicle);
router.delete('/:id', protect, authorize('admin'), vehicleController.deleteVehicle);
router.put('/:id/location', protect, authorize('collector', 'admin'), vehicleController.updateLocation);

module.exports = router;