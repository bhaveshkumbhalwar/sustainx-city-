const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { createNotification, notifyMany } = require('../services/notificationService');

// @desc    Get user notifications
// @route   GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const rawId = req.user._id || req.user.id;
    let userId;
    try {
      userId = new mongoose.Types.ObjectId(rawId.toString());
    } catch (e) {
      userId = rawId;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const filter = { user: userId };
    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(filter),
    ]);

    if (req.query.page || req.query.limit) {
      res.setHeader('X-Total-Count', total);
    }
    res.json(notifications);
  } catch (err) {
    console.error('[NOTIFICATIONS ERROR]:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const id = (req.user._id || req.user.id).toString();
    const count = await Notification.countDocuments({ user: id, isRead: false });
    res.json({ unread: count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/read/:id
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    if (notification.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    notification.isRead = true;
    await notification.save();
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  notifyMany,
};