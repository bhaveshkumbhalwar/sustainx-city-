const User = require('../models/User');
const Reward = require('../models/Reward');
const RewardTransaction = require('../models/RewardTransaction');
const ApiError = require('../utils/ApiError');
const { createNotification } = require('./notificationService');

// Server-verified reward credit. Points may only be granted by trusted
// internal flows (signup bonus, verified resolution, admin action).
const credit = async ({ userId, activity, points, reason, refType, refId, actorId = null }) => {
  if (!userId) throw new ApiError(400, 'Missing user');
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
    throw new ApiError(400, 'Points must be a positive number');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const balanceBefore = user.rewardPoints || 0;
  const updated = await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: points } }, { returnDocument: 'after' });
  const balanceAfter = updated.rewardPoints;

  const reward = await Reward.create({ user: userId, activity, points, date: new Date() });
  await RewardTransaction.create({
    user: userId,
    delta: points,
    type: 'credit',
    balanceBefore,
    balanceAfter,
    reason: reason || null,
    refType: refType || null,
    refId: refId ? String(refId) : null,
    createdBy: actorId,
  });

  await createNotification(userId, `Reward Credited: +${points} pts for "${activity}"`, 'reward');

  return { reward, updatedPoints: balanceAfter };
};

const debit = async ({ userId, points, reason, refType, refId }) => {
  if (!userId) throw new ApiError(400, 'Missing user');
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
    throw new ApiError(400, 'Points must be a positive number');
  }

  // Atomic check-and-decrement prevents concurrent overspend (double redeem).
  const updated = await User.findOneAndUpdate(
    { _id: userId, rewardPoints: { $gte: points } },
    { $inc: { rewardPoints: -points } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    const user = await User.findById(userId);
    const balance = user ? user.rewardPoints || 0 : 0;
    throw new ApiError(400, `Insufficient points. Need ${points}, you have ${balance}.`);
  }

  const balanceBefore = (updated.rewardPoints || 0) + points;

  await RewardTransaction.create({
    user: userId,
    delta: -points,
    type: 'debit',
    balanceBefore,
    balanceAfter: updated.rewardPoints,
    reason: reason || null,
    refType: refType || null,
    refId: refId ? String(refId) : null,
  });

  return { balanceAfter: updated.rewardPoints };
};

module.exports = { credit, debit };