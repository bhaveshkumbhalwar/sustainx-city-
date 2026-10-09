const Reward = require('../models/Reward');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { credit } = require('../services/rewardService');

// @desc    Get rewards for a user (admin sees all; others see own)
// @route   GET /api/rewards
const getRewards = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'admin') {
      if (req.query.user) filter.user = req.query.user;
    } else {
      filter.user = req.user._id;
    }
    const rewards = await Reward.find(filter).populate('user', 'name email').sort({ date: -1 });
    res.json(rewards);
  } catch (err) {
    console.error('ERROR:', err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Award points to user (server-verified, admin only)
// @route   POST /api/rewards
const addReward = async (req, res) => {
  try {
    const { user: targetId, studentId, activity, points } = req.body;
    const finalTargetId = targetId || studentId;

    if (!finalTargetId || !activity || !points) {
      return res.status(400).json({ message: 'Please provide user, activity, and points' });
    }

    const result = await credit({
      userId: finalTargetId,
      activity,
      points: Number(points),
      reason: `Admin award via /api/rewards`,
      refType: 'admin_reward',
      actorId: req.user._id,
    });

    res.status(201).json({ reward: result.reward, updatedPoints: result.updatedPoints });
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    console.error('ERROR:', err);
    res.status(statusCode).json({ message: err.message });
  }
};

module.exports = { getRewards, addReward };