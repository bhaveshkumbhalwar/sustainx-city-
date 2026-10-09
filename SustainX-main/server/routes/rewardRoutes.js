const express = require('express');
const { getRewards, addReward } = require('../controllers/rewardController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getRewards);
router.post('/', protect, authorize('admin'), addReward);

module.exports = router;