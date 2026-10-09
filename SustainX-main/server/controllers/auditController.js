const AuditLog = require('../models/AuditLog');
const { sanitizeQuery } = require('../utils/validate');

const listAudit = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = {};
  const action = sanitizeQuery(req.query.action);
  const targetType = sanitizeQuery(req.query.targetType);
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.setHeader('X-Total-Count', total);
  res.json(logs);
};

module.exports = { listAudit };