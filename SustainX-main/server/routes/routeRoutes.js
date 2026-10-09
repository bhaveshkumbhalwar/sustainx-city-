const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(protect);

// Plan a new route (admin only)
router.post('/plan', authorize('admin'), routeController.planRoute);

// Preview route without saving (admin only)
router.post('/preview', authorize('admin'), routeController.previewRoute);

// Get all routes (role-filtered)
router.get('/', routeController.getRoutes);

// Route history
router.get('/history', routeController.getRouteHistory);

// Get single route
router.get('/:id', routeController.getRouteById);

// Route performance analytics
router.get('/:id/performance', routeController.getRoutePerformance);

// Admin-only route management
router.post('/:id/assign', authorize('admin'), routeController.assignRoute);
router.post('/:id/cancel', authorize('admin'), routeController.cancelRoute);

// Collector actions
router.post('/:id/accept', authorize('collector'), routeController.acceptRoute);
router.post('/:id/start', authorize('collector'), routeController.startRoute);
router.post('/:id/pause', authorize('collector'), routeController.pauseRoute);
router.post('/:id/resume', authorize('collector'), routeController.resumeRoute);
router.post('/:id/cancel', authorize('admin'), routeController.cancelRoute);

// Stop-level actions
router.post('/:id/stops/:stopIndex/complete', authorize('collector'), upload.single('proofImage'), routeController.completeStop);
router.post('/:id/stops/:stopIndex/skip', authorize('collector'), routeController.skipStop);
router.post('/:id/stops/:stopIndex/fail', authorize('collector'), routeController.failStop);

router.post('/:id/pause', authorize('collector'), routeController.pauseRoute);
router.post('/:id/resume', authorize('collector'), routeController.resumeRoute);

module.exports = router;