const mongoose = require('mongoose');

const collectionTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, unique: true },
    type: { type: String, enum: ['scheduled', 'complaint', 'overflow', 'forced'], default: 'scheduled' },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bin: { type: mongoose.Schema.Types.ObjectId, ref: 'SmartBin', default: null },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    block: { type: String, uppercase: true, trim: true, default: null },
    ward: { type: String, uppercase: true, trim: true, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    slaDeadline: { type: Date, default: null },
    scheduledDate: { type: Date, default: null },
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    proofImage: { type: String, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

collectionTaskSchema.index({ worker: 1, status: 1 });
collectionTaskSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('CollectionTask', collectionTaskSchema);