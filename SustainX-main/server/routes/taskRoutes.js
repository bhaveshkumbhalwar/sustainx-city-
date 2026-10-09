const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', protect, taskController.getTasks);
router.get('/:id', protect, taskController.getTaskById);
router.post('/', protect, authorize('admin'), taskController.createTask);
router.post('/:id/assign', protect, authorize('admin'), taskController.assignTask);
router.post('/:id/accept', protect, authorize('collector'), taskController.acceptTask);
router.post('/:id/start', protect, authorize('collector'), taskController.startTask);
router.post('/:id/complete', protect, authorize('collector'), upload.single('proofImage'), taskController.completeTask);
router.post('/:id/cancel', protect, authorize('admin'), taskController.cancelTask);

module.exports = router;