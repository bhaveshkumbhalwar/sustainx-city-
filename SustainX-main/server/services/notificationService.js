const Notification = require('../models/Notification');

const createNotification = async (userId, message, type = 'info') => {
  try {
    if (!userId) return null;
    return Notification.create({ user: userId, message, type });
  } catch (err) {
    console.error('[NOTIFICATION ERROR]:', err.message);
    return null;
  }
};

const notifyMany = async (userIds, message, type = 'info') => {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) return 0;
  try {
    const docs = await Notification.insertMany(
      ids.map((user) => ({ user, message, type }))
    );
    return docs.length;
  } catch (err) {
    console.error('[NOTIFICATION ERROR]:', err.message);
    return 0;
  }
};

module.exports = { createNotification, notifyMany };