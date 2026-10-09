const crypto = require('crypto');
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, default: '' },
    bin: { type: mongoose.Schema.Types.ObjectId, ref: 'SmartBin', default: null },
    binId: { type: String, default: null },
    block: { type: String, uppercase: true, trim: true, default: null },
    ward: { type: String, uppercase: true, trim: true, default: null },
    apiKeyHash: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    alertCooldownUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

deviceSchema.methods.setApiKey = function (apiKey) {
  this.apiKeyHash = crypto.createHash('sha256').update(String(apiKey)).digest('hex');
};

deviceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.apiKeyHash;
  return obj;
};

module.exports = mongoose.model('Device', deviceSchema);