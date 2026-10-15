const mongoose = require('mongoose');

const chatThreadSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    physiologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' },
    lastSenderRole: { type: String, enum: ['patient', 'physiologist', null], default: null },
    patientUnread: { type: Number, default: 0 },
    physiologistUnread: { type: Number, default: 0 },
  },
  { timestamps: true },
);

chatThreadSchema.index({ patientId: 1, physiologistId: 1 }, { unique: true });

module.exports = mongoose.model('ChatThread', chatThreadSchema);
