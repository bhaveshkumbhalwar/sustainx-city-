const express = require('express');
const router = express.Router();
const binController = require('../controllers/binController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, binController.getBins);
router.get('/:id', protect, binController.getBinById);
router.post('/', protect, authorize('admin'), binController.createBin);
router.put('/:id', protect, authorize('admin'), binController.updateBin);
router.delete('/:id', protect, authorize('admin'), binController.deleteBin);

module.exports = router;