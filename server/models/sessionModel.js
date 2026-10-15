const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  physiologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotDate: { type: String, required: true },
  slotTime: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'summarised', 'approved'],
    default: 'pending',
  },
  complaints: { type: String, default: '' },
  meetingUrl: { type: String, default: '' },
  eventId: { type: String, default: '' },
  recallBotId: { type: String, default: '' },
  transcriptText: { type: String, default: '' },
  aiSummary: { type: String, default: '' },
  approvedSummary: { type: String, default: '' },
  followUpDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
