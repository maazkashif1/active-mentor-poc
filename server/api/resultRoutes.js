const express = require('express');
const ExerciseResult = require('../models/exerciseResultModel');
const Prescription = require('../models/prescriptionModel');
const { keyFromUrl } = require('../services/storage');
const { enqueueVideo, playbackFields } = require('../services/videoService');
const verifyToken = require('../middleware/auth');
const { analyzeExerciseResult } = require('../services/summaryService');

const router = express.Router();

function computeMetrics(reps, assistedReps, repPeakAngles, targetAngle) {
  const assisted = reps > 0 ? (assistedReps / reps) * 100 : 0;
  if (!repPeakAngles?.length || !targetAngle) return { romPercent: null, consistency: null, assistedPercent: assisted };
  const mean = repPeakAngles.reduce((a, b) => a + b, 0) / repPeakAngles.length;
  const variance = repPeakAngles.reduce((a, b) => a + (b - mean) ** 2, 0) / repPeakAngles.length;
  return {
    romPercent: (mean / targetAngle) * 100,
    consistency: Math.sqrt(variance),
    assistedPercent: assisted,
  };
}

router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      prescriptionId, reps, score, assistedReps,
      originalTargetAngle, adaptedTargetAngle, repPeakAngles, adaptationEvents,
      restAngle, restCalibrated, videoUrl,
    } = req.body;

    const prescription = await Prescription.findById(prescriptionId);
    const targetAngle = adaptedTargetAngle ?? originalTargetAngle ?? prescription?.raiseAngleThreshold ?? null;
    const { romPercent, consistency, assistedPercent } = computeMetrics(reps, assistedReps ?? 0, repPeakAngles, targetAngle);

    // AI summary — fire-and-forget safe: if it fails we still save the result
    let aiSummary = null;
    try {
      aiSummary = await analyzeExerciseResult({
        exerciseName: prescription?.exerciseId ?? 'exercise',
        targetReps: prescription?.targetReps ?? reps,
        reps, assistedReps: assistedReps ?? 0,
        repPeakAngles, originalTargetAngle, adaptedTargetAngle,
        adaptationEvents, restAngle, restCalibrated,
        romPercent, consistency, assistedPercent,
      });
    } catch (e) {
      console.error('AI summary failed (non-fatal):', e.message);
    }

    const result = await ExerciseResult.create({
      prescriptionId, patientId: req.user.id, reps, score, assistedReps,
      originalTargetAngle: originalTargetAngle ?? null,
      adaptedTargetAngle: adaptedTargetAngle ?? null,
      repPeakAngles: repPeakAngles ?? [],
      adaptationEvents: adaptationEvents ?? [],
      restAngle: restAngle ?? null,
      restCalibrated: restCalibrated ?? false,
      videoUrl: videoUrl ?? null,
      videoKey: keyFromUrl(videoUrl),
      videoStatus: videoUrl ? 'pending' : 'none',
      analysis: { romPercent, consistency, assistedPercent, aiSummary },
    });

    await Prescription.findByIdAndUpdate(prescriptionId, {
      currentAdaptedAngle: adaptedTargetAngle ?? null,
    });

    if (videoUrl) enqueueVideo(result._id); // make it playable in every browser (background)
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/prescription/:id', verifyToken, async (req, res) => {
  try {
    const results = await ExerciseResult.find({ prescriptionId: req.params.id }).sort({ createdAt: -1 });
    res.json(await Promise.all(results.map(playbackFields)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
