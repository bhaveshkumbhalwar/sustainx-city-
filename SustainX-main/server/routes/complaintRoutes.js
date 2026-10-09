const express = require('express');
const {
  getComplaints,
  getComplaintById,
  submitComplaint,
  updateComplaintStatus,
  completeComplaint,
  citizenConfirmComplaint,
  reopenComplaint,
} = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const rateLimit = require('../utils/rateLimit');

const router = express.Router();

router.get('/', protect, getComplaints);
router.get('/:id', protect, getComplaintById);
router.post('/', protect, authorize('student'), rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }), upload.single('image'), submitComplaint);
router.put('/:id/status', protect, authorize('collector', 'admin'), updateComplaintStatus);
router.post('/complete/:id', protect, authorize('collector'), upload.single('image'), completeComplaint);
router.post('/:id/confirm', protect, citizenConfirmComplaint);
router.post('/:id/reopen', protect, reopenComplaint);

module.exports = router;