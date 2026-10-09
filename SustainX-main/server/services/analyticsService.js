const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const SmartBin = require('../models/SmartBin');

const OPEN_STATUSES = ['pending', 'assigned', 'in-progress', 'in_progress', 'reopened', 'citizen_confirmed'];

const wardPerformance = async () => {
  const rows = await Complaint.aggregate([
    { $group: { _id: '$block', total: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $in: ['$status', ['completed', 'citizen_confirmed']] }, 1, 0] } } } },
    { $sort: { open: -1 } },
  ]);
  return rows.map((r) => ({
    block: r._id,
    total: r.total,
    open: r.open,
    resolved: r.resolved,
    resolvedRate: r.total > 0 ? Number(((r.resolved / r.total) * 100).toFixed(1)) : 0,
  }));
};

const slaCompliance = async () => {
  const rows = await Complaint.aggregate([
    {
      $match: {
        status: { $in: ['completed', 'citizen_confirmed'] },
        slaDeadline: { $exists: true, $ne: null },
      },
    },
    {
      $project: {
        block: 1,
        compliant: {
          $cond: [{ $lte: ['$resolvedAt', '$slaDeadline'] }, 1, 0],
        },
      },
    },
    { $group: { _id: '$block', compliant: { $sum: '$compliant' }, total: { $sum: 1 } } },
  ]);
  return rows.map((r) => ({
    block: r._id,
    compliant: r.compliant,
    total: r.total,
    complianceRate: r.total > 0 ? Number(((r.compliant / r.total) * 100).toFixed(1)) : 0,
  }));
};

const resolutionTime = async () => {
  const rows = await Complaint.aggregate([
    { $match: { status: { $in: ['completed', 'citizen_confirmed'] }, resolvedAt: { $ne: null } } },
    {
      $project: {
        block: 1,
        hours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000],
        },
      },
    },
    { $group: { _id: '$block', avgHours: { $avg: '$hours' }, count: { $sum: 1 } } },
  ]);
  return rows.map((r) => ({ block: r._id, avgResolutionHours: Number(r.avgHours.toFixed(1)), count: r.count }));
};

const binUtilization = async () => {
  const rows = await SmartBin.aggregate([
    { $group: { _id: '$block', bins: { $sum: 1 }, avgLevel: { $avg: '$currentLevel' }, full: { $sum: { $cond: [{ $eq: ['$alert', true] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    block: r._id || 'UNKNOWN',
    bins: r.bins,
    avgLevel: Number(r.avgLevel.toFixed(1)),
    full: r.full,
  }));
};

const hotspots = async () => {
  const rows = await Complaint.aggregate([
    { $match: { status: { $in: OPEN_STATUSES } } },
    { $group: { _id: '$block', open: { $sum: 1 } } },
    { $sort: { open: -1 } },
    { $limit: 10 },
  ]);
  return rows.map((r) => ({ block: r._id, openComplaints: r.open }));
};

const overview = async () => {
  const [statusAgg, roleAgg, binCount, alertBins, orderCount, deliveredCount] = await Promise.all([
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    require('../models/User').aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    SmartBin.countDocuments(),
    SmartBin.countDocuments({ alert: true }),
    Order.countDocuments(),
    Order.countDocuments({ status: 'delivered' }),
  ]);

  const statusMap = {};
  statusAgg.forEach((s) => (statusMap[s._id] = s.count));
  const roleMap = {};
  roleAgg.forEach((r) => (roleMap[r._id] = r.count));

  const openStatuses = ['pending', 'assigned', 'in-progress', 'in_progress', 'reopened', 'citizen_confirmed'];
  const total = Object.values(statusMap).reduce((a, b) => a + Number(b || 0), 0);
  const open = openStatuses.reduce((acc, s) => acc + Number(statusMap[s] || 0), 0);

  return {
    complaints: {
      total,
      open,
      pending: statusMap.pending || 0,
      inProgress: (statusMap['in-progress'] || 0) + (statusMap.in_progress || 0),
      resolved: (statusMap.completed || 0) + (statusMap.citizen_confirmed || 0),
      rejected: statusMap.rejected || 0,
    },
    users: roleMap,
    bins: { total: binCount, alerting: alertBins },
    orders: {
      total: orderCount,
      delivered: deliveredCount,
      completionRate: orderCount > 0 ? Number(((deliveredCount / orderCount) * 100).toFixed(1)) : 0,
    },
  };
};

module.exports = { overview, wardPerformance, slaCompliance, resolutionTime, binUtilization, hotspots };