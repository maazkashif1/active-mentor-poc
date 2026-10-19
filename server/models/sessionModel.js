const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  physiologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotDate: { type: String, required: true },
  slotTime: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'summarised', 'approved', 'missed'],
    default: 'pending',
  },
  complaints: { type: String, default: '' },
  meetingUrl: { type: String, default: '' },
  eventId: { type: String, default: '' },
  recallBotId: { type: String, default: '' },
  // Sadaan Attempt
  // Correct UTC start instant + scribe bot state, so failures are visible instead of silent.
  scheduledStart: { type: Date, default: null },
  recallStatus: { type: String, default: '' }, // e.g. scheduled, bot.in_waiting_room, bot.done, failed
  recallError: { type: String, default: '' },
  // Bot orchestration: attempt cap, short-lived lock, and stuck-processing detection.
  recallAttempts: { type: Number, default: 0 },
  recallLockUntil: { type: Date, default: null },
  processingStartedAt: { type: Date, default: null },
  startedAt: { type: Date, default: null }, // set when physio/patient presses "Start session"
  transcriptText: { type: String, default: '' },
  aiSummary: { type: String, default: '' },
  approvedSummary: { type: String, default: '' },
  followUpDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
