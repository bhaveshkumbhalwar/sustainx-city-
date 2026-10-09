const Complaint = require('../models/Complaint');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { nonEmpty, oneOf, isLat, isLng } = require('../utils/validate');
const { slaDeadlineFor } = require('./slaService');
const { createNotification, notifyMany } = require('./notificationService');
const { credit } = require('./rewardService');

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const WASTE_PRIORITY_MAP = {
  hazardous: 'critical',
  medical: 'critical',
  e_waste: 'high',
  electronic: 'high',
  'e-waste': 'high',
  construction: 'medium',
  demolition: 'medium',
};

const STATUS_FLOW = {
  pending: ['assigned', 'in-progress', 'in_progress', 'rejected'],
  assigned: ['in-progress', 'in_progress'],
  'in-progress': ['completed', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: ['citizen_confirmed', 'reopened'],
  citizen_confirmed: ['reopened'],
  reopened: ['pending', 'in-progress', 'in_progress', 'rejected'],
  rejected: ['pending', 'reopened'],
};

const resolvePriority = (priorityOverride, { type, wasteType, binId }) => {
  if (oneOf(priorityOverride, PRIORITIES)) return priorityOverride;
  if (type === 'iot' || binId) return 'high';
  const key = String(wasteType || '').toLowerCase().trim();
  return WASTE_PRIORITY_MAP[key] || 'low';
};

const pushHistory = (complaint, status, note, updatedBy) => {
  complaint.statusHistory = complaint.statusHistory || [];
  complaint.statusHistory.push({
    status,
    note: note || `Status updated to ${status}`,
    updatedBy,
    timestamp: new Date(),
  });
};

const submit = async ({
  actor,
  location,
  wasteType,
  description,
  block,
  type,
  binId,
  lat,
  lng,
  address,
  priority,
  image,
}) => {
  if (!nonEmpty(location)) throw new ApiError(400, 'Location is required');
  if (!nonEmpty(wasteType)) throw new ApiError(400, 'Waste type is required');
  if (!nonEmpty(description)) throw new ApiError(400, 'Description is required');
  if (!nonEmpty(block)) throw new ApiError(400, 'Block/ward is required');

  const resolvedPriority = resolvePriority(priority, { type, wasteType, binId });
  const locationPoint =
    isLat(lat) && isLng(lng) ? { type: 'Point', coordinates: [lng, lat] } : undefined;

  const complaint = await Complaint.create({
    complaintId: 'COMP-' + Date.now(),
    user: actor.id,
    location,
    locationData: { lat: isLat(lat) ? lat : null, lng: isLng(lng) ? lng : null, address: address || '' },
    locationPoint,
    wasteType,
    description,
    block: String(block).toUpperCase(),
    image: image || null,
    type: oneOf(type, ['complaint', 'scan', 'iot']) ? type : 'complaint',
    binId: binId || null,
    status: 'pending',
    priority: resolvedPriority,
    slaDeadline: slaDeadlineFor(resolvedPriority),
    statusHistory: [{ status: 'pending', note: 'Complaint submitted', updatedBy: actor.id, timestamp: new Date() }],
  });

  await createNotification(actor.id, `Your complaint ${complaint.complaintId} has been registered successfully!`, 'complaint');

  const admins = await User.find({ role: 'admin' }).select('_id');
  await notifyMany(admins.map((a) => a._id), `New complaint ${complaint.complaintId} filed in ${block}`, 'complaint');

  return complaint;
};

const findByIdOrThrow = async (rawId) => {
  const complaint = await Complaint.findOne({ complaintId: String(rawId).toUpperCase() });
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  return complaint;
};

const assertCollectorScope = (complaint, actor) => {
  const isAssigned =
    complaint.assignedTo && String(complaint.assignedTo) === String(actor.id || actor._id);
  if (complaint.block !== actor.block && !isAssigned) {
    throw new ApiError(403, 'Not authorized to access complaints outside your block');
  }
};

const rewardResolution = async (complaint, actor) => {
  if (complaint.status !== 'completed' || !complaint.assignedTo) return;
  try {
    // Atomic guard prevents double credit from concurrent completion requests
    const guarded = await Complaint.findOneAndUpdate(
      { _id: complaint._id, status: 'completed', rewardGiven: { $ne: true } },
      { $set: { rewardGiven: true } },
      { returnDocument: 'after' }
    );
    if (!guarded) return;
    await credit({
      userId: complaint.assignedTo,
      activity: `Resolved ${complaint.complaintId}`,
      points: 15,
      reason: 'Verified complaint resolution',
      refType: 'complaint',
      refId: complaint._id,
      actorId: actor.id,
    });
  } catch (err) {
    console.error('[REWARD] Failed to credit resolution reward:', err.message);
  }
};

const transition = async ({ complaintId, actor, status, note, assignedTo }) => {
  if (!oneOf(status, Object.keys(STATUS_FLOW))) {
    throw new ApiError(400, `Invalid status: ${status}`);
  }
  const complaint = await findByIdOrThrow(complaintId);
  const allowed = STATUS_FLOW[complaint.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Invalid status transition: ${complaint.status} -> ${status}`);
  }

  if (actor.role === 'collector') assertCollectorScope(complaint, actor);

  if (actor.role === 'collector' && !complaint.assignedTo && (status === 'in-progress' || status === 'in_progress')) {
    complaint.assignedTo = actor.id;
  }

  // Admin may assign a complaint to a specific collector
  if (assignedTo !== undefined) {
    if (actor.role !== 'admin') {
      throw new ApiError(403, 'Only admins can assign complaints to specific collectors');
    }
    const collector = await User.findOne({ _id: assignedTo, role: 'collector' }).select('_id role name');
    if (!collector) throw new ApiError(400, 'Assigned collector not found (must be an existing collector role)');
    complaint.assignedTo = collector._id;
    complaint.block = complaint.block || collector.block || null;
  }

  pushHistory(complaint, status, note, actor.id);
  complaint.status = status;
  if (status === 'rejected') complaint.rejectionReason = note || 'Rejected';
  if (status === 'completed') {
    complaint.rejectionReason = null;
    complaint.resolvedAt = new Date();
  }
  if (status === 'citizen_confirmed') complaint.citizenConfirmedAt = new Date();
  if (status === 'reopened') complaint.reopenedAt = new Date();
  if (status === 'pending') complaint.reopenedAt = null;

  await complaint.save();
  await rewardResolution(complaint, actor);
  await createNotification(complaint.user, `Complaint ${complaint.complaintId} status updated to: ${status}`, 'complaint');
  return complaint;
};

const complete = async ({ complaintId, actor, image }) => {
  if (!image) throw new ApiError(400, 'Proof image is required');
  const complaint = await findByIdOrThrow(complaintId);

  // Must be in-progress to complete (matches STATUS_FLOW: in-progress -> completed)
  if (!['in-progress', 'in_progress'].includes(complaint.status)) {
    throw new ApiError(400, `Invalid status transition: ${complaint.status} -> completed (move to in-progress first)`);
  }
  if (actor.role === 'collector') assertCollectorScope(complaint, actor);

  complaint.status = 'completed';
  complaint.completionImage = image;
  complaint.resolvedAt = new Date();
  complaint.rejectionReason = null;
  pushHistory(complaint, 'completed', 'Completed with image proof', actor.id);
  await complaint.save();
  await rewardResolution(complaint, actor);
  await createNotification(complaint.user, `Your complaint ${complaint.complaintId} has been completed!`, 'complaint');
  return complaint;
};

const citizenConfirm = async ({ complaintId, actor }) => {
  const complaint = await findByIdOrThrow(complaintId);
  if (String(complaint.user) !== String(actor.id) && actor.role !== 'admin') {
    throw new ApiError(403, 'Only the reporting user can confirm resolution');
  }
  return transition({ complaintId, actor, status: 'citizen_confirmed', note: 'Citizen confirmed the resolution' });
};

const reopen = async ({ complaintId, actor }) => {
  const complaint = await findByIdOrThrow(complaintId);
  if (
    String(complaint.user) !== String(actor.id) &&
    actor.role !== 'admin' &&
    complaint.status !== 'rejected' &&
    complaint.status !== 'completed' &&
    complaint.status !== 'citizen_confirmed'
  ) {
    throw new ApiError(403, 'Only the reporting user or an admin can reopen this complaint');
  }
  return transition({ complaintId, actor, status: 'reopened', note: 'Complaint reopened by user' });
};

module.exports = {
  PRIORITIES,
  STATUS_FLOW,
  resolvePriority,
  submit,
  findByIdOrThrow,
  transition,
  complete,
  citizenConfirm,
  reopen,
};