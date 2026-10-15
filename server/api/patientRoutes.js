const express = require('express');
const verifyToken = require('../middleware/auth');
const Prescription = require('../models/prescriptionModel');
const ExerciseResult = require('../models/exerciseResultModel');

const router = express.Router();

// GET /api/patients/history
// All prescriptions + their results for the logged-in patient
router.get('/history', verifyToken, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .populate('sessionId', 'slotDate slotTime complaints')
      .populate('physiologistId', 'name specialty')
      .sort({ createdAt: -1 });

    const history = await Promise.all(prescriptions.map(async (p) => {
      const results = await ExerciseResult.find({ prescriptionId: p._id })
        .sort({ createdAt: -1 })
        .limit(30)
        .select('reps assistedReps score analysis restAngle createdAt');
      return { prescription: p, results };
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/progress
// Per-prescription score + ROM trend (ascending by date)
router.get('/progress', verifyToken, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .populate('sessionId', 'slotDate slotTime')
      .sort({ createdAt: -1 });

    const progress = await Promise.all(prescriptions.map(async (p) => {
      const results = await ExerciseResult.find({ prescriptionId: p._id })
        .sort({ createdAt: 1 })
        .select('reps assistedReps score analysis restAngle createdAt');

      const trend = results.map(r => ({
        date: r.createdAt,
        reps: r.reps,
        score: r.score,
        assistedReps: r.assistedReps,
        romPercent: r.analysis?.romPercent ?? null,
        consistency: r.analysis?.consistency ?? null,
        assistedPercent: r.analysis?.assistedPercent ?? null,
        aiSummary: r.analysis?.aiSummary ?? null,
      }));

      const count = results.length;
      const avgScore = count ? Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / count) : null;
      const withROM = results.filter(r => r.analysis?.romPercent != null);
      const avgROM = withROM.length ? Math.round(withROM.reduce((s, r) => s + r.analysis.romPercent, 0) / withROM.length) : null;
      const latest = results[count - 1];

      return {
        prescriptionId: p._id,
        exerciseId: p.exerciseId,
        targetReps: p.targetReps,
        raiseAngleThreshold: p.raiseAngleThreshold,
        sessionInfo: p.sessionId,
        totalSessions: count,
        avgScore,
        avgROM,
        latestScore: latest?.score ?? null,
        latestReps: latest?.reps ?? null,
        trend,
      };
    }));

    res.json(progress);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
