const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  physiologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exerciseId: { type: String, default: 'hand_raise' },
  raiseAngleThreshold: { type: Number, default: 90 },
  lowerAngleThreshold: { type: Number, default: 30 },
  minAdaptedAngle: { type: Number, default: null },    // physio floor for adaptive target
  currentAdaptedAngle: { type: Number, default: null }, // persisted across sessions
  targetReps: { type: Number, default: 10 },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
