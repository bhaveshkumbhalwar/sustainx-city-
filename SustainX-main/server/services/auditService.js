const AuditLog = require('../models/AuditLog');

const audit = async ({ actor, action, targetType, targetId, meta, req }) => {
  try {
    await AuditLog.create({
      actor: actor ? actor._id || actor : null,
      action,
      targetType: targetType || null,
      targetId: targetId ? String(targetId) : null,
      meta: meta || null,
      ip: req ? req.ip || null : null,
      userAgent: req ? req.get('user-agent') || null : null,
    });
  } catch (err) {
    console.error('[AUDIT ERROR]:', err.message);
  }
};

module.exports = { audit };