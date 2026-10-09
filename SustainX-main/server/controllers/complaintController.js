const Complaint = require('../models/Complaint');
const { uploadImage } = require('../middleware/upload');
const complaintService = require('../services/complaintService');
const { escalateIfBreached, remainingMsFor } = require('../services/slaService');
const ApiError = require('../utils/ApiError');
const { sanitizeQuery } = require('../utils/validate');

// @desc    Get all complaints (with role-based filtering)
// @route   GET /api/complaints
const getComplaints = async (req, res) => {
  try {
    const status = sanitizeQuery(req.query.status);
    const priority = sanitizeQuery(req.query.priority);
    const type = sanitizeQuery(req.query.type);
    const binId = sanitizeQuery(req.query.binId);
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (binId) query.binId = String(binId).trim().toUpperCase();

    // Role-based filtering
    if (req.user.role === 'student') {
      query.user = req.user.id;
    } else if (req.user.role === 'collector') {
      query.block = req.user.block;
    }

    const complaints = await Complaint.find(query)
      .populate('user', 'name email')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    // Refresh breach flag (non-persistent escalation check)
    const results = complaints.map((c) => {
      escalateIfBreached(c);
      const obj = c.toJSON();
      if (c.slaDeadline) obj.slaRemainingMs = remainingMsFor(c.slaDeadline);
      return obj;
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get single complaint
// @route   GET /api/complaints/:id
const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id.toUpperCase() })
      .populate('user', 'name email')
      .populate('assignedTo', 'name');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Security check
    const complaintUserId = complaint.user?._id
      ? complaint.user._id.toString()
      : complaint.user?.toString();

    if (req.user.role === 'student' && complaintUserId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (req.user.role === 'collector' && complaint.block !== req.user.block) {
      return res.status(403).json({ message: 'Not authorized to view other blocks' });
    }

    escalateIfBreached(complaint);
    const result = complaint.toJSON();
    if (complaint.slaDeadline) result.slaRemainingMs = remainingMsFor(complaint.slaDeadline);
    res.json(result);
  } catch (err) {
    console.error('[GET COMPLAINT]:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit a new complaint
// @route   POST /api/complaints
const submitComplaint = async (req, res) => {
  try {
    const { location, wasteType, description, block, type, binId, lat, lng, address, priority } = req.body;

    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadImage(req.file, 'sustainx/complaints');
      } catch (uploadErr) {
        console.error('[SUBMIT] Upload failed:', uploadErr.message);
      }
    }

    const complaint = await complaintService.submit({
      actor: { id: req.user.id, role: req.user.role, block: req.user.block },
      location,
      wasteType,
      description,
      block: String(block || req.user.block || 'A'),
      type,
      binId,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      address,
      priority,
      image: imageUrl,
    });

    res.status(201).json(complaint);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    console.error('[SUBMIT] ERROR:', err.message);
    res.status(statusCode).json({ message: err.isOperational ? err.message : 'Internal Server Error' });
  }
};

// @desc    Update complaint status (General)
// @route   PUT /api/complaints/:id/status
const updateComplaintStatus = async (req, res) => {
  try {
    const { status, note, assignedTo } = req.body;
    const { id } = req.params;

    const complaint = await complaintService.transition({
      complaintId: id,
      actor: req.user,
      status,
      note,
      assignedTo,
    });

    res.json(complaint);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Complete complaint with image proof
// @route   POST /api/complaints/complete/:id
const completeComplaint = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Proof image is required.' });
    }

    let imageUrl;
    try {
      imageUrl = await uploadImage(req.file, 'sustainx/completions');
    } catch (uploadErr) {
      console.error('[COMPLETE] Upload FAILED:', uploadErr.message);
      return res.status(500).json({
        message: 'Image upload failed',
      });
    }

    const complaint = await complaintService.complete({
      complaintId: req.params.id,
      actor: req.user,
      image: imageUrl,
    });

    return res.json({
      success: true,
      message: 'Complaint completed successfully',
      complaintId: complaint.complaintId,
      completionImage: imageUrl,
    });
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    console.error('[COMPLETE] FATAL:', err.message);
    return res.status(statusCode).json({
      message: err.isOperational ? err.message : 'Internal Server Error',
    });
  }
};

// @desc    Citizen confirms resolution
// @route   POST /api/complaints/:id/confirm
const citizenConfirmComplaint = async (req, res) => {
  try {
    const complaint = await complaintService.citizenConfirm({
      complaintId: req.params.id,
      actor: req.user,
    });
    res.json(complaint);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

// @desc    Reopen a resolved or rejected complaint
// @route   POST /api/complaints/:id/reopen
const reopenComplaint = async (req, res) => {
  try {
    const complaint = await complaintService.reopen({
      complaintId: req.params.id,
      actor: req.user,
    });
    res.json(complaint);
  } catch (err) {
    const statusCode = err.isOperational ? err.statusCode || 400 : 500;
    res.status(statusCode).json({ message: err.message });
  }
};

module.exports = {
  getComplaints,
  getComplaintById,
  submitComplaint,
  updateComplaintStatus,
  completeComplaint,
  citizenConfirmComplaint,
  reopenComplaint,
};