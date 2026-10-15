const mongoose = require('mongoose');

const exerciseResultSchema = new mongoose.Schema({
  prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reps: { type: Number, required: true },
  assistedReps: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  // Adaptive threshold metrics (hand raise only — null/[] when not applicable)
  originalTargetAngle: { type: Number, default: null },
  adaptedTargetAngle: { type: Number, default: null },
  repPeakAngles: { type: [Number], default: [] },
  adaptationEvents: {
    type: [{ timestamp: Number, from: Number, to: Number, reason: String }],
    default: [],
  },
  // Calibration metadata — lets physio see per-session rest angle
  restAngle: { type: Number, default: null },
  restCalibrated: { type: Boolean, default: false },
  videoUrl: { type: String, default: null },
  // Computed analytics + AI summary (populated at save time)
  analysis: {
    romPercent: { type: Number, default: null },
    consistency: { type: Number, default: null },
    assistedPercent: { type: Number, default: null },
    aiSummary: { type: String, default: null },
  },
}, { timestamps: true });

module.exports = mongoose.model('ExerciseResult', exerciseResultSchema);
