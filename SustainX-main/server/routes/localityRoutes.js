const express = require('express');
const router = express.Router();
const cityController = require('../controllers/cityController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Read side (protected)
router.get('/', protect, cityController.listLocalities);

// Admin writes
router.post('/cities', protect, authorize('admin'), cityController.createCity);
router.put('/cities/:id', protect, authorize('admin'), cityController.updateCity);
router.delete('/cities/:id', protect, authorize('admin'), cityController.deleteCity);

router.post('/zones', protect, authorize('admin'), cityController.createZone);
router.put('/zones/:id', protect, authorize('admin'), cityController.updateZone);
router.delete('/zones/:id', protect, authorize('admin'), cityController.deleteZone);

router.post('/wards', protect, authorize('admin'), cityController.createWard);
router.put('/wards/:id', protect, authorize('admin'), cityController.updateWard);
router.delete('/wards/:id', protect, authorize('admin'), cityController.deleteWard);

router.post('/areas', protect, authorize('admin'), cityController.createArea);
router.delete('/areas/:id', protect, authorize('admin'), cityController.deleteArea);

module.exports = router;