const CollectionTask = require('../models/CollectionTask');
const ApiError = require('../utils/ApiError');
const { nonEmpty, isLat, isLng, oneOf, sanitizeQuery } = require('../utils/validate');
const { audit } = require('../services/auditService');
const { slaDeadlineFor } = require('../services/slaService');
const { uploadImage } = require('../middleware/upload');

const genTaskId = async () => {
  let taskId;
  let exists = true;
  while (exists) {
    taskId = 'TASK-' + Math.floor(1000 + Math.random() * 9000);
    exists = !!(await CollectionTask.findOne({ taskId }));
  }
  return taskId;
};

const getTasks = async (req, res) => {
  const filter = {};
  if (req.user.role === 'collector') {
    filter.worker = req.user._id;
    if (req.query.assigned === 'true') filter.status = { $in: ['assigned', 'accepted', 'in_progress'] };
  }
  const status = sanitizeQuery(req.query.status);
  const block = sanitizeQuery(req.query.block);
  if (status && req.user.role !== 'collector') filter.status = status;
  if (block && req.user.role !== 'collector') filter.block = String(block).toUpperCase();

  const tasks = await CollectionTask.find(filter)
    .populate('worker', 'name email')
    .populate('bin', 'binId currentLevel status')
    .populate('complaint', 'complaintId status')
    .sort({ createdAt: -1 });
  res.json(tasks);
};

const getTaskById = async (req, res) => {
  const task = await CollectionTask.findById(req.params.id)
    .populate('worker', 'name email')
    .populate('bin', 'binId currentLevel status')
    .populate('complaint', 'complaintId status');
  if (!task) throw new ApiError(404, 'Task not found');
  if (req.user.role === 'collector' && task.worker && String(task.worker._id || task.worker) !== String(req.user._id)) {
    throw new ApiError(403, 'Not your task');
  }
  res.json(task);
};

const createTask = async (req, res) => {
  const { type, worker, bin, complaint, block, ward, priority, lat, lng, scheduledDate, notes } = req.body;
  if (!nonEmpty(block) && !bin && !complaint) throw new ApiError(400, 'Provide a block, bin or complaint for the task');

  const task = await CollectionTask.create({
    taskId: await genTaskId(),
    type: oneOf(type, ['scheduled', 'complaint', 'overflow', 'forced']) ? type : 'scheduled',
    worker: worker || null,
    bin: bin || null,
    complaint: complaint || null,
    block: block ? String(block).toUpperCase() : null,
    ward: ward || null,
    priority: oneOf(priority, ['low', 'medium', 'high', 'critical']) ? priority : 'medium',
    location: isLat(Number(lat)) && isLng(Number(lng)) ? { type: 'Point', coordinates: [Number(lng), Number(lat)] } : undefined,
    slaDeadline: slaDeadlineFor(priority || 'medium'),
    scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
    notes: notes || '',
  });

  await audit({ actor: req.user, action: 'task.created', targetType: 'CollectionTask', targetId: task._id, meta: { taskId: task.taskId }, req });
  res.status(201).json(task);
};

const assignTask = async (req, res) => {
  const task = await CollectionTask.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  if (task.status !== 'pending') throw new ApiError(400, 'Task is not pending');
  if (!req.body.worker) throw new ApiError(400, 'Worker is required');
  task.worker = req.body.worker;
  task.status = 'assigned';
  task.assignedAt = new Date();
  await task.save();
  await audit({ actor: req.user, action: 'task.assigned', targetType: 'CollectionTask', targetId: task._id, meta: { worker: task.worker }, req });
  res.json(task);
};

const acceptTask = async (req, res) => {
  const task = await CollectionTask.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  if (req.user.role === 'collector' && task.status !== 'assigned') throw new ApiError(400, 'Task must be assigned before it can be accepted');
  task.status = 'accepted';
  task.acceptedAt = new Date();
  await task.save();
  res.json(task);
};

const startTask = async (req, res) => {
  const task = await CollectionTask.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  if (req.user.role === 'collector' && String(task.worker || '') !== String(req.user._id)) {
    throw new ApiError(403, 'Only the assigned collector can start this task');
  }
  if (!['assigned', 'accepted'].includes(task.status)) throw new ApiError(400, 'Task is not ready to start');
  task.status = 'in_progress';
  task.startedAt = new Date();
  await task.save();
  res.json(task);
};

const completeTask = async (req, res) => {
  const task = await CollectionTask.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  if (req.user.role === 'collector' && String(task.worker || '') !== String(req.user._id)) {
    throw new ApiError(403, 'Only the assigned collector can complete this task');
  }
  if (!['accepted', 'in_progress'].includes(task.status)) throw new ApiError(400, 'Task cannot be completed from this status');

  task.status = 'completed';
  task.completedAt = new Date();
  task.completedBy = req.user._id;
  task.proofImage = req.file ? await uploadImage(req.file, 'sustainx/tasks') : task.proofImage;
  task.notes = req.body.notes || task.notes;
  await task.save();
  res.json(task);
};

const cancelTask = async (req, res) => {
  const task = await CollectionTask.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  if (['completed', 'cancelled'].includes(task.status)) throw new ApiError(400, 'Task is already closed');
  task.status = 'cancelled';
  task.notes = req.body.notes || task.notes;
  await task.save();
  await audit({ actor: req.user, action: 'task.cancelled', targetType: 'CollectionTask', targetId: task._id, req });
  res.json(task);
};

module.exports = { getTasks, getTaskById, createTask, assignTask, acceptTask, startTask, completeTask, cancelTask };